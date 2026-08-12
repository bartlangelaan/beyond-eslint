import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export const seriesNames = [
  "Biome",
  "Oxlint",
  "RSLint",
  "TTSC",
  "ESLint plugins",
] as const;

export type SeriesName = (typeof seriesNames)[number];

export interface RuleHistoryPoint {
  date: string;
  rules: number;
  series: SeriesName;
}

export interface RuleHistory {
  firstDate: string;
  lastDate: string;
  points: RuleHistoryPoint[];
}

interface RuleMetadata {
  deprecated?: boolean;
}

interface ReleaseFile {
  date: string;
  rules: RuleMetadata[];
}

interface DailyRelease {
  date: string;
  rules: number;
}

const dayInMilliseconds = 24 * 60 * 60 * 1_000;
const dataDirectory = path.join(process.cwd(), "data");

const linters = [
  ["biome", "Biome"],
  ["oxlint", "Oxlint"],
  ["rslint", "RSLint"],
  ["ttsc", "TTSC"],
] as const satisfies readonly (readonly [string, SeriesName])[];

function toDay(date: string): string {
  return new Date(date).toISOString().slice(0, 10);
}

function dayNumber(date: string): number {
  return Date.parse(`${date}T00:00:00.000Z`);
}

async function readReleases(
  packageName: string,
  countRules: (rules: RuleMetadata[]) => number,
): Promise<DailyRelease[]> {
  const versionsDirectory = path.join(dataDirectory, packageName, "versions");
  const files = (await readdir(versionsDirectory))
    .filter((file) => file.endsWith(".json"))
    .sort();

  const releases = await Promise.all(
    files.map(async (file) => {
      const contents = await readFile(path.join(versionsDirectory, file), "utf8");
      const release = JSON.parse(contents) as ReleaseFile;

      if (!release.date || !Array.isArray(release.rules)) {
        throw new Error(`Invalid release data in ${packageName}/${file}`);
      }

      return {
        date: release.date,
        day: toDay(release.date),
        rules: countRules(release.rules),
      };
    }),
  );

  releases.sort((left, right) => left.date.localeCompare(right.date));

  // If several versions were published on one day, graph the last snapshot.
  const byDay = new Map<string, DailyRelease>();
  for (const release of releases) {
    byDay.set(release.day, { date: release.day, rules: release.rules });
  }

  return [...byDay.values()].sort((left, right) =>
    left.date.localeCompare(right.date),
  );
}

function dailyPoints(
  releases: DailyRelease[],
  series: SeriesName,
  lastDate: string,
): RuleHistoryPoint[] {
  const firstRelease = releases[0];
  if (!firstRelease) return [];

  const points: RuleHistoryPoint[] = [];
  let releaseIndex = 0;
  let rules = firstRelease.rules;

  for (
    let timestamp = dayNumber(firstRelease.date);
    timestamp <= dayNumber(lastDate);
    timestamp += dayInMilliseconds
  ) {
    const date = new Date(timestamp).toISOString().slice(0, 10);

    while (true) {
      const nextRelease = releases[releaseIndex + 1];
      if (!nextRelease || nextRelease.date > date) break;
      releaseIndex += 1;
      rules = releases[releaseIndex]?.rules ?? rules;
    }

    points.push({ date, rules, series });
  }

  return points;
}

export async function getRuleHistory(): Promise<RuleHistory> {
  const directoryNames = await readdir(dataDirectory);
  const eslintPluginNames = directoryNames
    .filter((name) => name.startsWith("eslint-plugin-"))
    .sort();

  const [linterHistories, eslintPluginHistories] = await Promise.all([
    Promise.all(
      linters.map(async ([directory, series]) => ({
        releases: await readReleases(directory, (rules) => rules.length),
        series,
      })),
    ),
    Promise.all(
      eslintPluginNames.map((name) =>
        readReleases(
          name,
          (rules) => rules.filter((rule) => rule.deprecated !== true).length,
        ),
      ),
    ),
  ]);

  const allHistories = [
    ...linterHistories.map(({ releases }) => releases),
    ...eslintPluginHistories,
  ];
  const firstDate = allHistories
    .flatMap((releases) => releases[0]?.date ?? [])
    .sort()[0];
  const lastReleaseDate = allHistories
    .flatMap((releases) => releases.at(-1)?.date ?? [])
    .sort()
    .at(-1);

  if (!firstDate || !lastReleaseDate || eslintPluginHistories.length === 0) {
    throw new Error("No rule history data is available");
  }

  const today = new Date().toISOString().slice(0, 10);
  const lastDate = lastReleaseDate > today ? lastReleaseDate : today;

  const points = linterHistories.flatMap(({ releases, series }) =>
    dailyPoints(releases, series, lastDate),
  );

  // Start the combined line when every tracked plugin has a snapshot. This
  // avoids presenting missing historical plugin data as zero rules.
  const eslintFirstDate = eslintPluginHistories
    .map((releases) => releases[0]?.date)
    .filter((date): date is string => date !== undefined)
    .sort()
    .at(-1);

  if (!eslintFirstDate) {
    throw new Error("No ESLint plugin history data is available");
  }

  const indexes = eslintPluginHistories.map(() => 0);
  for (
    let timestamp = dayNumber(eslintFirstDate);
    timestamp <= dayNumber(lastDate);
    timestamp += dayInMilliseconds
  ) {
    const date = new Date(timestamp).toISOString().slice(0, 10);
    let rules = 0;

    for (const [pluginIndex, releases] of eslintPluginHistories.entries()) {
      let releaseIndex = indexes[pluginIndex] ?? 0;
      while (true) {
        const nextRelease = releases[releaseIndex + 1];
        if (!nextRelease || nextRelease.date > date) break;
        releaseIndex += 1;
      }
      indexes[pluginIndex] = releaseIndex;
      rules += releases[releaseIndex]?.rules ?? 0;
    }

    points.push({ date, rules, series: "ESLint plugins" });
  }

  points.sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      seriesNames.indexOf(left.series) - seriesNames.indexOf(right.series),
  );

  return { firstDate, lastDate, points };
}
