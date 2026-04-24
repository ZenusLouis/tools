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
