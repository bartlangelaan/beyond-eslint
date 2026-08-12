import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { parseRslintTypes } from './rslint-rules.ts';
import { pnpxPackageDirectory } from './pnpx-package.ts';

const packageDirectory = pnpxPackageDirectory('@rslint/core');
const source = await readFile(join(packageDirectory, 'dist/index.d.ts'), 'utf8');
const module = (await import(pathToFileURL(join(packageDirectory, 'dist/index.js')).href)) as Record<
  string,
  unknown
>;

process.stdout.write(JSON.stringify(parseRslintTypes(source, collectRecommendedRules(module))));

function collectRecommendedRules(module: Record<string, unknown>): Set<string> {
  const result = new Set<string>();
  const seen = new Set<unknown>();

  function visit(value: unknown, insideConfig = false): void {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      for (const item of value) visit(item, insideConfig);
      return;
    }

    const object = value as Record<string, unknown>;
    if (insideConfig && object.rules && typeof object.rules === 'object') {
      for (const [name, setting] of Object.entries(object.rules as Record<string, unknown>)) {
        const severity = Array.isArray(setting) ? setting[0] : setting;
        if (severity !== 'off' && severity !== 0) result.add(name);
      }
    }
    for (const [key, child] of Object.entries(object)) {
      visit(child, insideConfig || key.toLowerCase().includes('recommended'));
    }
  }

  visit(module);
  return result;
}
