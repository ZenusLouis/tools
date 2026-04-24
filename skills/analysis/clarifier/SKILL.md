---
name: clarifier
description: >
  Activate when: Claude detects ambiguity in a task, requirement, or user request —
  vague terms, conflicting signals, missing info needed before proceeding, or a
  decision point with trade-offs. Haiku model for low-cost clarification.
role: ANALYSIS
model: claude-haiku-4-5-20251001
disable-model-invocation: true
---

# Clarifier Skill

## Pre-Check — Always Do First (zero cost if answer exists)

```
1. Grep projects/<name>/decisions.md for the topic keyword
2. Grep projects/<name>/context.json for relevant field
3. If answer found → use it, do NOT ask
```

---

## When to Activate

| Trigger | Example |
|---------|---------|
| Vague words in requirement | "should", "might", "optionally", "TBD", "etc." |
| Two valid approaches with different trade-offs | REST vs GraphQL, WebSocket vs polling |
| Figma design contradicts requirement text | Design shows modal, req says new page |
| Task estimate > 2 hours | Need to break down further |
| Missing env variable for /run-task | Need DATABASE_URL to proceed |
| Dependency task not done | T3 depends on T2 which is blocked |
| Framework version conflict | package.json has React 18, code uses React 19 API |
| Destructive operation about to happen | Delete file, drop table, overwrite uncommitted work |
| Multiple actors for same feature | Who owns this: User or Admin? |
| External service ambiguity | Which payment provider? Which SMS provider? |
| Real-time vs polling trade-off | Seat updates: WebSocket (complex) or poll every 5s (simple)? |

---

## Question Format

Short. Options explicit. No open-ended questions.

```
❓ [Topic] — quick check before proceeding

<One sentence explaining why this matters>

  A) <option> — <consequence: simple/scalable/costly/etc.>
  B) <option> — <consequence>
  C) Skip / decide later

Which? (A / B / C)
```

**Batch related questions** — max 3 per message:

```
❓ 2 quick checks before starting M2: Booking

1. Seat hold mechanism
   A) 10-min timer (Redis TTL, simpler) 
   B) Real-time lock (WebSocket, complex but instant)

2. Payment provider
   A) Stripe (international, easy SDK)
   B) VNPay (Vietnam local, more integration work)

(1: A or B?) (2: A or B?)
```

---

## After Answer Received

Immediately write to `projects/<name>/decisions.md`:

```markdown
- [M2] Seat hold: 10-min Redis TTL, not real-time WebSocket (confirmed 2026-04-18)
- [ARCH] Payment: Stripe, not VNPay (confirmed 2026-04-18)
```

Format: `- [<scope>] <decision summary> (confirmed <date>)`

---

## Rate Limits

- Max 3 questions per task (batch them)
- Max 5 clarification rounds per session
- If answer is inferable from code patterns → infer, don't ask
- If decision is reversible and low-risk → make a call, note assumption, move on

---

## Destructive Operation Protocol

For irreversible actions, use this format:

```
⚠ About to: <action description>

This will: <consequence>
Affects:   <files/data/services>

Proceed? [yes / no / backup-first]
```

Examples:
- `git reset --hard` → "Will discard all uncommitted changes in <path>"
- Drop migration → "Will delete table <name> and all its data"
- Overwrite file with uncommitted changes → "Will overwrite X (has unsaved edits)"

---

## Common Question Templates

### Auth Type
```
❓ Authentication approach

  A) JWT stateless (access 15min + refresh 7d httpOnly cookie) — simpler, no server state
  B) Session-based (server-side, Redis store) — instant revoke, more infra

Which? (A / B)
```

### Real-Time Requirement
```
❓ Real-time data updates for [feature]

  A) WebSocket (true real-time, bidirectional) — complex, needs WS infra
  B) Server-Sent Events (server→client push) — simpler, one-direction
  C) Polling every N seconds — simplest, slight delay, more requests

Which? (A / B / C)
```

### File Storage
```
❓ File upload storage location

  A) Cloud storage (S3 / Cloudflare R2) — scalable, CDN-ready, costs per GB
  B) Local filesystem — simple dev, not scalable for multi-instance prod
  C) Database BLOB — avoid for large files, simple for small docs

Which? (A / B / C)
```

### Multi-Tenancy
```
❓ Multi-tenancy isolation model

  A) Row-level security (shared DB, tenant_id column) — simpler, less cost
  B) Schema per tenant (one DB, separate schemas) — medium isolation
  C) Database per tenant — strongest isolation, expensive at scale

Which? (A / B / C)
```

### Payment Provider
```
❓ Payment provider

  A) Stripe — international, excellent SDK, higher fees
  B) VNPay — Vietnam local, cheaper fees, more integration work
  C) Both — complex, 2 integrations to maintain

Which? (A / B / C)
```

### API Design
```
❓ API style for [service/feature]

  A) REST — standard, broad tooling, HTTP caching
  B) GraphQL — flexible queries, multiple clients, no over-fetching
  C) gRPC — service-to-service, high performance, less browser-friendly

Which? (A / B / C)
```

---

## Decision Precedence

When answering questions about a project, check in this order:
1. `decisions.md` — explicit user confirmation
2. `context.json` — registered configuration
3. `code-index.md` — existing patterns in codebase
4. Framework skill `## Learned Patterns` — past corrections
5. Only then → ask

## Learned Patterns
<!-- auto-learned entries appended below -->
