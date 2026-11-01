<!-- Team entry for Claude Code; rules live in AGENTS.md. Personal: CLAUDE.local.md -> AGENTS.local.md (gitignored). -->
@AGENTS.md

- Skills live in `.agents/skills/<name>/`; `.claude/skills` and `.claude/rules` are symlinks to `../.agents/skills` and `../ai/rules`.
- Built-in Explore/Plan subagents start without CLAUDE.md or AGENTS.md: put scope and "Do not edit by hand" paths into the delegation prompt.
- On compaction keep: task/ticket, `collectionId`, changed files, commands with results, open BLOCKED/UNKNOWN items.
