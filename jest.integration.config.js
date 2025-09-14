export default {
  preset: "ts-jest/presets/default-esm",
  extensionsToTreatAsEsm: [".ts", ".tsx"],
  testEnvironment: "node",
  testEnvironmentOptions: {
    customExportConditions: ["node", "node-addons"],
  },
  globals: {
    "ts-jest": {
      tsconfig: "tsconfig.test.json",
      useESM: true
    }
  },
  roots: ["<rootDir>/tests/integration"],
  testMatch: [
    "**/*.test.ts",
    "**/*.spec.ts"
  ],
  transform: {
    "^.+\.(ts|tsx)$": ["ts-jest", {
      useESM: true,
      tsconfig: "tsconfig.test.json"
    }]
  },
  transformIgnorePatterns: [
    "node_modules/(?\!(ethers|multiformats|uint8arrays)/)",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    // NO MOCKS FOR INTEGRATION TESTS - we want real implementations
  },
  setupFiles: [],
  setupFilesAfterEnv: [],
  testPathIgnorePatterns: [
    "/node_modules/",
    "/DePay/",
    "/source-repos/",
    "/dist/",
    "/build/"
  ],
  testTimeout: 60000, // Longer timeout for integration tests
  verbose: true,
  maxWorkers: 1, // Run integration tests serially
  bail: false,
  forceExit: true,
  detectOpenHandles: true,
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
};
