import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom", // needed for metadata-extractor DOM tests
    globals: true,
    include: ["shared/__tests__/**/*.test.ts", "content-scripts/**/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["shared/**/*.ts", "content-scripts/**/*.ts"],
      exclude: ["**/__tests__/**", "**/*.d.ts"],
    },
  },
});
