import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { include: ["tests/unit/**/*.test.ts"] },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // "server-only" throws outside Next.js server code; it is a no-op in tests
      "server-only": path.resolve(__dirname, "tests/unit/empty.ts"),
    },
  },
});
