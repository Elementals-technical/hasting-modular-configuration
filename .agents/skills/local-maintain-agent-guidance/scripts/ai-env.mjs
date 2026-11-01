#!/usr/bin/env node
// Backup and collision check for the files git does not protect: the personal/machine-local agent layer.
// Dependency-free Node ESM; runs from the repository root on macOS, Linux and Windows.
//
//   node ai-env.mjs list
//   node ai-env.mjs snapshot <label>
//   node ai-env.mjs verify [snapshot-id|latest]
//   node ai-env.mjs restore <snapshot-id|latest> [path-prefix ...]
//   node ai-env.mjs collisions [--ref <ref>]... [--all-remotes] [--quiet]
//
// Env: AI_ENV_STORE overrides the backup store (used by test-tooling.mjs).
// Claude reads skills through the `.claude/skills -> ../.agents/skills` symlink; nothing is generated.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SLUG = "hastings-modular-configuration";
const DEFAULT_REFS = ["origin/phase-2/staging", "origin/phase-2/production"];
// Everything here is gitignored: a checkout of a branch that still tracks one of these paths overwrites it silently.
const PERSONAL_PATHS = ["AGENTS.local.md", "CLAUDE.local.md", ".claude/settings.local.json", ".codex/config.toml", ".codex/rules"];
// Snapshotted in addition (lives inside .git).
const GIT_EXCLUDE = ".git/info/exclude";

const args = process.argv.slice(2);
const command = args[0];
const quiet = args.includes("--quiet");

function fail(message, code = 1) {
  console.error(`ai-env: ${message}`);
  process.exit(code);
}
function git(gitArgs, opts = {}) {
  return execFileSync("git", gitArgs, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 << 20, ...opts });
}
function repoRoot() {
  try { return git(["rev-parse", "--show-toplevel"]).trim(); } catch { return fail("not inside a git repository"); }
}
function storeDir() {
  if (process.env.AI_ENV_STORE) return process.env.AI_ENV_STORE;
  if (process.platform === "win32" && process.env.LOCALAPPDATA) return path.join(process.env.LOCALAPPDATA, "ai-env", SLUG);
  return path.join(os.homedir(), ".local", "share", "ai-env", SLUG);
}
const toPosix = (p) => p.split(path.sep).join("/");
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

function walk(root, rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return [];
  if (fs.statSync(abs).isFile()) return [toPosix(rel)];
  const out = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    if (entry.name === ".DS_Store") continue;
    out.push(...walk(root, path.join(rel, entry.name)));
  }
  return out;
}
function personalFiles(root) {
  const files = PERSONAL_PATHS.flatMap((p) => walk(root, p));
  if (fs.existsSync(path.join(root, GIT_EXCLUDE))) files.push(GIT_EXCLUDE);
  return [...new Set(files)].sort();
}
const isPersonalPath = (p) => PERSONAL_PATHS.some((d) => p === d || p.startsWith(`${d}/`));

// ---------- snapshot / verify / restore / list ----------

const snapshotsDir = (store) => path.join(store, "snapshots");

function resolveSnapshot(store, id) {
  let target = id;
  if (!id || id === "latest") {
    const latest = path.join(store, "LATEST");
    if (!fs.existsSync(latest)) fail("no snapshots yet; run: node ai-env.mjs snapshot <label>");
    target = fs.readFileSync(latest, "utf8").trim();
  }
  const file = path.join(snapshotsDir(store), `${target}.json`);
  if (!fs.existsSync(file)) fail(`snapshot not found: ${target}`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function cmdSnapshot(root) {
  const label = (args[1] || "").replace(/[^A-Za-z0-9._-]/g, "-");
  if (!label || label.startsWith("--")) fail("usage: snapshot <label>");
  const store = storeDir();
  fs.mkdirSync(path.join(store, "objects"), { recursive: true });
  fs.mkdirSync(snapshotsDir(store), { recursive: true });
  const files = {};
  for (const rel of personalFiles(root)) {
    const buf = fs.readFileSync(path.join(root, rel));
    const hash = sha256(buf);
    const obj = path.join(store, "objects", hash);
    if (!fs.existsSync(obj)) fs.writeFileSync(obj, buf);
    files[rel] = { sha256: hash, size: buf.length };
  }
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const id = `${stamp}-${label}`;
  let head = "";
  try { head = git(["rev-parse", "HEAD"], { cwd: root }).trim(); } catch { head = ""; }
  fs.writeFileSync(path.join(snapshotsDir(store), `${id}.json`), JSON.stringify({ id, label, created: new Date().toISOString(), head, files }, null, 2));
  fs.writeFileSync(path.join(store, "LATEST"), id);
  console.log(`snapshot ${id}: ${Object.keys(files).length} files -> ${store}`);
}

function diffAgainst(root, manifest) {
  const current = new Set(personalFiles(root));
  const missing = [], changed = [];
  for (const [rel, meta] of Object.entries(manifest.files)) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) missing.push(rel);
    else if (sha256(fs.readFileSync(abs)) !== meta.sha256) changed.push(rel);
    current.delete(rel);
  }
  return { missing, changed, added: [...current] };
}

function cmdVerify(root) {
  const manifest = resolveSnapshot(storeDir(), args[1]);
  const { missing, changed, added } = diffAgainst(root, manifest);
  for (const p of missing) console.log(`missing  ${p}`);
  for (const p of changed) console.log(`changed  ${p}`);
  for (const p of added) console.log(`added    ${p}`);
  const ok = missing.length === 0 && changed.length === 0;
  console.log(`verify ${manifest.id}: ${ok ? "ok" : "DIFFERS"} (missing ${missing.length}, changed ${changed.length}, added ${added.length})`);
  process.exit(ok ? 0 : 1);
}

function isTracked(root, rel) {
  try { git(["ls-files", "--error-unmatch", "--", rel], { cwd: root }); return true; } catch { return false; }
}

function cmdRestore(root) {
  const store = storeDir();
  const manifest = resolveSnapshot(store, args[1]);
  const prefixes = args.slice(2).filter((a) => !a.startsWith("--")).map(toPosix);
  let restored = 0, refused = 0;
  for (const [rel, meta] of Object.entries(manifest.files)) {
    if (prefixes.length && !prefixes.some((p) => rel === p || rel.startsWith(`${p.replace(/\/$/, "")}/`))) continue;
    if (rel !== GIT_EXCLUDE && isTracked(root, rel)) {
      console.log(`refused  ${rel} (now tracked by git; move personal content to a non-colliding path)`);
      refused++;
      continue;
    }
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.copyFileSync(path.join(store, "objects", meta.sha256), abs);
    restored++;
  }
  console.log(`restore ${manifest.id}: ${restored} restored, ${refused} refused`);
  process.exit(refused ? 1 : 0);
}

function cmdList(root) {
  const store = storeDir();
  console.log(`store: ${store}`);
  const dir = snapshotsDir(store);
  const ids = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort() : [];
  const latest = fs.existsSync(path.join(store, "LATEST")) ? fs.readFileSync(path.join(store, "LATEST"), "utf8").trim() : "";
  for (const f of ids) console.log(`${f.replace(/\.json$/, "") === latest ? "*" : " "} ${f.replace(/\.json$/, "")}`);
  console.log(`personal files now: ${personalFiles(root).length}`);
  for (const d of PERSONAL_PATHS) console.log(`  ${fs.existsSync(path.join(root, d)) ? "present" : "absent "} ${d}`);
}

// ---------- collisions: an incoming ref starts tracking a personal path ----------

function refExists(root, ref) {
  try { git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], { cwd: root }); return true; } catch { return false; }
}

function cmdCollisions(root) {
  let refs = [];
  for (let i = 1; i < args.length; i++) if (args[i] === "--ref" && args[i + 1]) refs.push(args[++i]);
  if (args.includes("--all-remotes")) {
    refs = git(["for-each-ref", "--format=%(refname:short)", "refs/remotes"], { cwd: root }).split("\n").map((s) => s.trim()).filter((r) => r && !r.endsWith("/HEAD"));
  }
  if (!refs.length) refs = [...DEFAULT_REFS];
  try {
    const upstream = git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], { cwd: root }).trim();
    if (upstream && !refs.includes(upstream) && !args.includes("--all-remotes")) refs.push(upstream);
  } catch { /* no upstream configured */ }
  const hits = [];
  for (const p of git(["ls-files", "--", ...PERSONAL_PATHS], { cwd: root }).split("\n").filter(Boolean)) hits.push(`index: ${p}`);
  const skipped = [];
  for (const ref of refs) {
    if (!refExists(root, ref)) { skipped.push(ref); continue; }
    for (const p of git(["ls-tree", "-r", "--name-only", ref, "--", ...PERSONAL_PATHS], { cwd: root }).split("\n").filter(Boolean)) if (isPersonalPath(p)) hits.push(`${ref}: ${p}`);
  }
  if (skipped.length && !quiet) console.log(`skipped missing refs: ${skipped.join(", ")}`);
  if (hits.length) {
    console.log(`collisions: ${hits.length}`);
    for (const h of [...new Set(hits)]) console.log(`  ${h}`);
    process.exit(1);
  }
  if (!quiet) console.log(`collisions: none (${refs.length - skipped.length} refs checked)`);
}

const root = repoRoot();
const commands = { list: cmdList, snapshot: cmdSnapshot, verify: cmdVerify, restore: cmdRestore, collisions: cmdCollisions };
if (!commands[command]) fail("usage: ai-env.mjs list|snapshot <label>|verify [id]|restore <id> [paths]|collisions [--ref r] [--all-remotes] [--quiet]", 2);
commands[command](root);
