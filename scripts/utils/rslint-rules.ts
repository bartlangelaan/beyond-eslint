export interface RslintRule {
  name: string;
  category: string;
  url: string;
  recommended: boolean;
  eslintRules: string[];
}

export function parseRslintTypes(source: string, recommendedRules: Set<string>): RslintRule[] {
  const rules: RslintRule[] = [];
  const pattern = /\/\*\*([\s\S]*?)\*\/\s+(?:"([^"]+)"|([A-Za-z][\w-]*))\??:\s*RuleEntry</g;

  for (const match of source.matchAll(pattern)) {
    const name = match[2] ?? match[3];
    const url = (match[1] ?? '').match(/@see\s+(https:\/\/rslint\.rs\/rules\/[^\s*]+)/)?.[1];
    if (!name || !url) continue;
    rules.push({
      name,
      category: name.includes('/') ? name.slice(0, name.lastIndexOf('/')) : 'eslint',
      url,
      recommended: recommendedRules.has(name),
      eslintRules: [canonicalEslintRule(name)],
    });
  }

  if (rules.length === 0) throw new Error('RSLint types contained no rules');
  return rules.sort((a, b) => a.name.localeCompare(b.name));
}

function canonicalEslintRule(name: string): string {
  if (name.startsWith('@') || name.includes('/')) return name;
  return `eslint/${name}`;
}
