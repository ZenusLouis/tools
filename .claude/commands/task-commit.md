---
name: task-commit
model: claude-haiku-4-5-20251001
description: Git commit staged changes with task ID in message
---

# /task-commit — Commit Task Changes

Creates a git commit in the project directory with the task ID in the message.

## Usage
```
/task-commit M2-F1-T3
```

## Steps
1. `git -C <path> diff --staged --stat` → check staged files
   - If nothing staged → show: "No staged changes. Stage all modified files? [yes / list to select / cancel]"
   - If yes → `git -C <path> add <files changed by this task>` (use code-index to identify task files)
2. `git -C <path> diff --staged` → read diff (abbreviated if > 50 lines)

## GATE 4 (mandatory stop)
```
Diff summary:
  Modified: <file> (+<n> / -<n> lines)
  Added: <file> (<n> lines)

Commit message:
  "[M2-F1-T3] <task-name>"

Confirm? [yes / edit message / cancel]
```

## After Confirmation
1. `git -C <path> commit -m "<message>\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"`
2. Capture commit hash
3. Update `projects/<name>/progress.json` → task status = "completed"
4. Write to `projects/<name>/logs/YYYY-MM-DD.jsonl`:
   ```jsonl
   {
     "taskId": "<id>", "taskName": "<name>", "status": "completed",
     "endTime": "<now>", "durationMin": <elapsed>,
     "filesChanged": ["<list>"], "commitHash": "<hash>",
     "tokensUsed": <estimate>, "risks": [], "assessment": "<summary>"
   }
   ```
5. Write to `logs/global-YYYY-MM-DD.jsonl` (global cross-project log):
   ```jsonl
   {
     "project": "<name>", "taskId": "<id>", "taskName": "<name>",
     "status": "completed", "timestamp": "<now>", "durationMin": <n>,
     "tokensUsed": <n>, "costUSD": <estimate>, "commitHash": "<hash>", "risks": []
   }
   ```
6. Determine next task: scan `progress.json` for next task in same module with `status = "pending"`, ordered by ID. Set `context.json["activeTask"]` to that ID, or `null` if module complete.

## Notes
- Requires files to be staged: `git -C <path> add <files>` before running
- Skips if no staged changes (shows warning)
