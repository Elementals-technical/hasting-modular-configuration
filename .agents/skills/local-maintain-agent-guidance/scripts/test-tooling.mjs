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
const skill = (name, desc) => `---\nname: ${name}\ndescription: ${desc}\n---\n\n# ${name}\n`;

try {
  fs.mkdirSync(repo);
  git("init", "-q", "-b", "main");
  git("config", "user.email", "fixture@example.invalid");
  git("config", "user.name", "fixture");
  write("README.md", "fixture\n");
  write("skills/team-skill/SKILL.md", skill("team-skill", "Team skill. Do not use for tests."));
  git("add", "-A");
  git("commit", "-q", "-m", "init");
  write(".git/info/exclude", "AGENTS.local.md\nCLAUDE.local.md\n.agents/skills/local-*/\n.claude/\ndocs/ai/\n");
  write("AGENTS.local.md", "# personal root v1\n");
  write("CLAUDE.local.md", "@AGENTS.local.md\n");
  write(".agents/skills/local-one/SKILL.md", skill("local-one", "Personal workflow. Do not use for anything else.\ndisable-model-invocation: true"));
  write("docs/ai/notes.md", "notes v1\n");

  // sync / check-sync
  let r = env("sync");
  expect("sync exits 0", r.status === 0, r.stderr);
  expect("wrapper for personal skill", fs.existsSync(path.join(repo, ".claude/skills/local-one/SKILL.md")));
  expect("wrapper for team skill", fs.existsSync(path.join(repo, ".claude/skills/team-skill/SKILL.md")));
  expect("wrapper copies invocation key", /disable-model-invocation: true/.test(read(".claude/skills/local-one/SKILL.md")));
  expect("wrapper points to canonical path", /\.agents\/skills\/local-one\/SKILL\.md/.test(read(".claude/skills/local-one/SKILL.md")));
  expect("check-sync ok after sync", env("check-sync").status === 0);
  write(".agents/skills/local-one/SKILL.md", skill("local-one", "Changed description. Do not use for x."));
  expect("check-sync detects stale description", env("check-sync").status === 1);
  env("sync");
  fs.rmSync(path.join(repo, ".agents/skills/local-one"), { recursive: true });
  r = env("sync");
  expect("sync removes stale generated wrapper", !fs.existsSync(path.join(repo, ".claude/skills/local-one")), r.stdout);
  write(".claude/skills/hand-made/SKILL.md", "hand written, not generated\n");
  write(".agents/skills/hand-made/SKILL.md", skill("hand-made", "x. Do not use."));
  r = env("sync");
  expect("sync refuses to overwrite a non-generated wrapper", r.status === 1 && read(".claude/skills/hand-made/SKILL.md").startsWith("hand written"));
  fs.rmSync(path.join(repo, ".agents/skills/hand-made"), { recursive: true });
  fs.rmSync(path.join(repo, ".claude/skills/hand-made"), { recursive: true });
  write(".agents/skills/local-one/SKILL.md", skill("local-one", "Personal workflow. Do not use for anything else."));
  env("sync");

  // snapshot / verify / restore
  r = env("snapshot", "fixture");
  expect("snapshot exits 0", r.status === 0, r.stderr);
  expect("verify ok right after snapshot", env("verify").status === 0);
  write("AGENTS.local.md", "# personal root v2 (accidentally overwritten)\n");
  fs.rmSync(path.join(repo, "docs/ai/notes.md"));
  r = env("verify");
  expect("verify detects change and loss", r.status === 1 && /changed\s+AGENTS\.local\.md/.test(r.stdout) && /missing\s+docs\/ai\/notes\.md/.test(r.stdout), r.stdout);
  r = env("restore", "latest");
  expect("restore exits 0", r.status === 0, r.stdout);
  expect("restore brings content back", read("AGENTS.local.md") === "# personal root v1\n" && read("docs/ai/notes.md") === "notes v1\n");
  expect("verify ok after restore", env("verify").status === 0);

  // collisions: a remote-style ref starts tracking a personal path
  expect("no collisions initially", env("collisions", "--ref", "main").status === 0);
  git("switch", "-q", "-c", "team-change");
  write("docs/ai/team-doc.md", "team now tracks docs/ai\n");
  git("add", "-f", "docs/ai/team-doc.md");
  git("commit", "-q", "-m", "team tracks docs/ai");
  git("update-ref", "refs/remotes/origin/phase-2/staging", "HEAD");
  git("switch", "-q", "main");
  fs.rmSync(path.join(repo, "docs/ai/team-doc.md"), { force: true });
  r = env("collisions");
  expect("collision reported for default ref origin/phase-2/staging", r.status === 1 && /origin\/phase-2\/staging: docs\/ai\/team-doc\.md/.test(r.stdout), r.stdout);
  r = env("collisions", "--all-remotes");
  expect("collision reported with --all-remotes", r.status === 1, r.stdout);

  // restore refuses a path that became tracked
  git("switch", "-q", "team-change");
  write("AGENTS.local.md", "# team version\n");
  git("add", "-f", "AGENTS.local.md");
  git("commit", "-q", "-m", "team tracks AGENTS.local.md");
  r = env("restore", "latest", "AGENTS.local.md");
  expect("restore refuses tracked path", r.status === 1 && /refused\s+AGENTS\.local\.md/.test(r.stdout) && read("AGENTS.local.md") === "# team version\n", r.stdout);
} catch (e) {
  failures++;
  console.log(`FAIL fixture setup: ${e.message}`);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(`test-tooling: ${failures ? `${failures} of ${checks} failed` : `all ${checks} checks passed`}`);
process.exit(failures ? 1 : 0);
