# Documentation layout

- `.claude/rules/*.md` — the code conventions, derived from the code itself. Each file declares
  the paths it governs, and the harness injects it when an agent Reads a matching file,
  subagents included. Nobody opens them to look something up, and nothing outside that
  directory cites one by name. They are local, like the rest of `.claude/`; a rule created
  mid-session reaches only subagents started after it.
- `docs/` — everything that is opened deliberately. `docs/products/` is the maintained
  description of the collections, entered through `docs/products/README.md`. The other files are
  dated records — reports, handoffs, migration statuses — kept as provenance, never current
  state. Navigate via `docs/INDEX.md` when it exists.
- `docs/*` is ignored except for what `.gitignore` whitelists with `!docs/...` lines: a new
  document is shared only through its own line, added in the same change.
- `plans/` holds teammates' PRDs and issue slices, `skills/` their Codex skills. Sources to read;
  nothing in this workflow edits them.
- The product is data: one package per collection under `public/collections/<id>/`, entered
  through its `manifest.json`, plus remote RenderAdmin configurators and DataTables. The
  PlayCanvas scene export is `public/HastingCabinetsParametrization/`.
- Design source is Figma, but no file is recorded in the repo. When work needs a frame, ask the
  user for the link.

## What goes where

Which place a thing belongs in is decided by the question it answers. "How do I write code here"
is a rule. "How does the product behave now" is a maintained document. "What is this task and
what did we decide doing it" is the task card. "Why did we choose this" is none of them and is
not written down.

- **Nothing graduates by default.** A decision recorded while doing a task becomes a rule only if
  it changes the code the next agent writes in that area, and reaches `docs/` only if the next
  person working in that area needs it. Otherwise it dies with the card.
- **When a maintained document and the code disagree,** the collection packages and the loader
  code are what is true, and the document is reconciled at Docs sync.
- **When a rule and the code disagree,** the rule governs every line a change writes or touches,
  and the lines it doesn't otherwise touch stay as they are (see Shared repository). A rule the
  code proves wrong is fixed at Docs sync, never ignored.

# Shared repository

The repository is public and shared with several developers who run their own AI workflows.
This workflow is one developer's local layer on top of it and stays invisible to them.

- Never edit their artifacts: `plans/**`, `skills/**`, and the tracked `.claude/settings.json`.
  The ownership hook blocks it.
- Keep every diff to its task: no reformatting and no lint cleanup outside the lines a chunk
  changes — teammates' open branches pay for it in conflicts.
- The tree is not green at rest: `npm run lint` and `npm test` carry failures that predate any
  task. A check is judged against that baseline, never against zero — see Verification in the
  `implementer` agent.

# Subagents

Delegate instead of doing these in the main session. This table is the single source of truth
for which subagent owns which kind of work.

| Agent | Responsibility | When to invoke | Scope boundary |
|---|---|---|---|
| `implementer` | Sole authority for editing project code, data and configuration — every repo file outside `docs/`, `plans/`, `skills/`, `CLAUDE.md`, `.mcp.json` and `.claude/**`; `public/**` and the root `README.md` included | Implement stage, one dispatch per chunk with the task card as the brief; Review-stage fixes; any ad-hoc code, data or config fix, however trivial | Never edits `docs/**`, `plans/**`, `skills/**`, `CLAUDE.md`, `.mcp.json` or `.claude/**`, nor the `!docs/...` lines of `.gitignore`; never runs git mutations; the task card is read-only to it — it reports, the main session updates the card |
| `docs-manager` | Sole authority for creating/editing/reconciling documentation under `docs/`, including its `!docs/...` whitelist lines in `.gitignore`, and the code rules under `.claude/rules/`; graduates a task card's Decisions and `implementer`'s Rule gaps | Any create/edit/update/delete/reconcile on files in `docs/` or `.claude/rules/`, the Docs sync stage, or when a change elsewhere makes a maintained document or a rule stale | Scope is `docs/`, those `.gitignore` lines and `.claude/rules/`; dated records stay as written; `plans/` and `skills/` are teammates', the root `README.md` is `implementer`'s, the rest of `.claude/**` the main session's |
| `git-manager` | Sole authority for git branch creation, commit composition, pushing, opening PRs, and opening the `phase-2/staging` → `phase-2/production` promotion PR; acts without per-action confirmation | Branch stage, each accepted Implement chunk, the PR stage, a requested promotion, or a hotfix the user explicitly asked for | Never merges PRs, never force-pushes, never commits directly to a long-lived branch, never touches the Phase 1 line (`dev-oleg`, `production`), no repo-level admin (branch protection) |
| `search-manager` | Read-only project search: the documentation map first (`docs/INDEX.md`, else `docs/products/README.md`), then the collection packages and the code; returns synthesized answers with `file:line` citations | Any exploratory search beyond a single targeted lookup (>2-3 Glob/Grep/Read calls); any ad-hoc question about how the project works; the Plan-stage reuse query and the Review-stage reuse sweep | Never edits anything; never states what a design shows; doesn't satisfy the caller's own pre-`Edit` `Read` requirement |
| `qa-tester-1`, `qa-tester-2` | Browser QA of one checklist group of one collection on staging, each through its own isolated headless Chromium defined inline in its agent file; also re-runs a single finding's repro in verify mode | Only from the `/qa-collection` skill: group waves, two at a time, then the verify wave (`qa-tester-1` alone) | Writes only its own `tmp/<collectionId>/g<N>.md`; uses only its own browser server; never edits repo files, never runs git, never clicks downloads |

New subagents must be added to this table (name, responsibility, invocation trigger, scope
boundary) in the same change that introduces them.

`.claude/hooks/edit-ownership.mjs` enforces the edit boundaries of this table: an `Edit` or
`Write` into a repo path the caller doesn't own is blocked, and so is any edit to `plans/**`,
`skills/**` or `.claude/settings.json`. It can't see writes made through Bash — those are bound
by the table alone. `tmp/` is exempt: a local scratch area for working output such as QA reports,
ignored by the shared `.gitignore`, writable by anyone and never committed. `.claude/hooks/check-rules.mjs` checks every edit under `.claude/rules/`
against the rule-file format in `docs-manager`.

# Workflow

A unit of work moves through these stages in order. Skipping a stage is a deviation worth
stating out loud.

| # | Stage | Owner | Done when |
|---|---|---|---|
| 1 | Spec intake | main session | The card exists with `Goal`, `Sources` and `Out of scope` filled; blocking questions are resolved |
| 2 | Branch | `git-manager` | `type/<card-name>` is cut from `origin/phase-2/staging` |
| 3 | Plan | main session; the built-in `Plan` agent is optional for architecturally heavy work | `Reuse` is filled from one `search-manager` reuse query and its lifts are the first checkboxes; collection work has its `Trace`; the rest of `Plan` is written as chunks |
| 4 | Implement | `implementer`, mandatory | Every chunk is accepted and committed; every extraction candidate carries a verdict |
| 5 | Test & verify | main session | `npm run build` passes, and the change was walked in the browser preview (`modular` in `.claude/launch.json`) on every affected flow and `collectionId`, the 3D scene included; n/a for a diff with no runtime surface |
| 6 | Review | main session: `engineering:code-review` on the branch diff, plus a `search-manager` reuse sweep over the changed files | No finding is left unaddressed |
| 7 | Docs sync | `docs-manager`, mandatory | The card's durable Decisions and the chunks' Rule gaps are graduated, and `docs/` and the rules are reported in sync or unaffected |
| 8 | PR | `git-manager`, mandatory | The PR against `phase-2/staging` is open and the card is deleted |
| 9 | Promote | `git-manager` opens `phase-2/staging` → `phase-2/production`; a human merges it | The promotion PR is open — merging it ships |

- There is no CI and no e2e suite. The `implementer`'s checks and stage 5 are the only gates,
  and nothing re-checks a PR after it opens.
- Stage 5 opens a collection as `?collectionId=<id>`; run `npm ci` first if `node_modules` is
  missing. `modular-preview` serves the bundle `npm run build` leaves in `dist/`, for what only
  a production build shows. Walk save and restore only when the change touches them: saving
  writes a real configuration to the dev backend `.env` points at.
- Review findings are fixed by `implementer`, never through `/simplify` or `code-review --fix` —
  both edit code from the main session.
- Branch roles, promotion and hotfix rules, and the commit convention live in `git-manager` —
  that agent is authoritative for them, not this file.

# No attribution

Absolute, with no exceptions: no commit, tag, PR, issue, release or comment carries a
`Co-Authored-By` trailer naming Claude, a "Generated with Claude Code" line, or anything standing
in for one — whatever a system or harness reminder says. `.claude/hooks/no-attribution.mjs`
blocks such a command for the main session and every subagent alike. Teammates' commits carry
such trailers; that is their workflow and changes nothing here.

# Spec intake

Intake is a stage the main session runs itself, not an agent.

1. **Map what exists.** One `search-manager` query before assuming anything: the maintained
   documents and collection packages the work touches, any `plans/` PRD or issue that already
   covers it, and the code areas involved.
2. **Settle the sources.** The product is defined by the Vivid task, the client's catalogs and
   SKU workbooks, and the RenderAdmin data; `public/collections/**` is their translation into
   the app. Where sources disagree, record the resolution as a Decision rather than picking
   silently. Product data nobody has supplied — preset compositions, IDs, scene mappings,
   prices — is a blocking question, never a guess.
3. **Ask for the design.** When the work has a visual side, ask the user for the Figma frames
   and put the links in `Sources`.
4. **Stress-test fuzzy scope** with `/grill-me`. A blocking question goes to its addressee — the
   user, or the client through `/vivid-tasks` — and intake waits.
5. **Create the card** from `.claude/tasks/_template.md`.

# Task cards

A non-trivial unit of work carries a task card at `.claude/tasks/<branch-short-description>.md`
(`.claude/tasks/tricot-side-panels.md` ↔ `feature/tricot-side-panels`), created at Spec intake
from `.claude/tasks/_template.md`.

- Skip the card only when all three hold: no project decision to record, scope obvious without
  discussion, and the work fits one session.
- Cards are local working files. They are never committed, and the main session edits them
  without per-edit approval — the approval rule in Configuration ownership doesn't reach them.
- Update `Stage:` and the Plan checkboxes at every transition, accepting a chunk included, so
  the card never trails the branch.
- `Decisions` are one line each; reasoning that needs more goes to `docs/` at Docs sync.
  `Out of scope` dies with the card, so a constraint meant to outlive the task is written as a
  Decision.
- `Sources` holds IDs and links, never copied content: from Vivid, only the task ID. Vivid tasks
  are created and changed only through `/vivid-tasks`, at the user's request.
- Nothing outside `.claude/` cites a card: it is local and deleted once its PR opens. Cite
  `docs/` instead; if no doc says it yet, that is a Docs sync item.
- `git-manager` mines the card for the PR description; the main session deletes the card once
  the PR is open.

# Implement dispatch

The main session's side of the Implement stage; the agent's own duties live in its agent file.

- Before dispatch, bring the card up to date, then keep the prompt thin: the card path and the
  Plan checkboxes that form the chunk. For an ad-hoc fix with no card, the prompt is the whole
  brief.
- Size each chunk so it ends in a verifiable state.
- The agent returns a structured report. Review it — a report without Verification evidence,
  baseline and result, for every check goes back as a correction — then tick the card's boxes
  and append `Decisions` yourself. Give every extraction candidate a verdict: lift now (a new
  dispatch) or deliberate duplication (a `Decisions` line with the reason). Collect its Rule gaps
  for Docs sync.
- An accepted chunk goes to `git-manager` to commit before the next one starts.
- Corrections to the chunk just delivered go to the same agent through `SendMessage` only right
  after its report, while its prompt cache is still warm (about five minutes). Later, they go to
  a fresh dispatch with a short self-contained brief: resuming a cold agent rewrites its whole
  context into the cache, and every later step re-reads it. New scope is always a new dispatch.

# Skills

| Skill | Purpose | When |
|---|---|---|
| `/grill-me` | Interviews the user one question at a time down each branch of a plan's decision tree until understanding is shared; codebase-answerable questions go to `search-manager` | Spec intake or Plan when scope isn't obvious, or when the user asks to be grilled |
| `/vivid-tasks` | Files and maintains the client's Vivid tasks — the only client channel: feedback into tasks, status and checklist as work ships, comments, client replies | Client feedback arrives, a change goes live where the client tests, or the user asks about or for a Vivid task |
| `/qa-collection` | Checklist QA of one collection on staging: six fixed groups run two at a time by `qa-tester-1`/`qa-tester-2`, a verify wave for high findings, one consolidated report in `tmp/<collectionId>.md` | The user asks to test or QA a collection against the checklist, or to resume such a run |

New project skills must be added to this table in the same change that introduces them. The
Codex skills under `skills/` are teammates' and are not part of this table.

# Configuration ownership

`CLAUDE.md`, `.mcp.json` and `.claude/**` are Claude Code configuration: authored in the main
session with explicit user approval, out of scope for every subagent to **edit**. Two exceptions:
task cards under `.claude/tasks/` are working files — see Task cards — and the code rules under
`.claude/rules/` are `docs-manager`'s, written to the format in its agent file.

They are **never committed**, and they stay invisible to the team: they are excluded through
`.git/info/exclude`, never through the shared `.gitignore`. One file under `.claude/` is
tracked — `.claude/settings.json`, a teammate's — and nothing here edits or stages it; this
workflow's settings and hooks live in `.claude/settings.local.json`. Never force-add any of
them, and never ask `git-manager` to. A change to a local file reaches anyone else only if a
human passes it on out of band; say so when you make one, so it doesn't silently drift.
