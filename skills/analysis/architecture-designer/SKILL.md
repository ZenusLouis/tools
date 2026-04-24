---
name: architecture-designer
description: >
  Activate when: /design command is run after /analyze. Reads analysis-summary.md
  and produces architecture decisions, tech stack, and module breakdown.
model: claude-sonnet-4-6
allowed-tools: Read, Write
---

# Architecture Designer Skill

## Input (read in order, stop when sufficient)
1. `projects/<name>/analysis-summary.md` — SUMMARY section only (top 20 lines)
2. `projects/<name>/code-index.md` — header 15 lines (if codebase exists)
3. `projects/<name>/decisions.md` — confirmed decisions from /analyze

---

## Decision Framework

### A. Monolith vs Microservice

```
Team size < 5         → Modular Monolith  (low-risk path to microservices later)
Team size 5-10        → Modular Monolith  (extract services when team grows)
Team size > 10        → Microservices     (team autonomy justifies operational cost)
Early stage / MVP     → Monolith ALWAYS   (premature = distributed monolith anti-pattern)
> 5 distinct domains needed → Microservices
Strict data isolation required per domain → Microservices (DB per service)
All in one repo, shared DB → Stay Monolith
```

**Warning**: Microservices increase operational overhead (monitoring, network, consistency).
Start with clear domain boundaries IN a monolith; extract when pain is felt — not before.

---

### B. Database Selection

| Need | Choice | Reason |
|------|--------|--------|
| Strong consistency + complex joins | PostgreSQL | ACID, JSON support, mature, row-level security |
| Flexible/evolving schema | MongoDB | Document model, no migration pain |
| Session, cache, pub/sub, queue | Redis | Sub-millisecond reads, TTL, pub/sub built-in |
| Full-text search, faceted filters | Elasticsearch | Inverted index, aggregations, relevance scoring |
| Time-series metrics, IoT | TimescaleDB / InfluxDB | Optimized for append-only, time-window queries |
| Graph relationships | Neo4j | Traversal-optimized, Cypher query language |
| Global distribution + high availability | CockroachDB / PlanetScale | Multi-region, automatic failover |

**Rule**: Default to PostgreSQL. Add specialist DB only when PostgreSQL's limitations are actually hit.

---

### C. API Style Selection

| Style | Use When |
|-------|---------|
| **REST** | Standard CRUD, broad client base, team familiar, caching needed, OpenAPI tooling |
| **GraphQL** | Multiple FE clients (web+mobile) with different data needs, avoid over-fetching |
| **gRPC** | Service-to-service (internal), performance-critical, strong typing, streaming |
| **WebSocket** | Real-time bidirectional: chat, live feeds, collaborative editing, seat picker |
| **SSE** | Server pushes to client only: notifications, live dashboard, order status |
| **Webhook** | External system calls your API on event: Stripe, GitHub, payment gateways |

**Rule**: Default to REST. Add WebSocket/SSE only when real-time is confirmed requirement.

---

### D. Event-Driven Pattern Selection

| Pattern | Use When |
|---------|---------|
| **Domain Events** (Kafka/RabbitMQ) | Async decoupling, fire-and-forget, no rollback needed |
| **Saga** | Distributed transaction across 2+ services — need compensating rollback on failure |
| **CQRS** | Read/write traffic very unbalanced, need separate read models, complex reporting |
| **Event Sourcing** | Audit trail required, temporal queries, compliance/finance, replay capability |

**Rule**: Domain events first. Add Saga when distributed transactions appear.
CQRS+EventSourcing only for audit-critical domains — high complexity cost.

---

### E. Caching Strategy

| Strategy | Use When |
|----------|---------|
| **Cache-aside** (lazy load) | Read-heavy, tolerate slight staleness; populate on cache miss |
| **Write-through** | Writes always update cache; no staleness; higher write cost |
| **TTL-based expiry** | Session tokens, rate limit counters, temporary locks |

Redis key pattern: `{service}:{entity}:{id}` — e.g. `user:profile:123`

---

### F. Security Architecture

| Concern | Approach |
|---------|---------|
| **Stateless auth** | JWT (access token 15min TTL + refresh token 7d in httpOnly cookie) |
| **Stateful auth** | Session in Redis — use only when instant token revocation is required |
| **Service-to-service** | mTLS or API key header; never expose internal services externally |
| **OAuth2 flows** | Authorization Code + PKCE for users; Client Credentials for M2M |
| **Rate limiting** | Per IP + per user at gateway; Redis sliding window counter |
| **Secrets** | Always env vars or secret manager; never in code or git |

---

### G. Scalability Thresholds

```
< 1,000 concurrent users    → Single instance + PostgreSQL (no cache needed yet)
1,000 – 10,000 concurrent  → Horizontal scale (2-3 replicas) + Redis + CDN for static
10,000 – 100,000 concurrent → Load balancer + read replicas + Kafka/RabbitMQ queue + CDN
> 100,000 concurrent        → Microservices + CQRS + DB sharding + global CDN
```

---

## ADR Format (for each key architecture decision)

Write to `architecture-full.md` — one ADR per significant choice:

```markdown
### ADR-{n}: {Decision Topic}

**Status**: Accepted

**Context**
What problem are we solving? What forces are at play?

**Decision Drivers**
- Team size, timeline, scale requirement

**Options Considered**
| Option | Pros | Cons |
|--------|------|------|
| Option A | ... | ... |
| Option B | ... | ... |

**Decision**
We choose **Option A** because {reason tied to drivers}.

**Consequences**
- Good: {benefit}
- Bad: {trade-off to accept}

**Rejected Alternatives**
Option B rejected because {specific reason}.
Future engineers: do not revisit unless {condition} changes.
```

---

## Output Files

Save to `d:\GlobalClaudeSkills\projects\<name>\`:

### architecture-summary.md (~30 lines)
```markdown
## Stack
Frontend:  <choice> — <1-line reason>
Backend:   <choice> — <1-line reason>
DB:        <choice> — <1-line reason>
Cache:     <choice if needed>
Messaging: <choice if needed>
Auth:      JWT + refresh tokens (stateless)
Deploy:    Docker Compose (dev) / <cloud target> (prod)

## Modules
M1: Auth     (3 features, 5 tasks)
M2: <name>   (<n> features, <n> tasks)

## Key Decisions
- ADR-1: <topic> → <choice>
- ADR-2: <topic> → <choice>

## Assumptions (confirm at GATE 2)
- <assumption needing user confirm>
```

### architecture-full.md
Full ADR records, all API endpoint contracts, complete DB schema (tables + indexes + relations),
NFR details (p95 latency targets, concurrent user estimate), risk register.

---

## After Design
1. Show GATE 2 with `architecture-summary.md` content + assumptions list
2. Wait for user approval
3. After approval → suggest `/scaffold <framework>`
4. If `--figma` → describe screens for Stitch generation — do NOT auto-call Figma MCP

## Learned Patterns
<!-- auto-learned entries appended below -->
