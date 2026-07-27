import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/bin.ts"],
      reporter: ["text"],
      thresholds: {
        branches: 75,
        functions: 95,
        lines: 95,
        statements: 95,
      },
    },
  },
});
