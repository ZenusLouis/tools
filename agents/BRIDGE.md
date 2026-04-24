# Local Bridge

Local Claude/Codex agents become visible in the dashboard through bridge heartbeat.

## Required Env

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

## Log Events

`hooks/token-tracker.py` sends provider, role, model, workspace, and device metadata when the relevant env vars are set.

## Dashboard Behavior

- No login: local data is not visible.
- Logged in: dashboard shows devices and agents scoped by workspace and bridge token.
- Agent selector only shows providers that have either a dashboard API key or an online local bridge.
