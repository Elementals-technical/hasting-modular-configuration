#!/usr/bin/env node
// Fixtures for ai-env.mjs in a throwaway git repository (OS temp dir) with its own backup store.
// Nothing in the real repository or the real store is touched. Exit 1 on any failure.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const AI_ENV = path.join(here, "ai-env.mjs");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ai-env-test-"));
const repo = path.join(tmp, "repo");
const store = path.join(tmp, "store");
let failures = 0;
let checks = 0;

const sh = (cmd, args) => spawnSync(cmd, args, { cwd: repo, encoding: "utf8" });
const git = (...args) => {
  const r = sh("git", args);
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout;
};
const env = (...args) => spawnSync(process.execPath, [AI_ENV, ...args], { cwd: repo, encoding: "utf8", env: { ...process.env, AI_ENV_STORE: store } });
const write = (rel, text) => {
  fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true });
  fs.writeFileSync(path.join(repo, rel), text);
};
const read = (rel) => fs.readFileSync(path.join(repo, rel), "utf8");
const expect = (name, cond, detail = "") => {
  checks++;
  if (!cond) {
    failures++;
    console.log(`FAIL ${name}${detail ? `: ${detail}` : ""}`);
  }
};

try {
  fs.mkdirSync(repo);
  git("init", "-q", "-b", "main");
  git("config", "user.email", "fixture@example.invalid");
  git("config", "user.name", "fixture");
  write("README.md", "fixture\n");
  write(".gitignore", "/AGENTS.local.md\n/CLAUDE.local.md\n.claude/settings.local.json\n.codex/config.toml\n.codex/rules/\n");
  git("add", "-A");
  git("commit", "-q", "-m", "init");
  write("AGENTS.local.md", "# personal root v1\n");
  write("CLAUDE.local.md", "@AGENTS.local.md\n");
  write(".claude/settings.local.json", "{\"hooks\":{}}\n");
  write(".codex/rules/personal.rules", "# rules v1\n");

  // list
  let r = env("list");
  expect("list exits 0", r.status === 0, r.stderr);
  expect("list counts personal files", /personal files now: [45]/.test(r.stdout), r.stdout);

  // snapshot / verify / restore
  r = env("snapshot", "fixture");
  expect("snapshot exits 0", r.status === 0, r.stderr);
  expect("verify ok right after snapshot", env("verify").status === 0);
  write("AGENTS.local.md", "# personal root v2 (accidentally overwritten)\n");
  fs.rmSync(path.join(repo, ".codex/rules/personal.rules"));
  r = env("verify");
  expect("verify detects change and loss", r.status === 1 && /changed\s+AGENTS\.local\.md/.test(r.stdout) && /missing\s+\.codex\/rules\/personal\.rules/.test(r.stdout), r.stdout);
  r = env("restore", "latest");
  expect("restore exits 0", r.status === 0, r.stdout);
  expect("restore brings content back", read("AGENTS.local.md") === "# personal root v1\n" && read(".codex/rules/personal.rules") === "# rules v1\n");
  expect("verify ok after restore", env("verify").status === 0);
  r = env("restore", "latest", ".codex/rules");
  expect("restore accepts a path prefix", r.status === 0 && /1 restored/.test(r.stdout), r.stdout);

  // collisions: a remote-style ref starts tracking a personal path
  expect("no collisions initially", env("collisions", "--ref", "main").status === 0);
  git("switch", "-q", "-c", "team-change");
  write("AGENTS.local.md", "# team version\n");
  git("add", "-f", "AGENTS.local.md");
  git("commit", "-q", "-m", "team tracks AGENTS.local.md");
  git("update-ref", "refs/remotes/origin/phase-2/staging", "HEAD");
  git("switch", "-q", "main");
  write("AGENTS.local.md", "# personal root v1\n");
  r = env("collisions");
  expect("collision reported for default ref origin/phase-2/staging", r.status === 1 && /origin\/phase-2\/staging: AGENTS\.local\.md/.test(r.stdout), r.stdout);
  expect("collision reported with --all-remotes", env("collisions", "--all-remotes").status === 1);

  // restore refuses a path that became tracked
  git("switch", "-q", "team-change");
  r = env("restore", "latest", "AGENTS.local.md");
  expect("restore refuses tracked path", r.status === 1 && /refused\s+AGENTS\.local\.md/.test(r.stdout) && read("AGENTS.local.md") === "# team version\n", r.stdout);
  r = env("collisions", "--ref", "main");
  expect("collision reported when the index tracks a personal path", r.status === 1 && /index: AGENTS\.local\.md/.test(r.stdout), r.stdout);
} catch (e) {
  failures++;
  console.log(`FAIL fixture setup: ${e.message}`);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(`test-tooling: ${failures ? `${failures} of ${checks} failed` : `all ${checks} checks passed`}`);
process.exit(failures ? 1 : 0);
