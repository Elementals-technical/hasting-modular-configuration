import { fileURLToPath, URL } from "node:url";

import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

const imageStub = fileURLToPath(new URL("./src/test/stubs/imageStub.ts", import.meta.url));
const srcRoot = fileURLToPath(new URL("./src", import.meta.url));

const ASSET_RE = /\.(png|jpe?g|svg|webp|gif|avif)(\?.*)?$/;

// Resolve static asset imports to a stub so modules that import images (e.g. the
// preset catalog) can be loaded under the node test environment. `enforce: "pre"`
// runs this before the "@" alias, so it matches the raw `@/...png` import id.
const stubAssets = (): Plugin => ({
  name: "stub-assets",
  enforce: "pre",
  resolveId(source) {
    return ASSET_RE.test(source) ? imageStub : null;
  },
});

export default defineConfig({
  plugins: [stubAssets()],
  resolve: {
    alias: {
      "@": srcRoot,
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
