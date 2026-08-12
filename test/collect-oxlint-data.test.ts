import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseBulletList,
  parseJsonFormat,
  parseMarkdownTable,
} from '../scripts/utils/oxlint-rules.ts';
import { isStableVersion, parseStableReleases } from '../scripts/utils/releases.ts';

test('preserves every field in JSON rule output', () => {
  const rules = parseJsonFormat(`[
    {
      "scope": "eslint",
      "value": "no-debugger",
      "category": "correctness",
      "type_aware": false,
      "fix": "fix",
      "default": true,
      "docs_url": "https://example.test/no-debugger"
    }
  ]`);

  assert.deepEqual(rules, [
    {
      scope: 'eslint',
      value: 'no-debugger',
      category: 'correctness',
      type_aware: false,
      fix: 'fix',
      default: true,
      docs_url: 'https://example.test/no-debugger',
    },
  ]);
});

test('parses legacy Markdown tables', () => {
  const rules = parseMarkdownTable(`## Correctness (2):
| Rule name       | Source     |
| --------------- | ---------- |
| no-debugger     | eslint     |
| no-explicit-any | typescript |`);

  assert.deepEqual(rules, [
    { scope: 'eslint', value: 'no-debugger', category: 'correctness' },
    { scope: 'typescript', value: 'no-explicit-any', category: 'correctness' },
  ]);
});

test('parses legacy bullet lists', () => {
  const rules = parseBulletList(`Correctness (1):
• eslint/no-debugger
Style (1):
- unicorn/filename-case`);

  assert.deepEqual(rules, [
    { scope: 'eslint', value: 'no-debugger', category: 'correctness' },
    { scope: 'unicorn', value: 'filename-case', category: 'style' },
  ]);
});

test('only accepts stable semantic versions', () => {
  assert.equal(isStableVersion('1.78.0'), true);
  assert.equal(isStableVersion('1.79.0-alpha.0'), false);
  assert.deepEqual(
    parseStableReleases(
      JSON.stringify({
        created: '2023-01-01T00:00:00.000Z',
        '1.78.0': '2026-08-10T10:47:19.210Z',
        '1.79.0-alpha.0': '2026-08-11T10:47:19.210Z',
      }),
    ),
    [{ version: '1.78.0', date: '2026-08-10T10:47:19.210Z' }],
  );
});
