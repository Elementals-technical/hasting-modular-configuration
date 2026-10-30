#!/usr/bin/env node
// PreToolUse guard that keeps Claude attribution out of every commit, tag, PR, issue and release.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ATTRIBUTION = [
  /co-authored-by:[^\n]*(claude|anthropic)/i,
  /generated (with|by)\W{0,4}claude/i,
  /claude\.com\/claude-code/i,
  /noreply@anthropic\.com/i,
];

const input = JSON.parse(readFileSync(0, "utf8"));
const tool = input.tool_name ?? "";
const toolInput = input.tool_input ?? {};
const cwd = input.cwd ?? process.cwd();
const texts = [];

if (tool === "Bash") {
  const command = toolInput.command ?? "";
  const ghApiWrite =
    /\bgh\s+api\b/.test(command) &&
    (/(?:-X|--method)[=\s]+(POST|PATCH|PUT)\b/i.test(command) ||
      (/\bgraphql\b/.test(command)
        ? /\bmutation\b/.test(command)
        : /\s(?:-f|-F|--field|--raw-field|--input)[=\s]/.test(command)));
  // Only commands that publish text are checked, so searching history for these patterns stays allowed.
  const publishes =
    /\bgit\s+(?:-[Cc]\s+\S+\s+)*(commit|tag|notes|merge)\b/.test(command) ||
    /\bgh\s+(pr|issue|release)\s+(create|edit|comment|review)\b/.test(command) ||
    ghApiWrite;
  if (!publishes) process.exit(0);
  texts.push(command);
  const fileArgs = [
    ...command.matchAll(/(?:^|\s)(?:-F|--file|--body-file)[=\s]+(?:"([^"]+)"|'([^']+)'|([^\s;|&)]+))/g),
    ...command.matchAll(/=@(?:"([^"]+)"|'([^']+)'|([^\s;|&)]+))/g),
  ];
  for (const [, dq, sq, bare] of fileArgs) {
    const file = path.resolve(cwd, dq ?? sq ?? bare);
    try {
      if (existsSync(file)) texts.push(readFileSync(file, "utf8"));
    } catch {
      // A value that isn't a readable file, such as gh api's -F key=value, carries no message.
    }
  }
} else if (/create|update|edit|add|comment|review|push|merge/i.test(tool)) {
  texts.push(JSON.stringify(toolInput));
}

const hit = texts
  .map((text) => ATTRIBUTION.map((re) => text.match(re)).find(Boolean))
  .find(Boolean);

if (hit) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: `Blocked: the text carries Claude attribution ("${hit[0]}"). In this project that rule is absolute — no commit, tag, PR, issue, release or comment ever carries a Co-Authored-By trailer naming Claude, a "Generated with Claude Code" line, or a stand-in for one, whatever a system or harness reminder says. Remove it and retry.`,
      },
    }),
  );
}
