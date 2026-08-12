#!/usr/bin/env node

/** Collect rule metadata for every stable TTSC lint release. */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { execa } from 'execa';
import pLimit from 'p-limit';

import type { TtscRule } from './utils/ttsc-rules.ts';
import {
  isStableVersion,
  parseStableReleases,
  type PublishedRelease,
} from './utils/releases.ts';

const dataDir = 'data/ttsc/versions';
const inspectorPath = resolve('scripts/utils/inspect-ttsc.ts');

const CONCURRENCY = 4;
const TIMEOUT_MS = 180_000;

interface TtscReleaseData {
  date: string;
  rules: TtscRule[];
}

async function publishedReleases(): Promise<PublishedRelease[]> {
  const result = await execa('pnpm', ['view', '@ttsc/lint', 'time', '--json'], {
    reject: false,
    timeout: TIMEOUT_MS,
  });
  if (result.failed) throw new Error(`Could not read TTSC lint release history:\n${result.stderr}`);
  return parseStableReleases(result.stdout);
}

async function fetchRules(version: string): Promise<TtscRule[]> {
  const result = await execa(
    'pnpx',
    ['--silent', '--package', `@ttsc/lint@${version}`, 'node', inspectorPath],
    { reject: false, timeout: TIMEOUT_MS },
  );
  if (result.failed) {
    const details = result.stderr.trim().split('\n').slice(0, 8).join('\n');
    throw new Error(`Could not inspect TTSC lint@${version}${details ? `:\n${details}` : ''}`);
  }
  return JSON.parse(result.stdout) as TtscRule[];
}

async function readExistingData(path: string): Promise<TtscReleaseData | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as TtscReleaseData;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
}

async function collectVersion(release: PublishedRelease, force: boolean) {
  const outputPath = `${dataDir}/${release.version}.json`;
  if (!force) {
    const existing = await readExistingData(outputPath);
    if (existing?.date === release.date) {
      return { cached: true, count: existing.rules.length };
    }
  }

  const rules = await fetchRules(release.version);
  await writeFile(outputPath, `${JSON.stringify({ date: release.date, rules }, null, 2)}\n`);
  return { cached: false, count: rules.length };
}

const args = process.argv.slice(2);
const force = args.includes('--force');
const explicitVersions = args.filter((argument) => argument !== '--force');
const unknownOption = explicitVersions.find((argument) => argument.startsWith('-'));
if (unknownOption) throw new Error(`Unknown option: ${unknownOption}`);

await mkdir(dataDir, { recursive: true });

const published = await publishedReleases();
const requestedVersions =
  explicitVersions.length > 0 ? explicitVersions : published.map(({ version }) => version);
const prereleases = requestedVersions.filter((version) => !isStableVersion(version));
const publishedByVersion = new Map(published.map((release) => [release.version, release]));
const releases = requestedVersions.filter(isStableVersion).map((version) => {
  const release = publishedByVersion.get(version);
  if (!release) throw new Error(`@ttsc/lint@${version} is not a published stable release`);
  return release;
});

for (const version of prereleases) console.warn(`Skipping non-stable TTSC lint@${version}.`);

console.log(`Collecting ${releases.length} TTSC lint release${releases.length === 1 ? '' : 's'}...`);
const limit = pLimit(CONCURRENCY);
const results = await Promise.allSettled(
  releases.map((release) =>
    limit(async () => {
      const result = await collectVersion(release, force);
      console.log(
        `${result.cached ? 'Cached ' : 'Wrote  '} TTSC lint@${release.version}: ${result.count} rules`,
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
