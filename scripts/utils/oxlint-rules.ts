export interface OxlintRule {
  scope: string;
  value: string;
  category?: string;
  [key: string]: unknown;
}

function categoryName(value: string): string {
  return value.trim().toLowerCase().replaceAll(/\s+/g, '-');
}

function isOxlintRule(value: unknown): value is OxlintRule {
  if (typeof value !== 'object' || value === null) return false;
  const rule = value as Record<string, unknown>;
  return typeof rule.scope === 'string' && typeof rule.value === 'string';
}

export function parseJsonFormat(output: string): OxlintRule[] | null {
  const trimmed = output.trim();
  if (!trimmed.startsWith('[')) return null;

  try {
    const rules: unknown = JSON.parse(trimmed);
    if (!Array.isArray(rules) || rules.length === 0 || !rules.every(isOxlintRule)) return null;
    return rules;
  } catch {
    return null;
  }
}

export function parseMarkdownTable(output: string): OxlintRule[] | null {
  const rules: OxlintRule[] = [];
  let category: string | null = null;

  for (const line of output.split('\n')) {
    const heading = line.match(/^##\s+(.+?)\s*\(\d+\):?\s*$/);
    if (heading?.[1]) {
      category = categoryName(heading[1]);
      continue;
    }
    if (!line.startsWith('|')) continue;

    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    const value = cells[0];
    const scope = cells[1];
    if (!value || !scope || value === 'Rule name' || /^-+$/.test(value)) continue;
    rules.push({ scope, value, ...(category && { category }) });
  }

  return rules.length > 0 ? rules : null;
}

export function parseBulletList(output: string): OxlintRule[] | null {
  const rules: OxlintRule[] = [];
  let category: string | null = null;

  for (const rawLine of output.split('\n')) {
    const line = rawLine.trim();
    const heading = line.match(/^(.+?)\s*\(\d+\):?\s*$/);
    if (heading?.[1]) {
      category = categoryName(heading[1]);
      continue;
    }

    const rule = line.match(/^[•-]\s*([\w.@-]+)[:/]\s*([\w./-]+)/);
    if (!rule?.[1] || !rule[2]) continue;
    rules.push({ scope: rule[1], value: rule[2], ...(category && { category }) });
  }

  return rules.length > 0 ? rules : null;
}

export function parseRules(output: string): OxlintRule[] | null {
  return parseJsonFormat(output) ?? parseMarkdownTable(output) ?? parseBulletList(output);
}
