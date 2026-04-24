---
name: compact
model: claude-haiku-4-5-20251001
description: Compress conversation context into memory to free up token space
---

# /compact — Compress Conversation

Summarizes the current conversation into memory files and signals a fresh start.
Run when conversation exceeds ~25k tokens.

## Usage
```
/compact
```

## Steps
1. Extract key information from conversation:
   - Decisions made (new entries for `decisions.md`)
   - Tasks completed or in progress
   - Code changes made (files + what changed)
   - Blockers or risks discovered
   - Lessons learned (new entries for `memory/global/lessons.md`)
2. Append new decisions to `projects/<name>/decisions.md`
   (decisions.md IS read on every /run-task — high value write)
3. Append new lessons to `memory/global/lessons.md` if applicable
   (lessons.md IS checked by /research — high value write)
4. Update `progress.json` if task states changed
5. Write session-level log entry to `logs/global-YYYY-MM-DD.jsonl`:
   ```jsonl
   {
     "type": "session", "project": "<name>", "date": "<today>",
     "tasksCompleted": ["<ids>"], "tasksBlocked": ["<ids>"],
     "totalTokens": <n>, "totalCostUSD": <n>,
     "sessionNotes": "<summary>"
   }
   ```
6. Output: "Context compressed. Run /start to reload essentials."

**Note:** Do NOT write to `projects/<name>/memory.md` — that file is never auto-loaded and wastes a write. Use `decisions.md` for project-specific facts and `memory/global/lessons.md` for general patterns.

## When to Run
- Auto-warned by hook when conversation > 25k tokens
- Before switching to a different project in the same session
- At end of day before closing

## After /compact
Run `/start` to reload the 3-file bootstrap (800 tokens) and continue fresh.
