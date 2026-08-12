import { existsSync } from 'node:fs';
import { join } from 'node:path';

export function pnpxPackageDirectory(packageName: string): string {
  const binDirectory = process.env.PATH?.split(':').find((path) => path.endsWith('/node_modules/.bin'));
  if (!binDirectory) throw new Error('Could not locate the pnpx node_modules directory');

  const nodeModulesDirectory = join(binDirectory, '..');
  const direct = join(nodeModulesDirectory, packageName);
  if (existsSync(join(direct, 'package.json'))) return direct;

  throw new Error(`Could not locate ${packageName} in the pnpx environment`);
}
