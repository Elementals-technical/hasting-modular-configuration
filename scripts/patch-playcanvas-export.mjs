#!/usr/bin/env node
/**
 * After replacing the PlayCanvas export in public/HastingCabinetsParametrization, run `npm run pc:patch-export`:
 * it adds the local bridge (public/pc-local-bridge.mjs) to the export's index.html, before js/index.mjs.
 * Idempotent: an index.html that already has it is left as it is.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.resolve(root, process.argv[2] ?? 'public/HastingCabinetsParametrization/index.html');
const BRIDGE = '<script type="module" src="../pc-local-bridge.mjs"></script>';
const ENTRY = /^(\s*)<script type=['"]module['"] src=['"]js\/index\.mjs['"]><\/script>/m;

const html = fs.readFileSync(file, 'utf8');
if (html.includes('pc-local-bridge.mjs')) {
    console.log(`[pc:patch-export] already patched: ${path.relative(root, file)}`);
    process.exit(0);
}
const match = ENTRY.exec(html);
if (!match) {
    console.error(`[pc:patch-export] no <script type="module" src="js/index.mjs"> in ${file} — not a PlayCanvas ESM export?`);
    process.exit(1);
}
const indent = match[1];
const patched = html.replace(ENTRY, `${indent}<!-- ?local=true: PlayCanvas scripts from the local server (pc-local-bridge.mjs) -->\n${indent}${BRIDGE}\n${match[0]}`);
fs.writeFileSync(file, patched);
console.log(`[pc:patch-export] bridge added: ${path.relative(root, file)}`);
