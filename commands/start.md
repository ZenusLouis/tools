---
name: start
description: Bootstrap session — load context, code-index header, and progress in ~800 tokens
model: claude-haiku-4-5-20251001
---

# /start — Session Bootstrap

Loads the minimum context needed to begin work. Run at the start of every session.

## Steps (in order)
1. If active project name known from session → skip to step 3
   Else: Read `projects/registry.json` (limit: 20 lines) → ask user which project
2. (only if registry needed) Ask user: "Which project? [<list>]"
3. Read `projects/<name>/context.json` (limit: 50 lines)
4. Read `projects/<name>/code-index.md` (limit: 15 — header only)
5. Read `projects/<name>/progress.json` (limit: 30 lines)
6. Enable ONLY framework skills listed in `context.json["framework"]`
7. Enable MCP profile from `context.json["mcpProfile"]`

**Token budget: 3 reads = ~800 tokens. Registry read only when needed.**

## Output
```
✓ Project: <name> | Stack: <frameworks>
  MCP profile: <profile> loaded
  Active task: <id + name, or "none">
  Last indexed: <date>

Progress: Module <n> — <name> [<done>/<total> tasks]
Unresolved risks: <n>  (run /progress --risks)

Context loaded: ~800 tokens. Ready.
```

## Warnings
- If `lastIndexed` > 7 days old → "Index may be stale. Run /code-index --delta"
- If `activeTask` is set → "Continuing task <id>. Run /run-task <id> to resume."
- If context > 25k tokens at session start → "Run /compact first."
