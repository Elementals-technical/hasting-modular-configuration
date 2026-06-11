import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Pure TS domain tests — no DOM needed.
    environment: "node",
    include: ["src/**/__tests__/**/*.test.{ts,tsx}"],
  },
});
