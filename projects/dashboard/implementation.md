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

## Verification

- `npm run lint` passed.
- `npx tsc --noEmit` passed.
- `npm run build` passed.
- `python -m py_compile hooks/gcs_bridge_daemon.py hooks/gcs_bridge/bridge_client.py hooks/gcs_bridge/local_paths.py hooks/gcs_bridge/sanitizer.py` passed.

## Gaps

- Spring Boot extraction remains a later phase.
- MCP online tool-call telemetry is not implemented yet.
- Bridge daemon modular refactor is partial.
