---
name: run-task
model: claude-sonnet-4-6
description: Execute a specific task — Claude reads design, finds files, writes code
---

# /run-task — Execute Task

Claude implements a specific task using code-index + design-map for minimal token use.

## Usage
```
/run-task M2-F1-T3          → run single task
/run-task M2-F1             → run all pending tasks in feature F1 sequentially
/run-task M2                → run all pending tasks in module M2 sequentially
/run-task M2-F1-T3 --dry-run → show plan without writing
```

## ID Resolution
- `M2-F1-T3` → run exactly that task
- `M2-F1` → find all tasks in progress.json where id starts with "M2-F1-", status = "pending", run sequentially T1→T2→T3...
- `M2` → find all pending tasks in module 2, run sequentially by feature order
- After each task in a sequence: show result + ask "Continue to next task? [yes / stop]"

## Steps (token-optimized)
1. Read `projects/<name>/progress.json` → task name, description, module
2. Read `projects/<name>/design-map.json` → nodeId for this task
   **If file missing** (i.e., `/design --figma` was never run) → treat all tasks as `null` (skip Figma entirely)
3. Read `projects/<name>/decisions.md` → relevant constraints (Grep for task module)
4. Read `projects/<name>/code-index.md` (full) → find relevant files
5. Read ONLY the files identified in step 4 (1-3 files max)
6. If nodeId ≠ null → call `figma.get_design_context(fileKey, nodeId)` — exact node
7. If nodeId = null → skip Figma entirely
8. Implement task
9. Update `code-index.md --delta` for any new/changed files
10. Update `progress.json` task status → "in-progress"

## GATE 3 (first task of each module)
Before starting the first task of a new module:
```
Starting Module <n>: <name> (<total> tasks)
First task: <id> — <description>
Begin? [yes / skip module / reorder]
```

## After Implementation
- Show files changed summary
- Suggest: `/task-commit <id>`
- Log task start time to `logs/YYYY-MM-DD.jsonl`

## Error Handling
- If file not in code-index → ask user: "File not indexed. Run /code-index first?"
- If env var missing → show GATE: "Needs `<VAR>`. Add to .env or use .env.example?"
- If dependency task not done → show GATE: "Depends on <id> (not done). Skip/wait/reorder?"
