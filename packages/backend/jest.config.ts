import type { Config } from 'jest';
import path from 'path';

// In a monorepo with npm workspaces, packages may be hoisted to the root
// node_modules. We add both the local and root node_modules to the resolver
// search paths so Jest can find ts-jest and other workspace-level packages.
const rootNodeModules = path.resolve(__dirname, '../../node_modules');
const backendNodeModules = path.resolve(__dirname, 'node_modules');

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts', '**/*.spec.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  // Include root node_modules so hoisted workspace packages (ts-jest, etc.) resolve correctly
  moduleDirectories: [backendNodeModules, rootNodeModules],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/server.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  clearMocks: true,
  restoreMocks: true,
};

export default config;
