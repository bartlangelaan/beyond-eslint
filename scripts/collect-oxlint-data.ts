#!/usr/bin/env node

/** Collect the rules shipped by every stable, usable oxlint release on npm. */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { execa } from 'execa';
import pLimit from 'p-limit';

import { type OxlintRule, parseRules } from './utils/oxlint-rules.ts';
import {
  isStableVersion,
  parseStableReleases,
  type PublishedRelease,
} from './utils/releases.ts';

const dataDir = 'data/oxlint/versions';

const CONCURRENCY = 4;
const TIMEOUT_MS = 120_000;

// These packages cannot yield rule data on any supported installation.
const UNAVAILABLE_RELEASES = new Map([
  ['0.0.1', 'its referenced native packages were never published'],
  ['0.0.2', 'its CLI cannot resolve its published native package'],
  ['0.9.4', 'its native binary was published without executable permissions'],
  ['1.61.1', 'it was an accidental release without a usable package'],
]);

async function run(command: string, args: string[]) {
  const result = await execa(command, args, {
    all: true,
    reject: false,
    timeout: TIMEOUT_MS,
  });
  return { failed: result.failed, output: result.all ?? '' };
}

interface OxlintReleaseData {
  date: string;
  rules: OxlintRule[];
}

async function publishedReleases(): Promise<PublishedRelease[]> {
  const result = await run('pnpm', ['view', 'oxlint', 'time', '--json']);
  if (result.failed) {
    throw new Error(`Could not read oxlint release history from npm:\n${result.output}`);
  }
  return parseStableReleases(result.output);
}

async function fetchRules(version: string): Promise<OxlintRule[]> {
  let output = '';
  for (const args of [
    [`oxlint@${version}`, '--rules', '--format', 'json'],
    [`oxlint@${version}`, '--rules'],
  ]) {
    ({ output } = await run('pnpx', args));
    const rules = parseRules(output);
    if (rules) return rules;
  }

  const details = output.trim().split('\n').slice(0, 8).join('\n');
  throw new Error(`Could not parse oxlint@${version} rule output${details ? `:\n${details}` : ''}`);
}

async function readExistingData(path: string): Promise<OxlintReleaseData | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as OxlintReleaseData;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
}

async function collectVersion(
  release: PublishedRelease,
  force: boolean,
): Promise<{ cached: boolean; count: number }> {
  const { date, version } = release;
  const outputPath = join(dataDir, `${version}.json`);
  if (!force) {
    const existing = await readExistingData(outputPath);
    if (existing?.date === date) {
      return { cached: true, count: existing.rules.length };
    }
  }

  const rules = await fetchRules(version);
  const data: OxlintReleaseData = { date, rules };
  await writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`);
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
const releases = requestedVersions
  .filter((version) => isStableVersion(version) && !UNAVAILABLE_RELEASES.has(version))
  .map((version) => {
    const release = publishedByVersion.get(version);
    if (!release) throw new Error(`oxlint@${version} is not a published stable release`);
    return release;
  });

for (const version of prereleases) console.warn(`Skipping non-stable oxlint@${version}.`);
for (const [version, reason] of UNAVAILABLE_RELEASES) {
  if (requestedVersions.includes(version)) console.warn(`Skipping oxlint@${version}: ${reason}.`);
}

console.log(`Collecting ${releases.length} oxlint release${releases.length === 1 ? '' : 's'}...`);
const limit = pLimit(CONCURRENCY);
const results = await Promise.allSettled(
  releases.map((release) =>
    limit(async () => {
      const result = await collectVersion(release, force);
      console.log(
        `${result.cached ? 'Cached ' : 'Wrote  '} oxlint@${release.version}: ${result.count} rules`,
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
