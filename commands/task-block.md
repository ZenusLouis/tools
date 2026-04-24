---
name: task-block
description: Mark a task as blocked with a reason
model: claude-haiku-4-5-20251001
---

# /task-block — Mark Task Blocked

Flags a task as blocked so it shows in `/progress --risks`.

## Usage
```
/task-block M2-F1-T5 "Needs Figma design for booking history screen"
/task-block M3-F2-T1 "Waiting for Stripe API keys from client"
```

## Steps
1. Update `progress.json` task status → "blocked"
2. Write `blockedReason` to task entry
3. Print: `✗ M2-F1-T5 blocked: <reason>`

## Shows in
- `/progress --risks`
- `/task-list --status=blocked`
