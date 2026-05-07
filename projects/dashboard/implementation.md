# Dashboard Runtime Hardening Implementation

## Changed

- Added MCP DB refresh from repo config through `/api/mcp/refresh` and wired it into the MCP Monitor page.
- Added MCP audit events for server/profile changes and registry refresh.
- Added Figma MCP profile support for `figma-mcp-go`.
- Added backend pagination to project run queue.
- Made run queue detail reads expire stale bridge actions before returning status.
- Updated run queue UI to use page navigation, treat `claimed` as live, and allow retry for `expired` runs.
- Changed local agent command logs to emit `CWD:` and `CMD:` separately instead of chaining commands with `&&`.
- Added Codex local default `--skip-git-repo-check` for queued task runs.
- Extracted local command discovery into `hooks/gcs_bridge/command_utils.py`.
- Extracted bridge heartbeat payload/reporting into `hooks/gcs_bridge/heartbeat.py`.
- Extracted bridge file-action progress, lease, and cancel status checks into `hooks/gcs_bridge/action_lifecycle.py`.
- Extracted bridge state loading/saving and JSONL log sync into `hooks/gcs_bridge/telemetry.py`.
- Extracted file-action polling/result posting into `hooks/gcs_bridge/action_runner.py`.
- Extracted BRD/PDF analysis helpers and robust module JSON parsing into `hooks/gcs_bridge/analysis_runner.py`.
- Extracted Codex local SQLite daily thread meter sync into `hooks/gcs_bridge/codex_meter.py`.
- Extracted task prompt/context-budget builder into `hooks/gcs_bridge/prompt_builder.py`.
- Extracted local task process stream formatting and pipe draining into `hooks/gcs_bridge/task_runner.py`.
- Extracted task artifact paths, local `.claudeignore` setup, task-event/artifact posting, and progress snapshot sync into `hooks/gcs_bridge/task_artifacts.py`.
- Extracted file-action execution orchestration into `hooks/gcs_bridge/local_action_executor.py`, including local analysis, task runs, code-index generation, and metadata sync.
- Reduced `hooks/gcs_bridge_daemon.py` to a thin runtime entrypoint: environment setup, dependency wiring, heartbeat/log/token/action polling loop, and auto-reload.
- Started Phase 4 token normalization by adding meter totals for provider-reported usage, local hook estimates, and Codex thread-meter tokens.
- Updated dashboard/token analytics wording so mixed meters are shown as tracked usage units, with provider cards carrying their own meter labels and cost source.
- Updated run telemetry normalization so local Codex runs store Codex credits/normalized cost separately instead of treating thread meter values as regular provider tokens.
- Added task-run telemetry as a separate Token Analytics history source, so run actual/estimated tokens can be reviewed without folding them into mixed provider totals.
- Restricted OpenAI usage sync to OpenAI Admin/Usage keys only; runtime OpenAI keys no longer trigger organization usage sync fallback.
- Added structured local task-run result telemetry from the bridge: `providerTokens`, `codexCredits`, `normalizedCostUsd`, `tokenMeter`, and usage split now persist with the action result/context report.
- Updated run queue and task detail status APIs/UI to display Codex thread-meter usage separately from Claude hook-token estimates and provider-reported tokens.
- Started Phase 5 secret safety/audit hardening: login/logout are audited, bridge artifact sync is audited as a local-file artifact event, bridge result errors are sanitized before persistence, and artifact sessions no longer persist raw artifact content in `filesChanged`.
- Started Phase 6 Skill Brain v2 metadata: `SkillDefinition` now stores source type, source priority, content hash, import mode, trusted source slug, compact guidance, and metadata; repo sync populates those fields from local/generated/learning/marketplace/trusted sources.
- Updated the zero-token optimizer to use stored compact guidance and direct source-priority boosts instead of relying only on tag parsing.
- Updated Library/Skills API to return compact skill metadata without raw `content`, show source type/priority/hash/import mode/trusted source details in the skill detail view, and sort installed skills by source priority.
- Updated skill import to store source metadata, content hash, compact guidance, and an audit event.
- Added `skill_brain_refreshed` audit events for manual brain refreshes.
- Hardened Phase 7 zero-token optimizer retry behavior: previous failure tails now boost debugger/reviewer/diagnostic skills deterministically, context escalation is recorded, and retry helper skills can replace weak selected skills without any LLM routing call.
- Added optimizer/router observability to task run preview and run queue details: retry escalation reason, helper skill, selected skill source metadata, top omitted candidates, and run telemetry metadata are visible after queueing or opening a run.
- Persisted retry escalation/top-candidate counts in run telemetry metadata and action audit/session notes so queue history explains why a retry used broader context or different skills.
- Started Phase 8 runtime memory retrieval: task runs now select related memory snippets by project, requirement IDs, and deterministic keyword matching with 0 LLM tokens, then attach only the compact snippets to the bridge payload, prompt artifact, context report, and optimizer preview.
- Expanded Phase 8 Memory Graph sync with real edges: project/module/feature/task/requirement/run/skill nodes now link through deterministic relations such as `belongs_to_project`, `belongs_to_feature`, `implements_requirement`, `run_of_task`, and `used_skill`.
- Updated Memory Graph search and Knowledge UI to return/display excerpt, score, match reasons, node/edge refresh counts, and 0-token routing status consistently.
- Updated Obsidian export so generated notes include relation sections from memory edges, plus export metadata now reports edge count.
- Replaced the Obsidian Logic lab concept screen with a real runtime console: node/edge/kind metrics, project-filtered memory search, recent memory cards, graph refresh, and Obsidian vault export actions.
- Started Phase 9 MCP Tool Plane runtime visibility: MCP servers now carry runtime hints, local stdio servers show bridge-required/configured status, server details show available tool hints, last audited call/error, and MCP Monitor includes the Figma design flow stages.

## Verification

- `npm run lint` passed.
- `npx tsc --noEmit` passed.
- `npm run build` passed.
- `python -m py_compile hooks/*.py hooks/gcs_bridge/*.py` passed.
- `npx prisma generate` passed.
- `python scripts/agent_skill_catalog.py check` passed.
- `python` py_compile over `hooks/*.py` and `hooks/gcs_bridge/*.py` passed after switching away from PowerShell wildcard passthrough.
- `npm run build` passed again after Phase 7 retry UI and Phase 8 memory-snippet prompt changes.
- `npm run build` passed after Memory Graph edge sync, search API, Knowledge UI, and Obsidian export updates.
- `npm run build` passed after replacing `/labs/obsidian-logic` with the runtime Memory Graph console.
- `npm run build` passed after MCP runtime status/tool hint and Figma design flow UI updates.

## Gaps

- Spring Boot extraction remains a later phase.
- MCP online tool-call telemetry is not implemented yet.
- Full Spring Boot extraction remains staged for a later phase; local execution is still Python bridge runtime by design.
