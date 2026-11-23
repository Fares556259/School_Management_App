
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nextJest = require("next/jest");

const createJestConfig = nextJest({
  dir: "./",
});

const customJestConfig = {
  // Load test environment variables before test files
  setupFiles: ["<rootDir>/jest.env.setup.js"],

  // Keep your existing setup
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],

  testEnvironment: "jest-environment-jsdom",

  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },

  collectCoverage: true,
  collectCoverageFrom: [
    "app/**/*.{js,jsx,ts,tsx}",
    "src/**/*.{js,jsx,ts,tsx}",
    "!**/*.d.ts",
    "!**/node_modules/**",
    "!**/vendor/**",
  ],

  coverageDirectory: "coverage",

  coveragePathIgnorePatterns: [
    "/node_modules/",
    "/coverage",
    "scripts/",
    "package.json",
    "package-lock.json",
    "reportWebVitals.ts",
    "setup.ts",
    "index.tsx",
  ],

  testPathIgnorePatterns: [
    "<rootDir>/.next/",
    "<rootDir>/node_modules/",
    "<rootDir>/src/__tests__/integrations/helpers/",
    "<rootdir>/scripts/",
  ],
};

module.exports = createJestConfig(customJestConfig);
