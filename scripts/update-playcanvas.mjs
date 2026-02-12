#!/usr/bin/env node

/**
 * Cache-busting script for PlayCanvas builds.
 *
 * Run this every time you replace the PlayCanvas build in
 * public/HastingCabinetsParametrization/:
 *
 *   npm run update-playcanvas
 *
 * What it does:
 *  1. Generates a unique version string (Unix timestamp).
 *  2. Injects  ?v=<version>  into every  src / href  in the PlayCanvas index.html
 *     so the browser fetches fresh copies of JS, CSS, and other resources.
 *  3. Patches dynamic  import('./esm-*.js')  calls inside js/index.mjs so the
 *     chunked ESM bundle is also cache-busted.
 *  4. Writes a tiny JSON file (playcanvas-version.json) that the React app reads
 *     to append the same version to the iframe src.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const PC_DIR = resolve(ROOT, "public/HastingCabinetsParametrization");

const version = Date.now().toString(36); // compact, unique per run

console.log(`\n🎮 Updating PlayCanvas cache-bust version → ${version}\n`);

// ---------------------------------------------------------------------------
// 1. Patch index.html — add ?v= to src and href attributes
// ---------------------------------------------------------------------------
const indexHtmlPath = resolve(PC_DIR, "index.html");
let html = readFileSync(indexHtmlPath, "utf-8");

// Remove any previous ?v= params we may have injected
html = html.replace(/(\?v=[a-z0-9]+)/gi, "");

// Add ?v= to <script src="..."> and <link href="...">
html = html.replace(
  /(<script[^>]+src=["'])([^"']+)(["'])/g,
  `$1$2?v=${version}$3`,
);
html = html.replace(
  /(<link[^>]+href=["'])([^"']+\.css)(["'])/g,
  `$1$2?v=${version}$3`,
);

writeFileSync(indexHtmlPath, html, "utf-8");
console.log("  ✅ index.html — patched src/href references");

// ---------------------------------------------------------------------------
// 2. Patch js/index.mjs — cache-bust dynamic import() calls
// ---------------------------------------------------------------------------
const indexMjsPath = resolve(PC_DIR, "js/index.mjs");
let mjs = readFileSync(indexMjsPath, "utf-8");

// Remove previous cache-bust params from imports
mjs = mjs.replace(/(import\(['"])([^'"]+?)(\?v=[a-z0-9]+)?(['"]\))/g, `$1$2?v=${version}$4`);

writeFileSync(indexMjsPath, mjs, "utf-8");
console.log("  ✅ js/index.mjs — patched dynamic imports");

// ---------------------------------------------------------------------------
// 3. Patch js/esm-*.js — cache-bust any import() or fetch() inside the chunk
// ---------------------------------------------------------------------------
const jsDir = resolve(PC_DIR, "js");
const esmFiles = readdirSync(jsDir).filter(
  (f) => f.startsWith("esm-") && f.endsWith(".js"),
);

for (const file of esmFiles) {
  const filePath = resolve(jsDir, file);
  let content = readFileSync(filePath, "utf-8");

  // Bust import() calls
  content = content.replace(
    /(import\(['"])([^'"]+?)(\?v=[a-z0-9]+)?(['"]\))/g,
    `$1$2?v=${version}$4`,
  );

  writeFileSync(filePath, content, "utf-8");
  console.log(`  ✅ js/${file} — patched`);
}

// ---------------------------------------------------------------------------
// 4. Patch config.json — cache-bust __game-scripts.js and other asset URLs
// ---------------------------------------------------------------------------
const configJsonPath = resolve(PC_DIR, "config.json");
if (existsSync(configJsonPath)) {
  let configContent = readFileSync(configJsonPath, "utf-8");

  // Remove previous cache-bust params
  configContent = configContent.replace(/(\?v=[a-z0-9]+)/gi, "");

  // Add version to __game-scripts.js URL
  configContent = configContent.replace(
    /"url"\s*:\s*"__game-scripts\.js"/g,
    `"url":"__game-scripts.js?v=${version}"`,
  );

  // Add version to scene JSON files (e.g., 2406008.json)
  configContent = configContent.replace(
    /"url"\s*:\s*"(\d+\.json)"/g,
    `"url":"$1?v=${version}"`,
  );

  writeFileSync(configJsonPath, configContent, "utf-8");
  console.log("  ✅ config.json — patched asset URLs");
}

// ---------------------------------------------------------------------------
// 5. Patch scene JSON files (*.json in root) — cache-bust internal refs
// ---------------------------------------------------------------------------
const sceneFiles = readdirSync(PC_DIR).filter(
  (f) => /^\d+\.json$/.test(f),
);

for (const file of sceneFiles) {
  const filePath = resolve(PC_DIR, file);
  let content = readFileSync(filePath, "utf-8");

  // Remove previous cache-bust params
  content = content.replace(/(\?v=[a-z0-9]+)/gi, "");

  writeFileSync(filePath, content, "utf-8");
  console.log(`  ✅ ${file} — cleaned`);
}

// ---------------------------------------------------------------------------
// 6. Write version JSON so the React app can read it at build time
// ---------------------------------------------------------------------------
const versionFilePath = resolve(ROOT, "public/playcanvas-version.json");
writeFileSync(
  versionFilePath,
  JSON.stringify({ version, updatedAt: new Date().toISOString() }, null, 2) + "\n",
  "utf-8",
);
console.log("  ✅ playcanvas-version.json — written");

console.log(`\n🎉 Done! PlayCanvas build is now cache-busted (v=${version})\n`);
