---
name: progress
description: Show task board with progress, token summary, and unresolved risks
model: claude-haiku-4-5-20251001
---

# /progress — Task Board

Shows project progress. Default: active module only (to avoid dumping 100+ tasks).

## Usage
```
/progress                → active module + summary bar
/progress --module M2    → full Module 2 task list
/progress --all          → all modules (use for review)
/progress --risks        → only tasks with unresolved risks or blocked tasks
```

## Default Output
```
PROJECT: <name>  [████████░░] 80%

Active: Module 2 — Booking  [████░░░░░░] 40% (2/5)
  ✓ M2-F1-T1 Create booking model
  ✓ M2-F1-T2 Booking API endpoints
  ○ M2-F1-T3 Payment integration     ← IN PROGRESS
  ○ M2-F1-T4 Email notification
  ✗ M2-F1-T5 Booking history         ← BLOCKED: needs Figma design

Other modules: M1 Auth ✓ (5/5) · M3 Admin ○ (0/8)

Tokens today: 12,450  |  This week: 87,320
Unresolved risks: 2  (run /progress --risks)
```

## Data Sources
- `projects/<name>/progress.json` — task states
- `logs/global-YYYY-MM-DD.jsonl` — today's token count (sum, all projects)

## progress.json Schema
```json
{
  "project": "MovieTheater",
  "activeModule": 2,
  "modules": {
    "1": {
      "name": "Auth",
      "tasks": [
        {
          "id": "M1-F1-T1",
          "name": "Setup Prisma User model",
          "feature": "UserAuth",
          "status": "completed",
          "createdAt": "2026-04-18T09:00:00Z",
          "startedAt": "2026-04-18T09:10:00Z",
          "completedAt": "2026-04-18T09:30:00Z",
          "commitHash": "b7d3e91",
          "blockedReason": null,
          "risks": [],
          "dependencies": []
        }
      ]
    }
  }
}
```
**Status values**: `"pending"` | `"in-progress"` | `"completed"` | `"blocked"`
