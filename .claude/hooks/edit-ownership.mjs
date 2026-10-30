#!/usr/bin/env node
// PreToolUse guard that enforces the edit boundaries of the Subagents table in CLAUDE.md.

import { readFileSync } from "node:fs";
import path from "node:path";

const input = JSON.parse(readFileSync(0, "utf8"));
const target = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
const root = process.env.CLAUDE_PROJECT_DIR ?? input.cwd;

if (!target || !root) process.exit(0);

const rel = path.relative(root, path.resolve(root, target)).split(path.sep).join("/");

// Memory, the scratchpad and anything else outside the repo are nobody's territory here.
if (rel.startsWith("..") || path.isAbsolute(rel)) process.exit(0);

const key = rel.toLowerCase();
// Local scratch output (QA reports and the like), ignored by the shared .gitignore: anyone writes.
if (key.startsWith("tmp/")) process.exit(0);
// Teammates' PRDs and Codex skills: sources to read, never edited by this workflow.
const teammates = key.startsWith("plans/") || key.startsWith("skills/");
const inDocs = key.startsWith("docs/");
// The code rules are agent-facing documentation, so they go with docs/ rather than with the
// rest of `.claude/`.
const inRules = key.startsWith(".claude/rules/");
// `.gitignore` carries the `!docs/...` whitelist, which docs-manager keeps in step with the
// documents it adds; every other line of it is implementer's.
const isGitignore = key === ".gitignore";
const inConfig =
  !inRules &&
  (key === "claude.md" || key === ".mcp.json" || key.startsWith(".claude/") || key.startsWith(".git/"));
const agent = input.agent_type;

let reason = null;

if (teammates) {
  reason = "plans/ and skills/ are teammates' artifacts and read-only in this workflow — ask the user.";
} else if (key === ".claude/settings.json") {
  reason = "this tracked file is a teammate's — local settings go to .claude/settings.local.json.";
} else if (!agent) {
  if (inDocs) reason = "documentation belongs to docs-manager — delegate the change to it.";
  else if (inRules) reason = "the code rules belong to docs-manager — delegate the change to it.";
  else if (!inConfig) reason = "project code and config belong to implementer — dispatch it instead.";
} else if (agent === "implementer") {
  if (inDocs) reason = "documentation belongs to docs-manager — list it under Docs staleness in your report.";
  else if (inRules) reason = "the code rules belong to docs-manager — list it under Rule gaps in your report.";
  else if (inConfig) reason = "CLAUDE.md, .mcp.json, .claude/** and .git/** belong to the main session — list it under Open problems.";
} else if (agent === "docs-manager") {
  if (!inDocs && !inRules && !isGitignore) {
    reason = "your scope is docs/, .claude/rules/ and the docs whitelist in .gitignore — report the change instead of making it.";
  }
} else {
  reason = `${agent} doesn't edit repo files — code and config belong to implementer, documentation to docs-manager.`;
}

if (reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: `Blocked edit of ${rel}: ${reason} (CLAUDE.md → Subagents)`,
      },
    }),
  );
}
