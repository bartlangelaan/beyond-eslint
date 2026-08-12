export interface TtscRule {
  name: string;
  category: string;
  url: string;
  fix: 'none' | 'safe';
  eslintRules?: string[];
}

export function parseTtscTypes(sources: string[]): TtscRule[] {
  const rules: TtscRule[] = [];
  const property = /\/\*\*([\s\S]*?)\*\/\s+(?:"([^"]+)"|([A-Za-z][\w-]*))\??:\s*TtscLintRule/g;

  for (const source of sources) {
    for (const match of source.matchAll(property)) {
      const comment = match[1] ?? '';
      const name = match[2] ?? match[3];
      if (!name) continue;
      const url = comment.match(/@reference\s+(https?:\/\/[^\s*]+)/)?.[1];
      const eslintRule = eslintRuleFor(name, url);
      rules.push({
        name,
        category: category(name),
        url: url ?? 'https://ttsc.dev/docs/lint/rules/',
        fix: /\bAutofixable\b/i.test(comment) ? 'safe' : 'none',
        ...(eslintRule && { eslintRules: [eslintRule] }),
      });
    }
  }

  return uniqueRules(rules);
}

export function parseTtscGoSources(sources: Array<{ path: string; source: string }>): TtscRule[] {
  const rules: TtscRule[] = [];
  const namePattern = /Name\(\) string\s*\{\s*return\s+"([^"]+)"\s*}/g;

  for (const { path, source } of sources) {
    for (const match of source.matchAll(namePattern)) {
      const name = match[1];
      if (!name) continue;
      const eslintRule = /rules_ts(?:_|\.)/.test(path)
        ? `@typescript-eslint/${name.replace(/^typescript\//, '')}`
        : name.includes('/')
          ? name
          : `eslint/${name}`;
      rules.push({
        name,
        category: category(name),
        url: eslintUrl(eslintRule),
        fix: 'none',
        eslintRules: [eslintRule],
      });
    }
  }

  if (rules.length === 0) throw new Error('TTSC package contained no discoverable rules');
  return uniqueRules(rules);
}

function eslintRuleFor(name: string, url?: string): string | undefined {
  const ruleName = name.split('/').at(-1)!;
  if (url?.includes('eslint.org/docs/')) return `eslint/${ruleName}`;
  if (url?.includes('typescript-eslint.io/')) return `@typescript-eslint/${ruleName}`;
  if (name.startsWith('typescript/')) return `@typescript-eslint/${ruleName}`;
  if (name.startsWith('nextjs/')) return `@next/next/${ruleName}`;
  if (name === 'jsdoc/tsdoc-syntax') return 'tsdoc/syntax';
  return name.includes('/') ? name : url ? `eslint/${name}` : undefined;
}

function eslintUrl(rule: string): string {
  if (rule.startsWith('eslint/')) {
    return `https://eslint.org/docs/latest/rules/${rule.slice('eslint/'.length)}`;
  }
  if (rule.startsWith('@typescript-eslint/')) {
    return `https://typescript-eslint.io/rules/${rule.slice('@typescript-eslint/'.length)}`;
  }
  return 'https://ttsc.dev/docs/lint/rules/';
}

function category(name: string): string {
  return name.includes('/') ? name.slice(0, name.lastIndexOf('/')) : 'eslint';
}

function uniqueRules(rules: TtscRule[]): TtscRule[] {
  return [...new Map(rules.map((rule) => [rule.name, rule])).values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}
