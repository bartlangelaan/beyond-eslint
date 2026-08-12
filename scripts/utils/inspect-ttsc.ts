import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { parseTtscGoSources, parseTtscTypes } from './ttsc-rules.ts';
import { pnpxPackageDirectory } from './pnpx-package.ts';

const packageDirectory = pnpxPackageDirectory('@ttsc/lint');
const rulesDirectory = join(packageDirectory, 'src/structures/rules');
const typeFiles = existsSync(rulesDirectory)
  ? (await readdir(rulesDirectory)).filter((file) => /Rules\.ts$/.test(file))
  : [];

const rules =
  typeFiles.length > 0
    ? parseTtscTypes(
        await Promise.all(typeFiles.map((file) => readFile(join(rulesDirectory, file), 'utf8'))),
      )
    : await parseGoRules();

process.stdout.write(JSON.stringify(rules));

async function parseGoRules() {
  const directory = existsSync(join(packageDirectory, 'linthost'))
    ? join(packageDirectory, 'linthost')
    : join(packageDirectory, 'plugin');
  const files = (await readdir(directory)).filter((file) => file.endsWith('.go'));
  return parseTtscGoSources(
    await Promise.all(
      files.map(async (file) => ({ path: file, source: await readFile(join(directory, file), 'utf8') })),
    ),
  );
}
