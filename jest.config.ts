import nextJest from "next/jest.js";
import type { Config } from "jest";

const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  clearMocks: true,
  collectCoverageFrom: ["src/lib/**/*.ts", "src/lib/**/*.tsx", "src/app/api/**/*.ts"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testEnvironment: "jsdom",
  testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/e2e/"],
};

export default createJestConfig(config);
