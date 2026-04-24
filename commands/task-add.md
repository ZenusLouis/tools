---
name: task-add
model: claude-haiku-4-5-20251001
description: Add a new task to the active project's task list
---

# /task-add — Add Task

Adds a new task to the project's progress.json.

## Usage
```
/task-add "Implement Stripe webhook handler" --module=booking --feature=payment
/task-add "Fix JWT refresh token rotation bug" --module=auth
```

## Steps
1. Read `projects/<name>/progress.json`
2. Determine next task ID in the specified module (auto-increment)
3. Create task entry:
   ```json
   {
     "id": "M2-F2-T4",
     "name": "<description>",
     "module": "<module>",
     "feature": "<feature>",
     "status": "pending",
     "createdAt": "<now>",
     "estimate": null,
     "dependencies": []
   }
   ```
4. Append to `progress.json`
5. Add to TodoWrite

## Output
```
✓ Task added: M2-F2-T4 — Implement Stripe webhook handler
  Module: Booking > Payment
  Run /run-task M2-F2-T4 to execute.
```
