# GCS Core API

Staged Spring Boot service for the future GCS runtime split.

The dashboard remains the production console and source of truth today. This service starts as a contract-only runtime so bridge lifecycle, telemetry, token normalization, router, memory, and audit APIs can be extracted safely behind feature flags.

## Local

```text
mvn test
mvn spring-boot:run
```

Default port: `4000`.

## Contract Endpoints

```text
GET /api/core/health
GET /api/core/contract
```

## Bridge Action Lifecycle Staging

The first extracted runtime slice is an in-memory Bridge Action Protocol v1 implementation. It is for local contract tests and feature-flag comparison only; the dashboard database still owns production actions until the DB adapter is added.

```text
POST /api/core/bridge/file-actions
POST /api/core/bridge/file-actions/pending
POST /api/core/bridge/file-actions/{id}/claim
POST /api/core/bridge/file-actions/{id}/lease
GET  /api/core/bridge/file-actions/{id}/status
POST /api/core/bridge/file-actions/{id}/result
POST /api/core/bridge/file-actions/{id}/cancel
```

Lifecycle:

```text
pending -> claimed -> running -> succeeded | failed | cancelled | expired
```

The dashboard Settings page can run a smoke test through `POST /api/core-runtime/smoke` when `GCS_CORE_API_ENABLED=true`. That smoke test creates a Spring action, claims it, refreshes a lease, posts a successful result, and reads final status.

It can also run a contract comparison through `GET /api/core-runtime/compare`. This compares the dashboard bridge contract against Spring's `/api/core/contract` response so operators can confirm payload/result versions, action types, lifecycle states, lifecycle endpoints, and telemetry fields are aligned before any route is cut over.

## Migration Rules

- Do not move Next.js routes to Spring until the contract response matches dashboard behavior.
- Add read-only comparison endpoints before switching writes.
- Keep bridge payload/result versions at `1` until both dashboard and local bridge support a new version.
- The Python bridge remains the local execution runtime during this stage.
