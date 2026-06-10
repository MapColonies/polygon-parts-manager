import jestConfig from '@map-colonies/eslint-config/jest';
import tsBaseConfig from '@map-colonies/eslint-config/ts-base';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig(
  jestConfig,
  tsBaseConfig,
  globalIgnores(['dist', 'coverage', 'reports', 'helm', 'bundledApi.yaml', 'src/db/**', 'dataSource.ts', '**/*.js', '**/*.mjs'])
);
