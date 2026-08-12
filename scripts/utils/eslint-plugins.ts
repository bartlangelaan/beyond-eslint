export interface EslintPlugin {
  docsUrl: string;
  id: string;
  packageName: string;
  runtimePackages?: string[];
}

/**
 * ESLint packages represented by oxlint scopes. Some oxlint scopes combine
 * multiple packages, so each npm package gets its own release history here.
 */
export const eslintPlugins: EslintPlugin[] = [
  {
    id: 'eslint-plugin-typescript',
    packageName: '@typescript-eslint/eslint-plugin',
    docsUrl: 'https://typescript-eslint.io/rules/{name}/',
    runtimePackages: ['@typescript-eslint/types@{version}', 'typescript@5.3.3'],
  },
  {
    id: 'eslint-plugin-unicorn',
    packageName: 'eslint-plugin-unicorn',
    docsUrl:
      'https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/{name}.md',
  },
  {
    id: 'eslint-plugin-react',
    packageName: 'eslint-plugin-react',
    docsUrl: 'https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/{name}.md',
  },
  {
    id: 'eslint-plugin-react-hooks',
    packageName: 'eslint-plugin-react-hooks',
    docsUrl: 'https://react.dev/reference/eslint-plugin-react-hooks/lints/{name}',
  },
  {
    id: 'eslint-plugin-react-refresh',
    packageName: 'eslint-plugin-react-refresh',
    docsUrl: 'https://github.com/ArnaudBarre/eslint-plugin-react-refresh#readme',
  },
  {
    id: 'eslint-plugin-import',
    packageName: 'eslint-plugin-import',
    docsUrl:
      'https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/{name}.md',
  },
  {
    id: 'eslint-plugin-import-x',
    packageName: 'eslint-plugin-import-x',
    docsUrl: 'https://github.com/un-ts/eslint-plugin-import-x/blob/master/docs/rules/{name}.md',
    runtimePackages: ['enhanced-resolve', 'tslib'],
  },
  {
    id: 'eslint-plugin-jsdoc',
    packageName: 'eslint-plugin-jsdoc',
    docsUrl: 'https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/{name}.md',
    runtimePackages: ['espree', 'to-valid-identifier'],
  },
  {
    id: 'eslint-plugin-jest',
    packageName: 'eslint-plugin-jest',
    docsUrl:
      'https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/{name}.md',
  },
  {
    id: 'eslint-plugin-vitest',
    packageName: '@vitest/eslint-plugin',
    docsUrl: 'https://github.com/vitest-dev/eslint-plugin-vitest/blob/main/docs/rules/{name}.md',
    runtimePackages: ['@typescript-eslint/utils@8.18.0', 'typescript@5.3.3'],
  },
  {
    id: 'eslint-plugin-jsx-a11y',
    packageName: 'eslint-plugin-jsx-a11y',
    docsUrl:
      'https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/{name}.md',
  },
  {
    id: 'eslint-plugin-nextjs',
    packageName: '@next/eslint-plugin-next',
    docsUrl: 'https://nextjs.org/docs/messages/{name}',
  },
  {
    id: 'eslint-plugin-react-perf',
    packageName: 'eslint-plugin-react-perf',
    docsUrl: 'https://github.com/cvazac/eslint-plugin-react-perf#readme',
  },
  {
    id: 'eslint-plugin-promise',
    packageName: 'eslint-plugin-promise',
    docsUrl:
      'https://github.com/eslint-community/eslint-plugin-promise/blob/main/docs/rules/{name}.md',
  },
  {
    id: 'eslint-plugin-node',
    packageName: 'eslint-plugin-n',
    docsUrl: 'https://github.com/eslint-community/eslint-plugin-n/blob/master/docs/rules/{name}.md',
  },
  {
    id: 'eslint-plugin-vue',
    packageName: 'eslint-plugin-vue',
    docsUrl: 'https://eslint.vuejs.org/rules/{name}.html',
  },
];
