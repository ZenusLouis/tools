# Local Bridge

Local Claude/Codex agents become visible in the dashboard through bridge heartbeat.

## Required Env

Hook scripts auto-load missing values from `.codex/settings.json`, `.codex/settings.local.json`, and `apps/dashboard/.env.local`.
Set these manually only when running against another dashboard or workspace:

```text
DASHBOARD_URL=https://gcs-dashboard.zenus.dev
BRIDGE_TOKEN=<token from dashboard settings>
GCS_DEVICE_KEY=<stable-machine-key>
GCS_DEVICE_NAME=<human-readable-name>
GCS_PROVIDER=codex
GCS_ROLE=dev-implementer
GCS_MODEL=gpt-5.4
```

## Heartbeat

```text
python hooks/bridge-heartbeat.py
```

The request uses `User-Agent: GCS-Local-Bridge/1.0` so Cloudflare can allow bridge traffic.

## Long-Running Bridge

Run this when you want the local machine to stay visible and sync new local JSONL logs until the terminal is closed:

```text
powershell -NoProfile -ExecutionPolicy Bypass -File hooks/start-gcs-bridge.ps1
```

Default behavior:

- sends heartbeat every 30 seconds
- checks `logs/global-*.jsonl` every 5 seconds
- stays quiet for successful heartbeat responses
- starts tailing from the end on first run so old history is not duplicated
- use `--from-start` once if you intentionally want to backfill existing local logs
- use `--verbose` when you want to print every heartbeat response

## Log Events

`hooks/token-tracker.py` sends provider, role, model, workspace, and device metadata when the relevant env vars are set.

Codex only emits a session log when launched through the wrapper:

```text
powershell -NoProfile -ExecutionPolicy Bypass -File hooks/codex-gcs.ps1 "your prompt"
```

The canonical local runner is stored in `.codex/settings.json` under `runner.displayCommand`.

## Dashboard Behavior

- No login: local data is not visible.
- Logged in: dashboard shows devices and agents scoped by workspace and bridge token.
- Agent selector only shows providers that have either a dashboard API key or an online local bridge.
