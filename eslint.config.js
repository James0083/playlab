// 규칙의 이유와 예시는 CONVENTIONS.md에 있다. 여기에는 도구로 강제할 수 있는 것만 둔다.
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/', '**/.wrangler/', '**/node_modules/'] },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },

  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-floating-promises': [
        'error',
        // node:test의 test()는 Promise를 반환하지만 러너가 직접 기다린다
        { allowForKnownSafeCalls: [{ from: 'package', name: 'test', package: 'node:test' }] },
      ],
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'typeLike', format: ['PascalCase'] },
        { selector: 'variable', format: ['camelCase', 'UPPER_CASE', 'PascalCase'] },
        { selector: 'function', format: ['camelCase', 'PascalCase'] },
      ],
    },
  },

  // 읽기 쉬운 코드를 위한 공통 규칙
  {
    rules: {
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['error', { allow: ['error', 'warn'] }],
      'no-nested-ternary': 'error',
      'max-params': ['error', 3],
      'max-depth': ['error', 3],
      complexity: ['warn', 10],
      'max-lines': ['warn', { max: 300, skipBlankLines: true, skipComments: true }],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportDefaultDeclaration',
          message: 'named export를 쓴다 (CONVENTIONS.md "export")',
        },
      ],
    },
  },

  // 도구 설정 파일과 Worker 진입점은 default export가 필요하다
  {
    files: ['**/*.config.{js,ts}', '**/worker.js'],
    rules: { 'no-restricted-syntax': 'off' },
  },

  // 터미널에서 실행하는 스크립트는 진행 상황을 출력해야 한다
  {
    files: ['scripts/**', '**/scripts/**'],
    rules: { 'no-console': 'off' },
  },

  // TS 프로젝트(tsconfig include)에 속하지 않는 JS·설정 파일은 타입 기반 규칙을 끈다
  { files: ['**/*.{js,mjs}', '**/*.config.ts'], ...tseslint.configs.disableTypeChecked },

  prettier,
);
