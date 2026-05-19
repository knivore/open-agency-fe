import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import typescriptEslintPlugin from '@typescript-eslint/eslint-plugin';

const customRules = {
  name: 'project/custom-rules',
  files: ['**/*.{js,jsx,ts,tsx}'],
  plugins: {
    '@typescript-eslint': typescriptEslintPlugin,
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': 'warn',
    'react/jsx-filename-extension': ['error', { extensions: ['.tsx', '.jsx'] }],
    'react/display-name': 'warn',
    'react/no-unescaped-entities': 'warn',
    'react-hooks/refs': 'warn',
    'react-hooks/set-state-in-effect': 'warn',
  },
};

const eslintConfig = [...nextCoreWebVitals, customRules];

export default eslintConfig;
