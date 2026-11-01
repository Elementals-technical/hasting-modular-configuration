#!/usr/bin/env node
// Validates the repository's agent guidance: skills, adapters, links, hygiene, knowledge files, context budgets.
//   node .agents/skills/local-maintain-agent-guidance/scripts/validate-guidance.mjs [--verbose]
// Exit 1 on any error. Dependency-free; macOS and Windows. Static checks only: model behaviour is probed
// separately with the prompts in ../tests/probes.md.

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const verbose = process.argv.includes("--verbose");
process.chdir(execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim());

const errors = [];
const warnings = [];
const ok = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);
const pass = (m) => ok.push(m);
const read = (p) => fs.readFileSync(p, "utf8");
const exists = (p) => fs.existsSync(p);
const git = (args) => spawnSync("git", ["--no-optional-locks", ...args], { encoding: "utf8" });
const toPosix = (p) => p.split(path.sep).join("/");

function walk(dir, filter = () => true) {
  if (!exists(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = toPosix(path.join(dir, e.name));
    if (e.isDirectory()) out.push(...walk(p, filter));
    else if (filter(p)) out.push(p);
  }
  return out;
}

// ---------- 1. skills ----------
const expected = read(path.join(here, "../tests/expected-skills.txt")).split(/\r?\n/).map((s) => s.trim()).filter((s) => s && !s.startsWith("#"));
const skillDirs = exists(".agents/skills") ? fs.readdirSync(".agents/skills", { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : [];
for (const name of expected) {
  const file = `.agents/skills/${name}/SKILL.md`;
  if (!exists(file)) { err(`missing skill ${file}`); continue; }
  const fm = read(file).match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const name_ = fm?.[1].match(/^name:\s*(.+)$/m)?.[1].trim();
  const desc = fm?.[1].match(/^description:\s*(.+)$/m)?.[1].trim() ?? "";
  if (name_ !== name) err(`${file}: frontmatter name "${name_}" != folder`);
  if (!/\b(Do not|do not|never|Never)\b/.test(desc)) err(`${file}: description lacks an explicit "Do not"/"never" boundary`);
  if (desc.length > 600) warn(`${file}: description ${desc.length} chars (> 600)`);
}
for (const d of skillDirs) if (!expected.includes(d)) err(`.agents/skills/${d}: not in tests/expected-skills.txt`);
pass(`skills: ${expected.length} expected, ${skillDirs.length} present`);

// ---------- 2. machine-local settings never staged ----------
const privateSettings = [".claude/settings.local.json", ".codex/config.toml", "AGENTS.local.md", "CLAUDE.local.md"];
for (const p of git(["diff", "--cached", "--name-only", "--diff-filter=AM", "--", ...privateSettings]).stdout.split("\n").filter(Boolean)) err(`personal/machine file staged: ${p}`);
pass("personal and machine-local files are not staged");

// ---------- 3. adapters ----------
const rootClaude = exists("CLAUDE.md") ? read("CLAUDE.md") : "";
if (!/^@AGENTS\.md\s*$/m.test(rootClaude)) err("CLAUDE.md must import @AGENTS.md");
const claudeLocal = exists("CLAUDE.local.md") ? read("CLAUDE.local.md").trim().split(/\r?\n/) : [];
if (JSON.stringify(claudeLocal) !== JSON.stringify(["@AGENTS.local.md"])) err("CLAUDE.local.md must be exactly: @AGENTS.local.md");
if (!exists("AGENTS.local.md")) err("CLAUDE.local.md imports missing AGENTS.local.md");
if (!/ai\/workflow\.md/.test(read("AGENTS.md"))) err("AGENTS.md must route to ai/workflow.md");
if (!/AGENTS\.local\.md/.test(read("AGENTS.md"))) err("AGENTS.md must route to AGENTS.local.md for Codex");
const skillsLink = ".claude/skills";
if (!exists(skillsLink) || !fs.lstatSync(skillsLink).isSymbolicLink() || path.resolve(fs.realpathSync(skillsLink)) !== path.resolve(".agents/skills")) err(".claude/skills must be a symlink to ../.agents/skills (Claude Code reads skills through it)");
else pass("Claude reads skills through the .claude/skills symlink");

// ---------- 4. routing: every skill named by the routing owners exists ----------
const routeFiles = ["AGENTS.md", "ai/workflow.md", "docs/ai/README.md"].filter(exists);
const routedSkills = new Set(routeFiles.flatMap((f) => [...read(f).matchAll(/`((?:local|hastings?)-[a-z-]+)`/g)].map((m) => m[1])));
for (const s of routedSkills) if (!s.includes("<") && !exists(`.agents/skills/${s}/SKILL.md`)) err(`routed skill ${s} has no SKILL.md`);
pass(`routing: ${routedSkills.size} skills referenced by routing owners exist`);

// ---------- 5. links ----------
const guidanceMd = [
  "AGENTS.md", "CLAUDE.md", "AGENTS.local.md",
  ...walk("ai", (p) => p.endsWith(".md")),
  ...walk(".agents/skills", (p) => p.endsWith(".md")),
  ...walk("docs/ai", (p) => p.endsWith(".md") && !p.includes("/normalized/") && !p.includes("/evidence/")),
].filter(exists);
let linkCount = 0;
for (const file of guidanceMd) {
  const text = read(file).replace(/```[\s\S]*?```/g, "");
  for (const m of text.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const target = m[1].split("#")[0];
    if (!target || /^(https?:|mailto:)/.test(target)) continue;
    linkCount++;
    if (!exists(path.join(path.dirname(file), decodeURIComponent(target)))) err(`${file}: broken link ${m[1]}`);
  }
}
pass(`links: ${linkCount} relative links checked in ${guidanceMd.length} files`);

// ---------- 5b. code paths named by the knowledge routers ----------
const routers = ["docs/ai/hastings/feature-index.md", "docs/ai/hastings/dependency-graph.md", "docs/ai/hastings/domain-index.md"].filter(exists);
let pathCount = 0;
for (const file of routers) {
  const text = read(file).replace(/```[\s\S]*?```/g, "");
  for (const m of text.matchAll(/`((?:src|public|e2e|docs|ai|plans)\/[^`\s*]+)`/g)) {
    const target = m[1].replace(/<id>/g, "class");
    pathCount++;
    if (!exists(target)) err(`${file}: path does not exist: ${m[1]}`);
  }
}
pass(`router paths: ${pathCount} code paths checked in ${routers.length} files`);

// ---------- 6. policy owners: one rule, one owner ----------
const owners = read(path.join(here, "../tests/policy-owners.tsv")).split(/\r?\n/).filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));
const personalMd = guidanceMd.filter((f) => f === "AGENTS.local.md" || f === "CLAUDE.local.md");
for (const [marker, owner] of owners) {
  const re = new RegExp(marker);
  const hits = guidanceMd.filter((f) => re.test(read(f)));
  if (owner === "-") { for (const h of hits.filter((h) => personalMd.includes(h))) err(`team-owned rule restated in personal file ${h}: /${marker}/`); }
  else {
    if (!hits.includes(owner)) err(`policy marker /${marker}/ missing from its owner ${owner}`);
    for (const h of hits.filter((h) => h !== owner)) err(`policy marker /${marker}/ duplicated in ${h} (owner ${owner})`);
  }
}
pass(`policy owners: ${owners.length} markers`);

// ---------- 7. hygiene: no personal paths, no secrets ----------
const forbidden = [
  [/\/Users\/[A-Za-z0-9._-]+/, "personal absolute path"],
  [/[A-Za-z]:\\Users\\/, "personal Windows path"],
  [/\b(ghp_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|xox[bap]-[A-Za-z0-9-]{10,})/, "credential-like token"],
  [/Bearer\s+[A-Za-z0-9._-]{20,}/, "bearer token"],
];
// Secret-like .env values (public URLs excluded). Values are never printed.
const envValues = exists(".env")
  ? read(".env").split(/\r?\n/).map((l) => l.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "")).filter((v) => v.length >= 12 && !/^https?:\/\//.test(v))
  : [];
const hygieneFiles = [...guidanceMd, ...walk(".agents/skills", (p) => /\.(mjs|py|tsv|txt|json|yaml)$/.test(p)), ...walk("docs/ai", (p) => /\.(csv|json|js)$/.test(p) && !p.includes("/evidence/") && !p.includes("/normalized/"))].filter(exists);
for (const f of hygieneFiles) {
  if (f.endsWith("validate-guidance.mjs")) continue;
  const text = read(f);
  for (const [re, what] of forbidden) if (re.test(text)) err(`${f}: ${what}`);
  if (envValues.some((v) => text.includes(v))) err(`${f}: contains a value from .env (secret leak)`);
}
const evidenceText = walk("docs/ai/qa/evidence", (p) => p.endsWith(".txt"));
for (const f of evidenceText) if (envValues.some((v) => read(f).includes(v))) err(`${f}: evidence contains a value from .env`);
pass(`hygiene: ${hygieneFiles.length} guidance/tooling files + ${evidenceText.length} evidence texts scanned`);

// ---------- 8. required knowledge files ----------
const required = [
  "docs/ai/README.md", "docs/ai/checkpoint.md",
  "docs/ai/hastings/SCHEMAS.md", "docs/ai/hastings/domain-index.md", "docs/ai/hastings/domain-rules.csv",
  "docs/ai/hastings/conflicts-and-decisions.md", "docs/ai/hastings/dependency-graph.md", "docs/ai/hastings/sku-price-oracle-map.md",
  "docs/ai/hastings/source-ledger.csv", "docs/ai/hastings/comments-ledger.csv", "docs/ai/hastings/link-access-audit.csv",
  "docs/ai/hastings/feature-index.md",
  "docs/ai/qa/ui-test-matrix.csv", "docs/ai/qa/browser-validation.md", "docs/ai/qa/test-evidence-index.csv",
  "docs/ai/qa/handoffs/ownership-handoff-template.md",
  "docs/ai/env/environment-branch-map.md", "docs/ai/env/windows-mac-mcp-runbook.md",
];
for (const r of required) if (!exists(r)) err(`missing required file ${r}`);
pass(`required knowledge files: ${required.length} checked`);

// ---------- 9. context budgets ----------
const size = (files) => files.reduce((n, f) => n + (exists(f) ? fs.statSync(f).size : 0), 0);
const wrapperMeta = walk(".agents/skills", (p) => /^\.agents\/skills\/[^/]+\/SKILL\.md$/.test(p)).reduce((n, f) => n + (read(f).match(/^---[\s\S]*?---/)?.[0].length ?? 0), 0);
const alwaysOn = ["CLAUDE.md", "CLAUDE.local.md", "AGENTS.md", "AGENTS.local.md"];
const chains = {
  // 2026-11-01: limit 18000 → 19500 when the four collection skills (tricot, lame, ud, ufs) were added; 16 skill frontmatters ≈ 4.9 KB of this.
  "always-on (team + personal root + skill metadata)": [size(alwaysOn) + wrapperMeta, 19500],
  "personal always-on only (AGENTS.local.md)": [size(["AGENTS.local.md"]), 7000],
  "typical UI task (always-on + workflow + implement + ui-regression + verify + browser runbook + domain index)": [
    size([...alwaysOn, "ai/workflow.md", ".agents/skills/local-implement-change/SKILL.md", ".agents/skills/local-implement-change/references/ui-regression.md", ".agents/skills/local-implement-change/references/verify-frontend.md", "docs/ai/qa/browser-validation.md", "docs/ai/hastings/domain-index.md"]) + wrapperMeta,
    // 2026-10-31: 36000 -> 38000 after the catalog gained hasting-countertop and hasting-side-panels
    // (formerly symlinks, not counted) and CLAUDE.md became a real adapter instead of a 25-byte pointer.
    38000,
  ],
  "debug task (always-on + workflow + debug + dependency graph)": [size([...alwaysOn, "ai/workflow.md", ".agents/skills/local-debug-root-cause/SKILL.md", "docs/ai/hastings/dependency-graph.md"]) + wrapperMeta, 36000],
};
for (const [name, [bytes, limit]] of Object.entries(chains)) {
  const line = `budget ${name}: ${bytes} B (limit ${limit})`;
  if (bytes > limit) err(line); else pass(line);
}

// ---------- report ----------
for (const m of verbose ? ok : ok.filter((m) => m.startsWith("budget"))) console.log(`ok    ${m}`);
for (const w of warnings) console.log(`warn  ${w}`);
for (const e of errors) console.log(`ERROR ${e}`);
console.log(`validate-guidance: ${errors.length} errors, ${warnings.length} warnings, ${ok.length} checks passed`);
process.exitCode = errors.length ? 1 : 0;
