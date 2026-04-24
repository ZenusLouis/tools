---
name: task-log
description: View detailed log for a specific completed task
model: claude-haiku-4-5-20251001
---

# /task-log — View Task Log

Shows the full log entry for a completed task.

## Usage
```
/task-log M2-F1-T3
```

## Steps
1. Grep `projects/<name>/logs/` for `"taskId": "M2-F1-T3"`
2. Parse and format the JSONL entry

## Output
```
Task: M2-F1-T3 — Payment integration (Stripe webhook)
Status:   ✓ Completed
Module:   Booking > Payment
Duration: 1h 47m  (2026-04-18 09:15 → 11:02)
Tokens:   5,840  (~$0.047)
Files:    stripe.service.ts, webhook.controller.ts
Commit:   a3f9c12
Risks:    ⚠ Stripe webhook secret missing in .env.prod
Lesson:   → Saved to nestjs/SKILL.md
```
