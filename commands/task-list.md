---
name: task-list
description: View tasks with optional module/status filter
model: claude-haiku-4-5-20251001
---

# /task-list — List Tasks

Shows tasks from the active project.

## Usage
```
/task-list                      → pending tasks in active module
/task-list --module=auth        → all tasks in auth module
/task-list --status=blocked     → all blocked tasks
/task-list --all                → all tasks (all modules, all statuses)
```

## Output Format
```
Module 2: Booking [████░░░░░░] 40% (2/5)

  ✓ M2-F1-T1 Create booking model          [done]
  ✓ M2-F1-T2 Booking API endpoints         [done]
  ○ M2-F1-T3 Payment integration           [in-progress]
  ○ M2-F1-T4 Email notification            [pending]
  ✗ M2-F1-T5 Booking history page          [blocked: needs design]
```

## Status Icons
- ✓ completed
- ○ pending / in-progress
- ✗ blocked
- ⏸ skipped
