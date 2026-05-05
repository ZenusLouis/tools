# Decisions — Dashboard

## Confirmed 2026-04-19

### D1 — CLAUDE_ROOT env var
Use `process.env.CLAUDE_ROOT` defaulting to `d:\GlobalClaudeSkills`.
All file reads/writes in Server Actions resolve paths via this env var.
Add `CLAUDE_ROOT=d:\GlobalClaudeSkills` to `.env.example`.

### D2 — MCP Status
MCP server status is always `Unknown` — no connectivity check performed.
Display yellow "Unknown" badge. No ping/health-check logic needed.

### D3 — Token Cost Calculation
No `cost` field in log files. Cost calculated from token count:
- Formula: `(tokens / 1_000_000) * 3.0` (Haiku rate, $3/M tokens)
- Apply consistently across M1 stat cards, M3 analytics, M8 task detail.

### D4 — Design Source
Implement directly from BRD spec — do not pull Stitch screens via MCP.
Stitch IDs in BRD §8 are for reference only.

### D5 — Git Workflow
User does NOT want git commands (init, add, commit, config) run via Bash tool.
For /task-commit: skip automated git steps or ask user to run `! git ...` manually.

## Session Progress (2026-04-19)
**Completed:** M0 (3/3), M1 (5/5), M2 (7/7), M3 (6/6), M4 (1/6) — 22 tasks total  
**In progress:** M4-F1-T2 (Documents section)  
**Remaining:** M4 (5 tasks), M5–M8 (27 tasks)  
**Next:** M4-F1-T2 (BRD/PRD/API spec file path inputs) or M4-F1-T3 (Tools & Integrations)

## 2026-05-05: Bridge & Daemon Fixes

### proxy.ts PUBLIC_PATHS
Added `/api/admin` and `/api/bridge/prompt-context` to PUBLIC_PATHS. Bridge daemon has no session cookie — all bridge routes must be explicitly public.

### start.sh prisma db execute
Added `--url "$DATABASE_URL"` to fix "Either --url or --schema must be provided" error in Docker standalone build.

### _fetch_task_prompt — no more silent fallback
Replaced fallback generic prompt with `raise ValueError`. Claude was silently running the wrong task (M0-F0-T1 instead of M0-F2-T2) and burning 522k tokens reading the BRD.

### Bridge log preservation (result route)
Merged `log` arrays in result route instead of overwriting — accumulated progress logs no longer wiped by 3-line completion summary.

### code-index injection in daemon
Daemon reads `projects/<name>/code-index.md` (hub fallback) or `<project>/.gcs/code-index.md` and injects into prompt. Prevents Claude re-scanning project structure every task (~20 wasted tool calls).

### post_action_progress before prompt fetch
Moved progress log call before `_fetch_task_prompt` so errors show in UI log box instead of leaving it blank.

### GCS_MAX_TURNS env var
`--max-turns` now configurable via `GCS_MAX_TURNS` (default 15).
