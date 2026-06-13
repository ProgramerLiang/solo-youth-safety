import js from '@eslint/js'
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import reactHooks from 'eslint-plugin-react-hooks'

const browserGlobals = {
  Blob: 'readonly',
  FileReader: 'readonly',
  URL: 'readonly',
  clearInterval: 'readonly',
  console: 'readonly',
  document: 'readonly',
  globalThis: 'readonly',
  localStorage: 'readonly',
  setInterval: 'readonly',
  window: 'readonly',
}

export default [
  { ignores: ['dist', 'src/**/*.js', 'src/**/*.jsx'] },
  { ...js.configs.recommended, files: ['**/*.{ts,tsx}'] },
  ...tsPlugin.configs['flat/recommended'],
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
      globals: browserGlobals,
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@mui/icons-material',
              message: '禁止 namespace 导入，请使用具名导入具体图标组件',
            },
          ],
        },
      ],
    },
  },
]