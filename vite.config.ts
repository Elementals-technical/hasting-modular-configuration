import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";

// https://vite.dev/config/
export default defineConfig({
  envPrefix: ["VITE_", "REACT_APP_"],
  plugins: [
    react(),
    svgr({
      include: "**/*.svg?react",
      svgrOptions: {
        plugins: ["@svgr/plugin-svgo", "@svgr/plugin-jsx"],
        svgoConfig: {
          plugins: [
            {
              name: "preset-default",
              params: { overrides: { removeViewBox: false } },
            },
            "convertColors",
            "prefixIds",
          ],
        },
      },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  preview: {
    allowedHosts: [
      "hasting-modular-configuration-v3aur.ondigitalocean.app",
      "hastings-modular.vivid3d.tech",
      "hasting-modular-phase-2-p98qb.ondigitalocean.app",
      "hasting-modular-phase-2-staging-ar3wz.ondigitalocean.app",
    ],
  },
});
