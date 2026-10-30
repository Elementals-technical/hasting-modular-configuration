#!/usr/bin/env node
// Validates the personal local-only agent layer of the Hastings repo. Run from the repository root:
//   node .agents/skills/local-maintain-agent-guidance/scripts/validate-guidance.mjs [--verbose]
// Exit 1 on any error. Dependency-free; macOS and Windows.

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const verbose = process.argv.includes("--verbose");
const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
process.chdir(root);
const errors = [];
const warnings = [];
const ok = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);
const pass = (m) => ok.push(m);
const read = (p) => fs.readFileSync(p, "utf8");
const exists = (p) => fs.existsSync(p);
const git = (args) => spawnSync("git", args, { encoding: "utf8" });
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

// ---------- 1. workflows ----------
const expected = read(path.join(here, "../tests/expected-skills.txt")).split(/\r?\n/).map((s) => s.trim()).filter((s) => s && !s.startsWith("#"));
const skillDirs = exists(".agents/skills") ? fs.readdirSync(".agents/skills", { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : [];
const trackedSkills = new Set(git(["ls-files", ".agents/skills"]).stdout.split("\n").filter(Boolean).map((p) => p.split("/")[2]));
for (const name of expected) {
  const file = `.agents/skills/${name}/SKILL.md`;
  if (!exists(file)) {
    err(`missing workflow ${file}`);
    continue;
  }
  const fm = read(file).match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const name_ = fm?.[1].match(/^name:\s*(.+)$/m)?.[1].trim();
  const desc = fm?.[1].match(/^description:\s*(.+)$/m)?.[1].trim() ?? "";
  if (name_ !== name) err(`${file}: frontmatter name "${name_}" != folder`);
  if (!/\b(Do not|do not|never|Never)\b/.test(desc)) err(`${file}: description lacks an explicit "Do not"/"never" boundary`);
  if (desc.length > 600) warn(`${file}: description ${desc.length} chars (> 600)`);
}
for (const d of skillDirs) {
  if (!trackedSkills.has(d) && !d.startsWith("local-")) err(`.agents/skills/${d}: untracked skill without local- prefix (collision risk with team skills)`);
  if (d.startsWith("local-") && !expected.includes(d)) err(`.agents/skills/${d}: not in tests/expected-skills.txt`);
}
pass(`workflows: ${expected.length} expected, ${skillDirs.length} present`);

// ---------- 2. local-only ----------
const personal = [
  "AGENTS.local.md",
  "CLAUDE.local.md",
  ".claude/settings.local.json",
  ...walk(".agents/skills", (p) => /\/local-[^/]+\//.test(p)),
  ...walk(".claude/skills"),
  ...walk("docs/ai", (p) => !p.includes("/evidence/") && !p.includes("/normalized/")),
].filter(exists);
const trackedNow = new Set(git(["ls-files", "--", ...personal]).stdout.split("\n").filter(Boolean));
// The layer is intentionally visible in `git status` (user decision 2026-10-28) but must never be tracked/staged.
for (const p of personal) if (trackedNow.has(p)) err(`personal file is tracked/staged by git: ${p}`);
const staged = git(["diff", "--cached", "--name-only"]).stdout.split("\n").filter(Boolean).filter((p) => personal.includes(p));
for (const p of staged) err(`personal file is staged: ${p}`);
pass(`local-only: ${personal.length} personal files untracked (visible in git status, not staged)`);

// ---------- 3. team files unchanged ----------
const teamPaths = ["AGENTS.md", "ai", ".claude/settings.json", "skills", "docs/products", "docs/INDEX.md"];
const teamDiff = git(["status", "--porcelain", "--", ...teamPaths]).stdout.trim();
if (teamDiff) err(`team guidance changed:\n${teamDiff}`);
else pass("team guidance unchanged (AGENTS.md, ai/, .claude/settings.json, skills/, docs/products, docs/INDEX.md)");
const trackedChanges = git(["status", "--porcelain", "--untracked-files=no"]).stdout.trim();
if (trackedChanges) warn(`tracked working-tree changes exist (not made by this layer?):\n${trackedChanges}`);

// ---------- 4. adapters ----------
const claudeLocal = exists("CLAUDE.local.md") ? read("CLAUDE.local.md").trim().split(/\r?\n/) : [];
const expectedImports = ["@AGENTS.md", "@ai/AGENTS.md", "@AGENTS.local.md"];
if (JSON.stringify(claudeLocal) !== JSON.stringify(expectedImports)) err(`CLAUDE.local.md must be exactly: ${expectedImports.join(" ")}`);
for (const imp of expectedImports) if (!exists(imp.slice(1))) err(`CLAUDE.local.md imports a missing file: ${imp}`);
const sync = spawnSync(process.execPath, [path.join(here, "ai-env.mjs"), "check-sync"], { encoding: "utf8" });
if (sync.status !== 0) err(`wrappers out of sync:\n${sync.stdout.trim()}`);
else pass("Claude wrappers in sync with canonical skills");

// ---------- 5. links ----------
const guidanceMd = [
  "AGENTS.local.md",
  ...walk(".agents/skills", (p) => /\/local-[^/]+\/.*\.md$/.test(p)),
  ...walk("docs/ai", (p) => p.endsWith(".md") && !p.includes("/history/") && !p.includes("/normalized/") && !p.includes("/evidence/")),
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

// ---------- 6. policy owners ----------
const owners = read(path.join(here, "../tests/policy-owners.tsv")).split(/\r?\n/).filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));
for (const [marker, owner] of owners) {
  const re = new RegExp(marker);
  const hits = guidanceMd.filter((f) => re.test(read(f)));
  if (owner === "-") {
    for (const h of hits) err(`team-owned rule restated in personal file ${h}: /${marker}/`);
  } else {
    if (!hits.includes(owner)) err(`policy marker /${marker}/ missing from its owner ${owner}`);
    for (const h of hits.filter((h) => h !== owner)) err(`policy marker /${marker}/ duplicated in ${h} (owner ${owner})`);
  }
}
pass(`policy owners: ${owners.length} markers`);

// ---------- 7. hygiene ----------
const forbidden = [
  [/\/Users\/[A-Za-z0-9._-]+/, "personal absolute path"],
  [/[A-Za-z]:\\Users\\/, "personal Windows path"],
  [/AirIntelligence|CentralController|Equalizer|\.NET\b|\bAzure\b|\bbicep\b|localhost:3000|\bpnpm\b/, "AirIntelligence/kit leftover"],
  [/\b(ghp_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|xox[bap]-[A-Za-z0-9-]{10,})/, "credential-like token"],
  [/Bearer\s+[A-Za-z0-9._-]{20,}/, "bearer token"],
];
// Secret-like .env values (URLs are public hosts already in the bundle; tokens/ids are not). Never printed.
const envValues = exists(".env")
  ? read(".env").split(/\r?\n/).map((l) => l.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "")).filter((v) => v.length >= 12 && !/^https?:\/\//.test(v))
  : [];
const hygieneFiles = [...guidanceMd, "CLAUDE.local.md", ...walk(".agents/skills", (p) => /\/local-[^/]+\/.*\.(mjs|py|tsv|txt|json)$/.test(p)), ...walk("docs/ai", (p) => /\.(csv|json|js)$/.test(p) && !p.includes("/evidence/") && !p.includes("/normalized/"))].filter(exists);
for (const f of hygieneFiles) {
  const text = read(f);
  for (const [re, what] of forbidden) {
    if (f.endsWith("validate-guidance.mjs")) continue;
    // Routing fixtures name the leftover words on purpose (negative policy cases); secrets are still checked there.
    if (what === "AirIntelligence/kit leftover" && f.includes("/tests/")) continue;
    const m = text.match(re);
    if (m) err(`${f}: ${what} (${m[0].slice(0, 40)})`);
  }
  if (envValues.some((v) => text.includes(v))) err(`${f}: contains a value from .env (secret leak)`);
}
const evidenceText = walk("docs/ai/qa/evidence", (p) => p.endsWith(".txt"));
for (const f of evidenceText) if (envValues.some((v) => read(f).includes(v))) err(`${f}: evidence contains a value from .env`);
pass(`hygiene: ${hygieneFiles.length} guidance/tooling files + ${evidenceText.length} evidence texts scanned`);

// ---------- 8. required knowledge files ----------
const required = [
  "docs/ai/README.md", "docs/ai/checkpoint.md", "docs/ai/verified-commands.md",
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
const wrapperMeta = walk(".claude/skills", (p) => p.endsWith("SKILL.md")).reduce((n, f) => n + (read(f).match(/^---[\s\S]*?---/)?.[0].length ?? 0), 0);
const alwaysOn = ["CLAUDE.local.md", "AGENTS.md", "ai/AGENTS.md", "AGENTS.local.md"];
const chains = {
  "always-on (team + personal root + skill metadata)": [size(alwaysOn) + wrapperMeta, 18000],
  "personal always-on only (AGENTS.local.md)": [size(["AGENTS.local.md"]), 7000],
  "typical UI task (always-on + implement + ui-regression + verify + browser runbook + domain index)": [
    size([...alwaysOn, ".agents/skills/local-implement-change/SKILL.md", ".agents/skills/local-implement-change/references/ui-regression.md", ".agents/skills/local-implement-change/references/verify-frontend.md", "docs/ai/qa/browser-validation.md", "docs/ai/hastings/domain-index.md"]) + wrapperMeta,
    36000,
  ],
  "debug task (always-on + debug + dependency graph)": [size([...alwaysOn, ".agents/skills/local-debug-root-cause/SKILL.md", "docs/ai/hastings/dependency-graph.md"]) + wrapperMeta, 36000],
};
for (const [name, [bytes, limit]] of Object.entries(chains)) {
  const line = `budget ${name}: ${bytes} B (limit ${limit})`;
  if (bytes > limit) err(line);
  else pass(line);
}

// ---------- report ----------
if (verbose) for (const m of ok) console.log(`ok    ${m}`);
else for (const m of ok.filter((m) => m.startsWith("budget"))) console.log(`ok    ${m}`);
for (const w of warnings) console.log(`warn  ${w}`);
for (const e of errors) console.log(`ERROR ${e}`);
console.log(`validate-guidance: ${errors.length} errors, ${warnings.length} warnings, ${ok.length} checks passed`);
process.exit(errors.length ? 1 : 0);
