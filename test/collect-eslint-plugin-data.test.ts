import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeRuleMetadata } from '../scripts/utils/eslint-rule-metadata.ts';

test('normalizes relevant ESLint rule metadata', () => {
  assert.deepEqual(
    normalizeRuleMetadata(
      'sample-rule',
      {
        meta: {
          deprecated: { replacedBy: ['replacement'] },
          docs: { recommended: { recommended: false, strict: true } },
          fixable: 'code',
          hasSuggestions: true,
          type: 'suggestion',
        },
      },
      'https://example.test/{name}',
    ),
    {
      name: 'sample-rule',
      deprecated: true,
      recommended: true,
      type: 'suggestion',
      url: 'https://example.test/sample-rule',
      fixable: true,
      hasSuggestions: true,
    },
  );
});
