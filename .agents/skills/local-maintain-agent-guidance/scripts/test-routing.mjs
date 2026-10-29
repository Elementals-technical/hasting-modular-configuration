#!/usr/bin/env node
// Static routing contract for the personal Hastings layer (fixtures in ../tests/*.tsv).
// It proves the routing vocabulary and the routed files are consistent; it does NOT prove model behaviour
// (use one `claude -p` probe for that). Run from the repository root. Exit 1 on any failure.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
process.chdir(execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim());
const tsv = (name) =>
  fs.readFileSync(path.join(here, "../tests", name), "utf8").split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("#")).map((l) => l.split("\t"));

// Router mirrors the "Маршрутизация" table of AGENTS.local.md (first match wins).
const WORKFLOW_RULES = [
  ["local-review-change", /\b(review|ревью|рев'ю)\b|\bPR\b.*(перед|before)|diff of/i],
  ["local-maintain-agent-guidance", /AGENTS(\.local)?\.md|guidance|\bskills?\b|\bMCP\b|коллизи|колізі|git pull|ai-env|обёртк|wrapper/i],
  ["local-execute-plan", /утвержд[её]нн|затверджен|approved plan|continue the approved|выполни .*план|plans\/[\w-]+\/\d\d-/i],
  ["local-plan-change", /план|\bplan\b|дизайн|\bdesign\b|\bPRD\b|\bissues\b|архитектур/i],
  ["local-debug-root-cause", /почему|чому|\bwhy\b|find the cause|непонятно|не обновляется|падает|fails?\b|flaky|wrong|неправильн/i],
  ["local-implement-change", /исправ|виправ|реализ|добав|додай|implement|\bfix\b|\badd\b|сделай|зроби|измени|\bupdate\b/i],
];
const AREA_RULES = [
  ["docs/ai/checkpoint.md", /продолж|вчерашн|continue yesterday|resume/i],
  ["docs/ai/hastings/source-ledger.csv", /недоступ|свежест|source|источник/i],
  ["docs/ai/env/windows-mac-mcp-runbook.md", /\bMCP\b|не подключ/i],
  ["docs/ai/env/environment-branch-map.md", /ветк|branch|staging|production|deploy|деплой/i],
  ["docs/ai/qa/handoffs/ownership-handoff-template.md", /передать|handoff|команде сцены|backend team|PlayCanvas team/i],
  ["docs/ai/hastings/conflicts-and-decisions.md", /противореч|суперечать|conflict|расхожд/i],
  ["docs/ai/hastings/sku-price-oracle-map.md", /\bSKU\b|цен[аыуе]|price|quote|PDF/i],
  ["docs/ai/qa/browser-validation.md", /браузер|browser|drag and drop|\bDnD\b|Chrome|Firefox/i],
  ["docs/ai/hastings/dependency-graph.md", /что затронет|blast radius|что сломается|affects/i],
  ["docs/ai/hastings/domain-index.md", /правил[ао] клиента|client rule|offset|remote|side panel|countertop/i],
];
const route = (rules, prompt) => rules.find(([, re]) => re.test(prompt))?.[0] ?? "(none)";

let failures = 0;
const check = (cond, msg) => {
  if (!cond) {
    failures++;
    console.log(`FAIL ${msg}`);
  }
};

// 1. task type -> workflow
const triggers = tsv("trigger-cases.tsv");
for (const [prompt, expected] of triggers) {
  const got = route(WORKFLOW_RULES, prompt);
  check(got === expected, `workflow: "${prompt}" -> ${got}, expected ${expected}`);
}
// every workflow in the routing table exists and is covered by at least one fixture
const root = fs.readFileSync("AGENTS.local.md", "utf8");
const routed = [...root.matchAll(/`(local-[a-z-]+)`/g)].map((m) => m[1]);
for (const w of new Set(routed)) {
  check(fs.existsSync(`.agents/skills/${w}/SKILL.md`), `routed workflow ${w} has no SKILL.md`);
  check(triggers.some(([, e]) => e === w), `routed workflow ${w} has no trigger fixture`);
}

// 2. area -> reference (must also be linked from AGENTS.local.md and exist)
const areas = tsv("area-cases.tsv");
for (const [prompt, expected] of areas) {
  const got = route(AREA_RULES, prompt);
  check(got === expected, `area: "${prompt}" -> ${got}, expected ${expected}`);
  check(root.includes(`](${expected})`) || root.includes(`](${expected}#`), `AGENTS.local.md does not link ${expected}`);
  check(fs.existsSync(expected), `routed reference missing: ${expected}`);
}

// 3. workflow policy content
const skills = fs.readdirSync(".agents/skills").filter((d) => d.startsWith("local-"));
for (const [skill, pattern] of tsv("workflow-policy-cases.tsv")) {
  const negative = pattern.startsWith("!");
  const re = new RegExp(negative ? pattern.slice(1) : pattern, "m");
  for (const s of skill === "*" ? skills : [skill]) {
    const text = fs.readFileSync(`.agents/skills/${s}/SKILL.md`, "utf8");
    check(negative ? !re.test(text) : re.test(text), `policy: ${s} ${negative ? "must not" : "must"} match /${re.source}/`);
  }
}

const total = triggers.length + areas.length;
console.log(`test-routing: ${failures ? `${failures} failures` : "all passed"} (${triggers.length} workflow cases, ${areas.length} area cases, policy cases for ${skills.length} skills)`);
process.exit(failures ? 1 : total ? 0 : 1);
