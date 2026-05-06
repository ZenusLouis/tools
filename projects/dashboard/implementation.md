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
- Kept `hooks/gcs_bridge_daemon.py` as the runtime entrypoint while moving bridge subsystems into focused modules.

## Verification

- `npm run lint` passed.
- `npx tsc --noEmit` passed.
- `npm run build` passed.
- `python -m py_compile hooks/gcs_bridge_daemon.py hooks/gcs_bridge/action_lifecycle.py hooks/gcs_bridge/action_runner.py hooks/gcs_bridge/analysis_runner.py hooks/gcs_bridge/bridge_client.py hooks/gcs_bridge/codex_meter.py hooks/gcs_bridge/command_utils.py hooks/gcs_bridge/heartbeat.py hooks/gcs_bridge/local_paths.py hooks/gcs_bridge/prompt_builder.py hooks/gcs_bridge/sanitizer.py hooks/gcs_bridge/task_runner.py hooks/gcs_bridge/telemetry.py` passed.

## Gaps

- Spring Boot extraction remains a later phase.
- MCP online tool-call telemetry is not implemented yet.
- Full Spring Boot extraction remains staged for a later phase; local execution is still Python bridge runtime by design.
