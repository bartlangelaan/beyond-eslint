export interface EslintRuleMetadata {
  deprecated: boolean;
  fixable: boolean;
  hasSuggestions: boolean;
  name: string;
  recommended: boolean;
  type: string | null;
  url: string;
}

export interface RuleDefinition {
  meta?: Record<string, unknown> & {
    deprecated?: unknown;
    docs?: Record<string, unknown> & { recommended?: unknown; url?: unknown };
    fixable?: unknown;
    hasSuggestions?: unknown;
    type?: unknown;
  };
}

export function normalizeRuleMetadata(
  name: string,
  rule: RuleDefinition,
  docsUrlTemplate: string,
): EslintRuleMetadata {
  const meta = rule.meta ?? {};
  const docs = meta.docs ?? {};
  return {
    name,
    deprecated: Boolean(meta.deprecated),
    recommended: normalizeRecommended(docs.recommended),
    type: typeof meta.type === 'string' ? meta.type : null,
    url: typeof docs.url === 'string' ? docs.url : docsUrlTemplate.replaceAll('{name}', name),
    fixable: Boolean(meta.fixable),
    hasSuggestions: Boolean(meta.hasSuggestions),
  };
}

function normalizeRecommended(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.length > 0;
  if (typeof value === 'object' && value !== null) return Object.values(value).some(Boolean);
  return false;
}
