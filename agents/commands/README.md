# Shared Agent Commands

Shared commands describe intent once, then each provider adapter maps it to its own syntax.

## Core Commands

- `prepare-brief`: BA/research agent creates task context and acceptance criteria.
- `implement`: dev agent applies scoped code changes and runs checks.
- `review`: reviewer/QA agent checks bugs, regressions, and missing tests.
- `learn`: agent records a lesson, decision, or recurring project rule.
- `sync-artifact`: agent sends `brief.md`, `implementation.md`, or `review.md` back to the dashboard.

Claude command files are in `.claude/commands`.
Codex and ChatGPT command adapters should reference these shared command names.
