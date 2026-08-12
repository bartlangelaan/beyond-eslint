import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseBiomeEslintMappings,
  parseBiomeExplanation,
} from '../scripts/utils/biome-rules.ts';

test('parses Biome explanations and ESLint source mappings', () => {
  assert.deepEqual(
    parseBiomeExplanation(`- Fix: unsafe\n- This rule is recommended\n`),
    { fix: 'unsafe', recommended: true },
  );

  const mappings = parseBiomeEslintMappings(`
### ESLint
| ESLint rule name | Biome rule name |
| ---- | ---- |
| [no-debugger](https://eslint.org/rules/no-debugger) |[noDebugger](/linter/rules/no-debugger) |
### typescript-eslint
| typescript-eslint rule name | Biome rule name |
| ---- | ---- |
| [no-explicit-any](https://typescript-eslint.io/rules/no-explicit-any) |[noExplicitAny](/linter/rules/no-explicit-any) |
`);

  assert.deepEqual(mappings.get('noDebugger'), ['eslint/no-debugger']);
  assert.deepEqual(mappings.get('noExplicitAny'), ['@typescript-eslint/no-explicit-any']);
});
