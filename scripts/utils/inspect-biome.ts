import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { execa } from 'execa';
import pLimit from 'p-limit';

import { parseBiomeExplanation, parseBiomeSchema } from './biome-rules.ts';
import { pnpxPackageDirectory } from './pnpx-package.ts';

const packageDirectory = pnpxPackageDirectory('@biomejs/biome');
const schema = JSON.parse(await readFile(join(packageDirectory, 'configuration_schema.json'), 'utf8'));
let rules = parseBiomeSchema(schema);

const binary = join(packageDirectory, 'bin/biome');
const probe = await execa(binary, ['explain', rules[0]!.name], { reject: false });
if (!probe.failed) {
  const limit = pLimit(8);
  rules = await Promise.all(
    rules.map((rule, index) =>
      limit(async () => {
        const result =
          index === 0
            ? probe
            : await execa(binary, ['explain', rule.name], { reject: false, timeout: 30_000 });
        return result.failed ? rule : { ...rule, ...parseBiomeExplanation(result.stdout) };
      }),
    ),
  );
}

process.stdout.write(JSON.stringify(rules));
