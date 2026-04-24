# sync-artifact

## Purpose

Send role output back to the dashboard through the bridge API.

## Artifact Kinds

- `brief`
- `implementation`
- `review`
- `learning`

## Bridge Endpoint

`POST /api/bridge/artifact`

Include provider, role, model, workspace, device, task ID, artifact kind, and markdown content.
