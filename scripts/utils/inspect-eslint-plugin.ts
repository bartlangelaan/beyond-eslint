import { existsSync, readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { normalizeRuleMetadata, type RuleDefinition } from './eslint-rule-metadata.ts';

interface PluginModule {
  default?: PluginModule;
  rules?: Record<string, RuleDefinition>;
}

const [packageName, docsUrlTemplate] = process.argv.slice(2);
if (!packageName || !docsUrlTemplate) throw new Error('Expected a package name and docs URL template');

const binDir = process.env.PATH?.split(':').find((path) => path.endsWith('/node_modules/.bin'));
if (!binDir) throw new Error('Could not locate the pnpx node_modules directory');

const nodeModulesDir = join(binDir, '..');
process.env.NODE_PATH = [nodeModulesDir, process.env.NODE_PATH].filter(Boolean).join(':');
(Module as unknown as { _initPaths: () => void })._initPaths();

const requireFromDlx = createRequire(join(nodeModulesDir, 'package.json'));
const packageDir = join(nodeModulesDir, packageName);
const manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8')) as {
  exports?: unknown;
  main?: string;
  module?: string;
};
const exportedEntry = resolveExport(manifest.exports);
const preferredEntry = manifest.module ?? exportedEntry ?? manifest.main;
const preferredPath = preferredEntry ? resolve(packageDir, preferredEntry) : null;
const entryPath = preferredPath && existsSync(preferredPath) ? preferredPath : requireFromDlx.resolve(packageName);
let plugin = (await import(pathToFileURL(entryPath).href)) as PluginModule;
while (!plugin.rules && plugin.default) plugin = plugin.default;
const rules = plugin.rules;
if (!rules) throw new Error(`${packageName} does not export a rules object`);

const metadata = Object.entries(rules)
  .map(([name, rule]) => normalizeRuleMetadata(name, rule, docsUrlTemplate))
  .sort((a, b) => a.name.localeCompare(b.name));

process.stdout.write(JSON.stringify(metadata));

function resolveExport(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value !== 'object' || value === null) return undefined;

  const exports = value as Record<string, unknown>;
  return (
    resolveExport(exports['.']) ??
    resolveExport(exports.import) ??
    resolveExport(exports.default) ??
    resolveExport(exports.require)
  );
}
