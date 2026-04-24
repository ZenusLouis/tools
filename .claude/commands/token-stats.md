---
name: token-stats
description: Show token usage statistics for today, this week, and by project
model: claude-haiku-4-5-20251001
---

# /token-stats — Token Usage Statistics

Reads global log files and summarizes token consumption.

## Usage
```
/token-stats           → today + this week
/token-stats --week    → past 7 days breakdown by day
/token-stats --project → breakdown by project (all time)
```

## Output (default)
```
TOKEN USAGE REPORT — 2026-04-18

Today:       12,450 tokens  (~$0.10)
This week:   87,320 tokens  (~$0.70)
This month: 312,000 tokens  (~$2.50)

Today's top tool consumers:
  Read         5,100  (41%)
  Write        3,200  (26%)
  Bash         2,400  (19%)
  Agent        1,750  (14%)

⚠ At current rate: ~375k/month ($3.00)
```

## Data Source
Reads all `logs/global-YYYY-MM-DD.jsonl` files.
Groups by `tool` field in log entries (Read / Write / Bash / Agent / Grep / Glob).
Note: logs track tool-level calls, not command-level (/analyze, /run-task).
Use `--session-end` flag on token-tracker.py for a per-session breakdown.
