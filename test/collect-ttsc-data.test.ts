import assert from 'node:assert/strict';
import test from 'node:test';

import { parseTtscTypes } from '../scripts/utils/ttsc-rules.ts';

test('extracts TTSC rules and their ESLint provenance from published typings', () => {
  const rules = parseTtscTypes([
    `/**
     * Autofixable.
     * @reference https://typescript-eslint.io/rules/no-explicit-any
     */
    "typescript/no-explicit-any"?: TtscLintRuleSetting;`,
  ]);

  assert.deepEqual(rules, [
    {
      name: 'typescript/no-explicit-any',
      category: 'typescript',
      url: 'https://typescript-eslint.io/rules/no-explicit-any',
      fix: 'safe',
      eslintRules: ['@typescript-eslint/no-explicit-any'],
    },
  ]);
});
