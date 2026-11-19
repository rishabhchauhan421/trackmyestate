import nextJest from "next/jest.js";

// Tests never need real secrets: `next/jest` loads next.config.js, which
// validates env vars, so skip that check (it would fail on a fresh clone).
process.env.SKIP_ENV_VALIDATION ??= "1";

const createJestConfig = nextJest({
  dir: "./",
});

/** @type {import('jest').Config} */
const config = {
  coverageProvider: "v8",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/.next/"],
  moduleNameMapper: {
    "^~/(.*)$": "<rootDir>/src/$1",
  },
};

export default createJestConfig(config);
