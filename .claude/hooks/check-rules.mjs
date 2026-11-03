#!/usr/bin/env node
// Gate for `.claude/rules/**`, the path-scoped rule files the harness injects on Read. As a
// PostToolUse hook it rechecks the whole directory after any Edit or Write inside it and
// feeds every problem back to the agent (exit 2); run with `--all` it checks once and prints
// a summary. It enforces what keeps rule files cheap and trustworthy: a byte budget, a kebab
// file name, `paths` as the only frontmatter key in block-list YAML, every glob matching a
// tracked file, no glob that loads everywhere or that a sibling glob already covers, no two
// files sharing a path set, English only, and no history, dates or planning IDs.

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, posix, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");
const RULES_DIR = ".claude/rules";
const MAX_BYTES = 6000;
const FILE_NAME = /^[a-z0-9]+(-[a-z0-9]+)*\.md$/;

const BANNED = [
  /alternatives considered/i,
  /\bconsidered and (declined|rejected)\b/i,
  /\b\d{4}-\d{2}-\d{2}\b/,
  /\bpreviously\b/i,
  /before\b.{0,60}\bexisted/i,
  /\bADR[- ]?\d/i,
  /\.claude\/tasks\//i,
  /\bDEV-\d+/,
  /§/,
  /\b[ABCDI]\d{2}\b/,
  /[\u0400-\u04FF]/,
];

// YAML reads an unquoted `- **/*.ts` as an alias, not a string: a plain scalar cannot start
// with an indicator.
const PLAIN_SCALAR = /^(?![-?:,[\]{}#&*!|>'"%@`])(?!.*(?::\s|\s#)).*[^:]$/;

const hookMode = !process.argv.includes("--all");

if (hookMode) {
  let input;
  try {
    input = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    process.exit(0);
  }
  const target = input.tool_input?.file_path;
  if (!target) process.exit(0);
  const rel = relative(ROOT, target).split("\\").join("/");
  if (!rel.startsWith(`${RULES_DIR}/`)) process.exit(0);
}

function listRuleFiles() {
  const dir = join(ROOT, RULES_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.md$/i.test(entry.name))
    .map((entry) => relative(ROOT, join(entry.parentPath, entry.name)).split("\\").join("/"))
    .sort();
}

function listTrackedFiles() {
  const result = spawnSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) {
    console.error(`git ls-files failed: ${result.error?.message ?? result.stderr.trim()}`);
    process.exit(hookMode ? 2 : 1);
  }
  return result.stdout.split("\0").filter(Boolean);
}

function parseScalar(text) {
  if (text.startsWith('"')) {
    try {
      return /^"(?:[^"\\]|\\.)*"$/.test(text) ? JSON.parse(text) : null;
    } catch {
      return null;
    }
  }
  if (text.startsWith("'")) {
    return /^'(?:[^']|'')*'$/.test(text) ? text.slice(1, -1).replaceAll("''", "'") : null;
  }
  return PLAIN_SCALAR.test(text) ? text : null;
}

function readGlobs(lines) {
  if (lines[0] !== "---") return { problem: 'no frontmatter: line 1 must be exactly "---"' };
  const end = lines.indexOf("---", 1);
  if (end === -1) return { problem: 'frontmatter is never closed by a "---" line' };

  const globs = [];
  let hasKey = false;
  let indent;
  for (let index = 1; index < end; index++) {
    const line = lines[index];
    const at = `line ${index + 1}`;
    if (line.trim() === "") continue;
    if (!hasKey) {
      if (/^paths:[ \t]*$/.test(line)) {
        hasKey = true;
        continue;
      }
      return {
        problem: line.startsWith("paths:")
          ? `${at}: paths: must be a block list, one "- glob" per line`
          : `${at}: frontmatter may hold only paths:`,
      };
    }
    const item = /^( *)-(?:[ \t]+(.*))?$/.exec(line);
    if (item === null) return { problem: `${at}: not a "- glob" item (frontmatter may hold only paths:)` };
    indent ??= item[1];
    if (item[1] !== indent) return { problem: `${at}: paths: items must share one indentation` };
    const value = (item[2] ?? "").trimEnd();
    const glob = value === "" ? "" : parseScalar(value);
    if (glob === null) return { problem: `${at}: not a YAML string, quote the glob` };
    if (glob === "") return { problem: `${at}: empty glob` };
    if (/[{}]/.test(glob)) return { problem: `${at}: no brace expansion, write one glob per line` };
    globs.push(glob);
  }
  if (!hasKey) return { problem: "frontmatter has no paths:" };
  return globs.length > 0 ? { globs } : { problem: "paths: lists no globs" };
}

const files = listRuleFiles();
const rules = files.map((file) => {
  const bytes = readFileSync(join(ROOT, file));
  const lines = bytes.toString("utf8").split(/\r?\n/);
  return { file, size: bytes.length, lines, ...readGlobs(lines) };
});

const tracked = rules.some((rule) => rule.globs) ? listTrackedFiles() : [];
const globMatches = new Map();
const pathsOwners = new Map();

function matchedFiles(glob) {
  if (!globMatches.has(glob)) {
    globMatches.set(glob, new Set(tracked.filter((file) => posix.matchesGlob(file, glob))));
  }
  return globMatches.get(glob);
}

// A glob whose files a sibling glob already covers loads nothing extra and only suggests the
// two reach different places.
function redundantGlobs(globs) {
  const found = [];
  for (const inner of globs) {
    const innerFiles = matchedFiles(inner);
    const cover = globs.find((outer) => {
      if (outer === inner) return false;
      const outerFiles = matchedFiles(outer);
      if (outerFiles.size < innerFiles.size) return false;
      if (outerFiles.size === innerFiles.size && globs.indexOf(outer) > globs.indexOf(inner)) return false;
      return innerFiles.isSubsetOf(outerFiles);
    });
    if (cover !== undefined) found.push(`"${inner}" adds nothing: "${cover}" already covers every file it matches`);
  }
  return found;
}

const violations = rules.flatMap(({ file, size, lines, globs, problem }) => {
  const problems = [];
  if (!FILE_NAME.test(posix.basename(file))) problems.push(`file name must match ${FILE_NAME}`);
  if (size > MAX_BYTES) problems.push(`${size} bytes, over the ${MAX_BYTES}-byte limit`);
  if (problem) problems.push(problem);
  if (globs) {
    const unique = [...new Set(globs)];
    for (const glob of unique) {
      // Claude Code drops one trailing `/**`: a bare `**` is left loading everywhere.
      const loaded = glob.endsWith("/**") ? glob.slice(0, -3) : glob;
      if (loaded === "**" || loaded === "*") problems.push(`"${glob}" loads the rule into every session`);
      else if (matchedFiles(glob).size === 0) problems.push(`"${glob}" matches no tracked file`);
    }
    problems.push(...redundantGlobs(unique));
    const key = JSON.stringify([...unique].sort());
    const owner = pathsOwners.get(key);
    if (owner === undefined) pathsOwners.set(key, file);
    else problems.push(`same paths as ${owner}`);
  }
  lines.forEach((line, index) => {
    for (const pattern of BANNED) {
      const match = pattern.exec(line);
      if (match) problems.push(`line ${index + 1}: banned "${match[0]}"`);
    }
  });
  return problems.map((text) => `${file}: ${text}`);
});

if (violations.length > 0) {
  console.error(`Rule check failed, fix these:\n${violations.join("\n")}`);
  process.exit(hookMode ? 2 : 1);
}

if (!hookMode) console.log(`Rules OK: ${rules.length} file(s) in ${RULES_DIR}/.`);
