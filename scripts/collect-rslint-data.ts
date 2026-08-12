#!/usr/bin/env node

/** Collect rule metadata for stable RSLint releases that publish rule typings. */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { execa } from 'execa';
import pLimit from 'p-limit';

import type { RslintRule } from './utils/rslint-rules.ts';
import {
  isStableVersion,
  parseStableReleases,
  type PublishedRelease,
} from './utils/releases.ts';

const dataDir = 'data/rslint/versions';
const inspectorPath = resolve('scripts/utils/inspect-rslint.ts');

const CONCURRENCY = 4;
const TIMEOUT_MS = 180_000;

interface RslintReleaseData {
  date: string;
  rules: RslintRule[];
}

function hasRuleMetadata(version: string): boolean {
  const [major, minor] = version.split('.').map(Number);
  return major! > 0 || minor! >= 8;
}

async function publishedReleases(): Promise<PublishedRelease[]> {
  const result = await execa('pnpm', ['view', '@rslint/core', 'time', '--json'], {
    reject: false,
    timeout: TIMEOUT_MS,
  });
  if (result.failed) throw new Error(`Could not read RSLint release history:\n${result.stderr}`);
  return parseStableReleases(result.stdout).filter(({ version }) => hasRuleMetadata(version));
}

async function fetchRules(version: string): Promise<RslintRule[]> {
  const result = await execa(
    'pnpx',
    ['--silent', '--package', `@rslint/core@${version}`, 'node', inspectorPath],
    { reject: false, timeout: TIMEOUT_MS },
  );
  if (result.failed) {
    const details = result.stderr.trim().split('\n').slice(0, 8).join('\n');
    throw new Error(`Could not inspect RSLint@${version}${details ? `:\n${details}` : ''}`);
  }
  return JSON.parse(result.stdout) as RslintRule[];
}

async function readExistingData(path: string): Promise<RslintReleaseData | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as RslintReleaseData;
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
  if (!release) throw new Error(`@rslint/core@${version} has no published rule metadata`);
  return release;
});

for (const version of prereleases) console.warn(`Skipping non-stable RSLint@${version}.`);

console.log(`Collecting ${releases.length} RSLint release${releases.length === 1 ? '' : 's'}...`);
const limit = pLimit(CONCURRENCY);
const results = await Promise.allSettled(
  releases.map((release) =>
    limit(async () => {
      const result = await collectVersion(release, force);
      console.log(
        `${result.cached ? 'Cached ' : 'Wrote  '} RSLint@${release.version}: ${result.count} rules`,
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
