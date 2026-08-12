export interface PublishedRelease {
  date: string;
  version: string;
}

const STABLE_VERSION = /^\d+\.\d+\.\d+$/;

export function isStableVersion(version: string): boolean {
  return STABLE_VERSION.test(version);
}

export function parseStableReleases(output: string): PublishedRelease[] {
  const times = JSON.parse(output) as Record<string, unknown>;

  return Object.entries(times)
    .filter(
      (entry): entry is [string, string] =>
        isStableVersion(entry[0]) && typeof entry[1] === 'string',
    )
    .map(([version, date]) => ({ version, date }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
