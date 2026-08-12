export interface BiomeRule {
  name: string;
  category: string;
  url: string;
  recommended?: boolean;
  fix?: 'none' | 'safe' | 'unsafe';
  eslintRules?: string[];
}

interface SchemaNode {
  $ref?: string;
  anyOf?: SchemaNode[];
  description?: string;
  properties?: Record<string, SchemaNode>;
}

interface Schema extends SchemaNode {
  $defs?: Record<string, SchemaNode>;
  definitions?: Record<string, SchemaNode>;
}

export function parseBiomeSchema(schema: Schema): BiomeRule[] {
  const definitions = schema.$defs ?? schema.definitions;
  const groups = definitions?.Rules?.properties;
  if (!definitions || !groups) throw new Error('Could not find Biome rules in its schema');

  const rules: BiomeRule[] = [];
  for (const [category, group] of Object.entries(groups)) {
    const properties = referencedProperties(group, definitions);
    if (!properties || category === 'recommended' || category === 'preset') continue;

    for (const [name, rule] of Object.entries(properties)) {
      if (name === 'all' || name === 'preset' || name === 'recommended') continue;
      const url =
        rule.description?.match(/https:\/\/biomejs\.dev\/[^\s]+/)?.[0] ??
        `https://biomejs.dev/linter/rules/${camelToKebab(name)}`;
      rules.push({ name, category, url });
    }
  }

  if (rules.length === 0) throw new Error('Biome schema contained no rules');

  const unique = new Map<string, BiomeRule>();
  for (const rule of rules) {
    const existing = unique.get(rule.name);
    if (!existing || (existing.category === 'nursery' && rule.category !== 'nursery')) {
      unique.set(rule.name, rule);
    }
  }
  return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function parseBiomeExplanation(
  output: string,
): Partial<Pick<BiomeRule, 'category' | 'fix' | 'recommended'>> {
  const fix = output.match(/^- Fix:\s*(none|safe|unsafe)\s*$/m)?.[1] as
    | BiomeRule['fix']
    | undefined;
  const category = output.match(/^- Diagnostic category:\s*lint\/([^/\s]+)\//m)?.[1];
  return {
    ...(category && { category }),
    ...(fix && { fix }),
    recommended: /This rule is recommended/.test(output),
  };
}

export function parseBiomeEslintMappings(markdown: string): Map<string, string[]> {
  const mappings = new Map<string, string[]>();
  let prefix: string | null = null;

  for (const line of markdown.split('\n')) {
    const heading = line.match(/^###\s+(.+?)\s*$/)?.[1];
    if (heading) {
      prefix = eslintPrefix(heading);
      continue;
    }
    if (!prefix || !line.startsWith('|')) continue;

    const match = line.match(
      /^\|\s*\[([^\]]+)]\([^)]*\)\s*\|\s*\[([^\]]+)]\(\/linter\/rules\/[^)]*\)/,
    );
    if (!match?.[1] || !match[2] || match[1].includes('rule name')) continue;

    const rules = mappings.get(match[2]) ?? [];
    const eslintRule = `${prefix}/${match[1].trim()}`;
    if (!rules.includes(eslintRule)) rules.push(eslintRule);
    mappings.set(match[2], rules.sort());
  }

  return mappings;
}

function referencedProperties(
  node: SchemaNode,
  definitions: Record<string, SchemaNode>,
  seen = new Set<string>(),
): Record<string, SchemaNode> | undefined {
  if (node.properties) return node.properties;

  const references = [node.$ref, ...(node.anyOf?.map((candidate) => candidate.$ref) ?? [])]
    .filter((reference): reference is string => Boolean(reference))
    .map((reference) => reference.split('/').at(-1)!)
    .filter((reference) => !seen.has(reference));

  for (const reference of references) {
    seen.add(reference);
    const properties = referencedProperties(definitions[reference] ?? {}, definitions, seen);
    if (properties && Object.keys(properties).some((name) => name !== 'all')) return properties;
  }
  return undefined;
}

function eslintPrefix(heading: string): string | null {
  const prefixes: Record<string, string> = {
    '@mysticatea/eslint-plugin': '@mysticatea',
    '@next/eslint-plugin-next': '@next/next',
    ESLint: 'eslint',
    'eslint-plugin-barrel-files': 'barrel-files',
    'eslint-plugin-import': 'import',
    'eslint-plugin-jest': 'jest',
    'eslint-plugin-jsx-a11y': 'jsx-a11y',
    'eslint-plugin-n': 'n',
    'eslint-plugin-no-secrets': 'no-secrets',
    'eslint-plugin-react': 'react',
    'eslint-plugin-react-hooks': 'react-hooks',
    'eslint-plugin-react-refresh': 'react-refresh',
    'eslint-plugin-solid': 'solid',
    'eslint-plugin-sonarjs': 'sonarjs',
    'eslint-plugin-stylistic': '@stylistic',
    'eslint-plugin-unicorn': 'unicorn',
    'eslint-plugin-unused-imports': 'unused-imports',
    'typescript-eslint': '@typescript-eslint',
  };
  return prefixes[heading] ?? null;
}

function camelToKebab(value: string): string {
  return value.replaceAll(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
