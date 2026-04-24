---
name: token-saver
description: >
  Always active. Enforces token-saving behavior: code-index first, split reads,
  lazy loading, and compact triggers.
model: claude-haiku-4-5-20251001
disable-model-invocation: true
---

# Token Saver Skill

## Mandatory Read Order (enforced)
1. **Before any file search** → Read `projects/<name>/code-index.md` (header 15 lines first)
2. **Before reading any file** → Confirm it's in code-index or Glob result
3. **For large files (> 300 lines)** → Use `offset` + `limit` params, not full read
4. **For finding a symbol** → Grep first, then Read only the matched file

## File Size Guards
- > 300 lines: Read with offset/limit — never full
- > 1000 lines: Grep for section marker first, then targeted Read
- Binary/lock files: skip — `node_modules/`, `package-lock.json`, `yarn.lock`, `*.lock`, `dist/`, `.next/`

## Session Bootstrap (only 3 reads)
```
1. context.json        (~30 lines)
2. code-index.md       (15 lines — header ONLY, offset=0 limit=15)
3. progress.json       (~20 lines)
```
Full code-index loaded only during /run-task.

## Output Rules
- Lists > 10 items: show top 5 + "... N more (use --all to expand)"
- Code output > 50 lines: show skeleton + "full code written to <file>"
- Progress board default: active module only (not all modules)

## Compact Trigger
When conversation context estimate > 25k tokens:
→ Print: `⚠ Context ~25k tokens. Run /compact to free up context.`
→ Do NOT block — just warn once per 5k token increment

## Model Routing
Use Haiku model for these commands (read-only, no reasoning needed):
- `/token-stats`, `/task-log`, `/task-list`, `/progress`, `/start`

Use Sonnet for:
- `/analyze`, `/design`, `/run-task`, `/research`

## Glob Pattern Guard
Warn if Glob pattern is `**/*` without file extension filter:
→ "Pattern may match too many files. Add extension filter? e.g., `**/*.ts`"
