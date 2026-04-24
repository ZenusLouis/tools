---
name: task-done
description: Mark a task as completed (without git commit)
model: claude-haiku-4-5-20251001
---

# /task-done — Mark Task Complete

Marks a task as done in progress.json. Use when work is done but commit was separate.

## Usage
```
/task-done M1-F1-T2
```

## Steps
1. Update `progress.json` task status → "completed"
2. Set `context.json["activeTask"]` to next pending task
3. Print: `✓ M1-F1-T2 marked complete. Next: <next-task-id>`

## Note
For committed work, prefer `/task-commit` which marks done AND logs the commit hash.
