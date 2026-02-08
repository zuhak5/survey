const nextJest = require("next/jest");

const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const config = {
  clearMocks: true,
  collectCoverageFrom: ["src/lib/**/*.ts", "src/lib/**/*.tsx", "src/app/api/**/*.ts"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testEnvironment: "jsdom",
  testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/e2e/"],
};

module.exports = createJestConfig(config);

