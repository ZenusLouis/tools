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

## Bridge Mode (when GCS_TASK_ID is set)
When env var `GCS_TASK_ID` is present, the bridge invoked this skill headlessly:
- `<name>` = `$GCS_PROJECT`
- Project root for writing files = `$GCS_PROJECT_PATH` (overrides context.json path)
- Skip all GATE prompts — proceed directly
- Do NOT ask "Continue to next task?" — run only the single task in `GCS_TASK_ID`

## Steps (token-optimized)
1. Resolve `<name>`: use `$GCS_PROJECT` env var if set, else read from `context.json`
2. Read `projects/<name>/progress.json` → task name, description, acceptanceCriteria, steps
3. Read `projects/<name>/design-map.json` → nodeId for this task
   **If file missing** → treat all tasks as `null` (skip Figma entirely)
4. Read `projects/<name>/decisions.md` → relevant constraints (Grep for task module)
5. Read `projects/<name>/code-index.md` (full) → find relevant files by path
6. Determine project root: `$GCS_PROJECT_PATH` if set, else `path` from context.json
7. Read ONLY the 1-3 files most relevant to the task from code-index
8. If nodeId ≠ null → call `figma.get_design_context(fileKey, nodeId)`
9. Implement task — write to project root
10. Update `projects/<name>/code-index.md --delta` for new/changed files
11. Update `projects/<name>/progress.json` task status → "done"

## GATE 3 (first task of each module — interactive only)
Skip if `GCS_TASK_ID` is set. Otherwise:
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
