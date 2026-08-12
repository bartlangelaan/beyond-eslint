#!/usr/bin/env node

/** Collect rule metadata for every stable Biome release. */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { execa } from 'execa';
import pLimit from 'p-limit';

import { parseBiomeEslintMappings, type BiomeRule } from './utils/biome-rules.ts';
import {
  isStableVersion,
  parseStableReleases,
  type PublishedRelease,
} from './utils/releases.ts';

const dataDir = 'data/biome/versions';
const inspectorPath = resolve('scripts/utils/inspect-biome.ts');

const CONCURRENCY = 4;
const TIMEOUT_MS = 180_000;
const SOURCES_URL =
  'https://raw.githubusercontent.com/biomejs/website/main/src/content/docs/linter/rules-sources.mdx';

interface BiomeReleaseData {
  date: string;
  rules: BiomeRule[];
}

async function publishedReleases(): Promise<PublishedRelease[]> {
  const result = await execa('pnpm', ['view', '@biomejs/biome', 'time', '--json'], {
    reject: false,
    timeout: TIMEOUT_MS,
  });
  if (result.failed) throw new Error(`Could not read Biome release history:\n${result.stderr}`);
  return parseStableReleases(result.stdout);
}

async function fetchRules(version: string): Promise<BiomeRule[]> {
  const result = await execa(
    'pnpx',
    [
      '--silent',
      '--package',
      `@biomejs/biome@${version}`,
      'node',
      inspectorPath,
    ],
    { reject: false, timeout: TIMEOUT_MS },
  );
  if (result.failed) {
    const details = result.stderr.trim().split('\n').slice(0, 8).join('\n');
    throw new Error(`Could not inspect Biome@${version}${details ? `:\n${details}` : ''}`);
  }
  return JSON.parse(result.stdout) as BiomeRule[];
}

async function readExistingData(path: string): Promise<BiomeReleaseData | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as BiomeReleaseData;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
}

async function collectVersion(
  release: PublishedRelease,
  force: boolean,
  mappings: Map<string, string[]>,
) {
  const outputPath = `${dataDir}/${release.version}.json`;
  if (!force) {
    const existing = await readExistingData(outputPath);
    if (existing?.date === release.date) {
      return { cached: true, count: existing.rules.length };
    }
  }

  const rules = (await fetchRules(release.version)).map((rule) => {
    const eslintRules = mappings.get(rule.name);
    return eslintRules ? { ...rule, eslintRules } : rule;
  });
  await writeFile(outputPath, `${JSON.stringify({ date: release.date, rules }, null, 2)}\n`);
  return { cached: false, count: rules.length };
}

const args = process.argv.slice(2);
const force = args.includes('--force');
const explicitVersions = args.filter((argument) => argument !== '--force');
const unknownOption = explicitVersions.find((argument) => argument.startsWith('-'));
if (unknownOption) throw new Error(`Unknown option: ${unknownOption}`);

await mkdir(dataDir, { recursive: true });

const response = await fetch(SOURCES_URL);
if (!response.ok) throw new Error(`Could not fetch Biome rule sources: ${response.status}`);
const mappings = parseBiomeEslintMappings(await response.text());

const published = await publishedReleases();
const requestedVersions =
  explicitVersions.length > 0 ? explicitVersions : published.map(({ version }) => version);
const prereleases = requestedVersions.filter((version) => !isStableVersion(version));
const publishedByVersion = new Map(published.map((release) => [release.version, release]));
const releases = requestedVersions.filter(isStableVersion).map((version) => {
  const release = publishedByVersion.get(version);
  if (!release) throw new Error(`@biomejs/biome@${version} is not a published stable release`);
  return release;
});

for (const version of prereleases) console.warn(`Skipping non-stable Biome@${version}.`);

console.log(`Collecting ${releases.length} Biome release${releases.length === 1 ? '' : 's'}...`);
const limit = pLimit(CONCURRENCY);
const results = await Promise.allSettled(
  releases.map((release) =>
    limit(async () => {
      const result = await collectVersion(release, force, mappings);
      console.log(
        `${result.cached ? 'Cached ' : 'Wrote  '} Biome@${release.version}: ${result.count} rules`,
      );
    }),
  ),
);

const failures = results.flatMap((result, index) =>
  result.status === 'rejected' ? [{ error: result.reason, release: releases[index]! }] : [],
);
for (const { release, error } of failures) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n${release.version}: ${message}`);
}
if (failures.length > 0) {
  throw new Error(`Failed to collect ${failures.length} release${failures.length === 1 ? '' : 's'}`);
}
