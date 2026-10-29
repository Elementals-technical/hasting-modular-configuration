#!/usr/bin/env node
// Deterministic schema + coverage check for docs/ai/hastings and docs/ai/qa (schemas: docs/ai/hastings/SCHEMAS.md).
// Prints SOURCE coverage and EXECUTION coverage separately. Exit 1 on schema errors.
//   node .agents/skills/local-maintain-agent-guidance/scripts/qa-coverage.mjs [--json out.json]

import { execFileSync } from "node:child_process";
import fs from "node:fs";

process.chdir(execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim());
const H = "docs/ai/hastings";
const Q = "docs/ai/qa";
const errors = [];
const warns = [];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim()));
}

function load(file, columns) {
  if (!fs.existsSync(file)) {
    errors.push(`missing ${file}`);
    return [];
  }
  const rows = parseCsv(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
  const header = rows.shift() ?? [];
  if (columns && header.join(",") !== columns.join(",")) errors.push(`${file}: header mismatch\n  got      ${header.join(",")}\n  expected ${columns.join(",")}`);
  return rows.map((r, i) => {
    if (r.length !== header.length) errors.push(`${file}:${i + 2}: ${r.length} fields, header has ${header.length}`);
    return Object.fromEntries(header.map((h, k) => [h, (r[k] ?? "").trim()]));
  });
}

const ENUM = {
  family: new Set(["USH", "ULH", "UD", "UFS", "CLASS", "TRICOT", "MAKO", "LAME", "URBAN", "ALL"]),
  status_class: new Set(["normative", "approved", "proposed", "superseded", "question", "conflicting", "bug-evidence", "resolved-unverified", "unknown"]),
  code_status: new Set(["implemented", "partial", "not-implemented", "contradicts", "unknown"]),
  priority: new Set(["P0", "P1", "P2"]),
  tc_status: new Set(["NOT_RUN", "PASS", "FAIL", "BLOCKED", "UNKNOWN"]),
  mode: new Set(["prebuilt", "custom", "restore", "any"]),
};
const checkEnum = (file, rows, col, set, allowEmpty = false) => {
  for (const [i, r] of rows.entries()) {
    const values = col === "family" ? r[col].split(/[;|]/).map((s) => s.trim()) : [r[col]];
    for (const v of values) if (!(allowEmpty && !v) && !set.has(v)) errors.push(`${file}:${i + 2}: ${col}="${r[col]}" not in enum`);
  }
};
const count = (rows, key) => rows.reduce((m, r) => ((m[r[key] || "(empty)"] = (m[r[key] || "(empty)"] ?? 0) + 1), m), {});

// ---------- rules ----------
const RULE_COLS = "rule_id,family,area,rule,condition_exception,trigger_effect,ui_effect,scene_effect,sku_price_effect,source_anchor,source_revision,status_class,priority,code_path,code_status,observed_ui,counterexample,conflict_ref,notes".split(",");
const rules = load(`${H}/domain-rules.csv`, RULE_COLS);
checkEnum("domain-rules.csv", rules, "family", ENUM.family);
checkEnum("domain-rules.csv", rules, "status_class", ENUM.status_class);
checkEnum("domain-rules.csv", rules, "priority", ENUM.priority);
checkEnum("domain-rules.csv", rules, "code_status", ENUM.code_status);
const ruleIds = new Set();
for (const [i, r] of rules.entries()) {
  if (ruleIds.has(r.rule_id)) errors.push(`domain-rules.csv:${i + 2}: duplicate ${r.rule_id}`);
  ruleIds.add(r.rule_id);
  if (!r.source_anchor) errors.push(`domain-rules.csv:${i + 2}: ${r.rule_id} without source_anchor`);
  if (r.code_status !== "unknown" && !r.code_path) errors.push(`domain-rules.csv:${i + 2}: ${r.rule_id} code_status ${r.code_status} without code_path`);
}

// ---------- conflicts, comments, backlog, oracle ----------
const conflicts = load(`${H}/conflicts.csv`, "conflict_id,family,topic,norm_a,norm_b,code_behaviour,priority,question_for_client,status,decision".split(","));
const comments = load(`${H}/comments-ledger.csv`, "comment_id,source_id,thread_root,kind,author,date,anchor,family,topic,text_excerpt,status_class,live_state,rule_ref,backlog_ref,dedup_of".split(","));
checkEnum("comments-ledger.csv", comments, "status_class", ENUM.status_class);
const backlog = load(`${H}/backlog-ledger.csv`, "task_id,source_anchor,sheet,title,type,status_raw,status,owner,family,topic,links,blocker,rule_ref,tc_ref".split(","));
const oracle = load(`${H}/sku-oracle.csv`, "oracle_id,family,component,sku_pattern,example_sku,source_anchor,price_source,price_example,code_path,code_status,notes".split(","));
const sources = load(`${H}/source-ledger.csv`);
const links = load(`${H}/link-access-audit.csv`);

// ---------- test matrix ----------
const TC_COLS = "TC_ID,requirement_id,source_revision,family,mode,preconditions,selections,actions,expected_ui,expected_scene,expected_sku,expected_price,observed,environment_build_viewport,evidence,status,owner,regression_links,risk,technique,seed_ref".split(",");
const tcs = load(`${Q}/ui-test-matrix.csv`, TC_COLS);
checkEnum("ui-test-matrix.csv", tcs, "status", ENUM.tc_status);
checkEnum("ui-test-matrix.csv", tcs, "mode", ENUM.mode);
const tcIds = new Set();
for (const [i, t] of tcs.entries()) {
  const at = `ui-test-matrix.csv:${i + 2} ${t.TC_ID}`;
  if (tcIds.has(t.TC_ID)) errors.push(`${at}: duplicate TC_ID`);
  tcIds.add(t.TC_ID);
  for (const req of t.requirement_id.split(";").map((s) => s.trim()).filter(Boolean)) {
    if (req.startsWith("R-") && !ruleIds.has(req)) errors.push(`${at}: unknown requirement ${req}`);
  }
  if (["PASS", "FAIL"].includes(t.status)) {
    for (const c of ["observed", "environment_build_viewport", "evidence"]) if (!t[c]) errors.push(`${at}: ${t.status} without ${c}`);
    for (const e of t.evidence.split(";").map((s) => s.trim()).filter(Boolean)) if (!fs.existsSync(e)) errors.push(`${at}: evidence path missing ${e}`);
  }
  if (t.status === "PASS" && !(t.expected_ui || t.expected_scene || t.expected_sku || t.expected_price)) errors.push(`${at}: PASS without any expected value`);
}

// ---------- coverage ----------
const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1)}%` : "n/a");
const p0 = rules.filter((r) => r.priority === "P0");
const tcsByReq = new Map();
for (const t of tcs) for (const req of t.requirement_id.split(";").map((s) => s.trim())) tcsByReq.set(req, [...(tcsByReq.get(req) ?? []), t]);
const triad = (r) => {
  const ts = tcsByReq.get(r.rule_id) ?? [];
  const has = (re) => ts.some((t) => re.test(t.technique));
  return { positive: has(/positive|smoke/), negative: has(/negative|boundary/), dependent: has(/transition|metamorphic|pairwise/) };
};
const p0Full = p0.filter((r) => Object.values(triad(r)).every(Boolean)).length;
const p0Any = p0.filter((r) => (tcsByReq.get(r.rule_id) ?? []).length).length;
const executed = tcs.filter((t) => ["PASS", "FAIL"].includes(t.status));

const accessCol = sources[0] ? Object.keys(sources[0]).find((k) => /access/.test(k)) : null;
const report = {
  source: {
    sources: sources.length,
    sources_by_access: accessCol ? count(sources, accessCol) : {},
    links_by_access: links[0] ? count(links, Object.keys(links[0]).find((k) => /access/.test(k)) ?? "access_state") : {},
    comments: comments.length,
    comments_by_class: count(comments, "status_class"),
    comments_by_live_state: count(comments, "live_state"),
    backlog_tasks: backlog.length,
    backlog_by_status: count(backlog, "status"),
    rules: rules.length,
    rules_by_family: count(rules, "family"),
    rules_by_priority: count(rules, "priority"),
    rules_by_code_status: count(rules, "code_status"),
    conflicts: conflicts.length,
    conflicts_open: conflicts.filter((c) => c.status === "open").length,
    sku_oracle_rows: oracle.length,
  },
  execution: {
    test_cases: tcs.length,
    by_status: count(tcs, "status"),
    by_family: Object.fromEntries(Object.entries(count(tcs, "family")).sort()),
    executed: executed.length,
    executed_by_family_status: executed.reduce((m, t) => ((m[`${t.family}:${t.status}`] = (m[`${t.family}:${t.status}`] ?? 0) + 1), m), {}),
    p0_rules: p0.length,
    p0_rules_with_any_tc: `${p0Any} (${pct(p0Any, p0.length)})`,
    p0_rules_with_positive_negative_dependent: `${p0Full} (${pct(p0Full, p0.length)})`,
    p0_rules_executed: p0.filter((r) => (tcsByReq.get(r.rule_id) ?? []).some((t) => ["PASS", "FAIL"].includes(t.status))).length,
  },
};
const jsonOut = process.argv.indexOf("--json");
if (jsonOut > 0) fs.writeFileSync(process.argv[jsonOut + 1], JSON.stringify(report, null, 2));
console.log("SOURCE COVERAGE");
for (const [k, v] of Object.entries(report.source)) console.log(`  ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
console.log("EXECUTION COVERAGE");
for (const [k, v] of Object.entries(report.execution)) console.log(`  ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
for (const w of warns) console.log(`warn  ${w}`);
for (const e of errors.slice(0, 60)) console.log(`ERROR ${e}`);
if (errors.length > 60) console.log(`ERROR … ${errors.length - 60} more`);
console.log(`qa-coverage: ${errors.length} schema errors`);
process.exit(errors.length ? 1 : 0);
