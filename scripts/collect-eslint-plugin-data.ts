#!/usr/bin/env node

/** Collect rule metadata for stable releases of ESLint plugins tracked by oxlint. */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { execa } from 'execa';
import pLimit from 'p-limit';

import { eslintPlugins, type EslintPlugin } from './utils/eslint-plugins.ts';
import type { EslintRuleMetadata } from './utils/eslint-rule-metadata.ts';
import { parseStableReleases, type PublishedRelease } from './utils/releases.ts';

const CONCURRENCY = 4;
const EARLIEST_RELEASE_DATE = '2024-01-01T00:00:00.000Z';
const TIMEOUT_MS = 120_000;
const inspectorPath = resolve('scripts/utils/inspect-eslint-plugin.ts');

interface EslintPluginReleaseData {
  date: string;
  rules: EslintRuleMetadata[];
}

interface Collection {
  plugin: EslintPlugin;
  release: PublishedRelease;
}

async function publishedReleases(packageName: string): Promise<PublishedRelease[]> {
  const result = await execa('pnpm', ['view', packageName, 'time', '--json'], {
    reject: false,
    timeout: TIMEOUT_MS,
  });
  if (result.failed) {
    throw new Error(`Could not read ${packageName} release history:\n${result.stderr}`);
  }
  return parseStableReleases(result.stdout).filter(({ date }) => date >= EARLIEST_RELEASE_DATE);
}

async function fetchRules(plugin: EslintPlugin, version: string): Promise<EslintRuleMetadata[]> {
  const packages = [
    `${plugin.packageName}@${version}`,
    ...(plugin.runtimePackages ?? []).map((packageName) =>
      packageName.replaceAll('{version}', version),
    ),
  ].flatMap((packageName) => ['--package', packageName]);
  const result = await execa(
    'pnpx',
    [
      '--silent',
      ...packages,
      'node',
      inspectorPath,
      plugin.packageName,
      plugin.docsUrl,
    ],
    { reject: false, timeout: TIMEOUT_MS },
  );

  if (result.failed) {
    const details = result.stderr.trim().split('\n').slice(0, 8).join('\n');
    throw new Error(`Could not inspect ${plugin.packageName}@${version}${details ? `:\n${details}` : ''}`);
  }
  return JSON.parse(result.stdout) as EslintRuleMetadata[];
}

async function readExistingData(path: string): Promise<EslintPluginReleaseData | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as EslintPluginReleaseData;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
}

async function collectVersion({ plugin, release }: Collection, force: boolean) {
  const directory = `data/${plugin.id}/versions`;
  const outputPath = `${directory}/${release.version}.json`;
  await mkdir(directory, { recursive: true });

  if (!force) {
    const existing = await readExistingData(outputPath);
    if (existing?.date === release.date) {
      return { cached: true, count: existing.rules.length };
    }
  }

  const rules = await fetchRules(plugin, release.version);
  const data: EslintPluginReleaseData = { date: release.date, rules };
  await writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`);
  return { cached: false, count: rules.length };
}

const args = process.argv.slice(2);
const force = args.includes('--force');
const requestedIds = args.filter((argument) => argument !== '--force');
const unknownOption = requestedIds.find((argument) => argument.startsWith('-'));
if (unknownOption) throw new Error(`Unknown option: ${unknownOption}`);

const selectedPlugins =
  requestedIds.length === 0
    ? eslintPlugins
    : requestedIds.map((id) => {
        const plugin = eslintPlugins.find((candidate) => candidate.id === id);
        if (!plugin) throw new Error(`Unknown ESLint plugin: ${id}`);
        return plugin;
      });

const releaseLists = await Promise.all(
  selectedPlugins.map(async (plugin) => ({
    plugin,
    releases: await publishedReleases(plugin.packageName),
  })),
);
const collections = releaseLists.flatMap(({ plugin, releases }) =>
  releases.map((release) => ({ plugin, release })),
);

console.log(
  `Collecting ${collections.length} releases for ${selectedPlugins.length} ESLint plugin${selectedPlugins.length === 1 ? '' : 's'} since ${EARLIEST_RELEASE_DATE.slice(0, 10)}...`,
);

const limit = pLimit(CONCURRENCY);
const results = await Promise.allSettled(
  collections.map((collection) =>
    limit(async () => {
      const result = await collectVersion(collection, force);
      console.log(
        `${result.cached ? 'Cached ' : 'Wrote  '} ${collection.plugin.packageName}@${collection.release.version}: ${result.count} rules`,
      );
    }),
  ),
);

const failures = results.flatMap((result, index) =>
  result.status === 'rejected' ? [{ error: result.reason, collection: collections[index]! }] : [],
);
for (const { collection, error } of failures) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n${collection.plugin.packageName}@${collection.release.version}: ${message}`);
}
if (failures.length > 0) {
  throw new Error(`Failed to collect ${failures.length} plugin release${failures.length === 1 ? '' : 's'}`);
}
