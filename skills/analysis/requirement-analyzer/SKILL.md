---
name: requirement-analyzer
description: >
  Activate when: /analyze command is run. Parses BRD/PRD/requirement documents
  and extracts structured task breakdown with MoSCoW prioritization and risk flags.
model: claude-sonnet-4-6
allowed-tools: Read, Bash, Write
---

# Requirement Analyzer Skill

## Input
- BRD/PRD document (path from `context.json["docs"]["brd"]` or user-provided)
- Optional: existing `context.json` for framework context

---

## Step 1 — Parse Document

| File Type | Command |
|-----------|---------|
| `.docx` | `Bash: pandoc <file> -t markdown -o /tmp/req.md` |
| `.pdf` | `Bash: pdftotext <file> -` |
| `.md` / `.txt` | Read directly |
| `.yaml` / `.json` (OpenAPI) | Read directly — extract endpoints, schemas, descriptions |

---

## Step 2 — Detect Document Type

**BRD** (Business Requirements):
- Focus: stakeholders, business rules, regulatory constraints, actors
- Signal words: "the business shall", "users must be able to", "the system must"

**PRD** (Product Requirements):
- Focus: user personas, user flows, feature specs, acceptance criteria, KPIs
- Signal words: "As a [user], I want to...", "Acceptance criteria:", "Given/When/Then"

**OpenAPI/Swagger spec**:
- Each endpoint = 1 task group (controller + service + repository)
- Extract: paths, HTTP methods, request/response schemas, auth requirements

**User stories / tickets**:
- Each story = potential task; check if atomic enough (≤ 2h, 1 file)
- Group by feature/epic → assign M{n}-F{n}-T{n} IDs

---

## Step 3 — MoSCoW Prioritization

| Priority | Signal Words | Label |
|----------|-------------|-------|
| **Must Have** | "must", "shall", "required", "mandatory", "critical", "essential" | 🔴 M |
| **Should Have** | "should", "expected", "important", "recommended" | 🟡 S |
| **Could Have** | "could", "nice to have", "optionally", "if possible" | 🟢 C |
| **Won't Have** | "out of scope", "future phase", "not in v1", "won't" | ⚪ W |

If no explicit MoSCoW in document:
- Core business flow = Must Have
- User convenience features = Should Have
- Edge cases = Could Have
- Unrelated to MVP = Won't Have

---

## Step 4 — Risk Flag Detection

| Signal in Text | Risk | Flag |
|----------------|------|------|
| "real-time", "live update", "instant notification" | WebSocket/SSE complexity | ⚠ REALTIME |
| "payment", "checkout", "billing", "invoice" | PCI compliance, payment gateway | ⚠ PAYMENT |
| "upload", "file", "image", "video", "document" | Storage (S3/R2), CDN, virus scan | ⚠ FILEUPLOAD |
| "search", "filter", "faceted", "autocomplete" | Elasticsearch or PostgreSQL FTS | ⚠ SEARCH |
| "multi-tenant", "organization", "workspace" | Row-level security, data isolation | ⚠ MULTITENANT |
| "SMS", "email notification", "push notification" | Twilio/SendGrid/FCM integration | ⚠ NOTIFICATION |
| "role", "permission", "RBAC", "admin" | Authorization system, policy complexity | ⚠ RBAC |
| "report", "analytics", "dashboard metrics" | Aggregation queries, CQRS candidate | ⚠ ANALYTICS |
| "import", "export", "CSV", "bulk" | Background jobs, memory management | ⚠ BULK |
| "third-party", "API integration", "webhook" | External dependency, error handling | ⚠ INTEGRATION |

---

## Step 5 — Dependency Detection

| Signal | Dependency Rule |
|--------|----------------|
| "after login", "authenticated user" | Task depends on Auth module |
| "once payment is confirmed" | Task depends on Payment feature |
| "requires user account" | Task depends on User registration |
| "after admin approves" | Task depends on Admin approval workflow |

Record as: `T3 depends on T1` → block `/run-task T3` until T1 done.

---

## Step 6 — Contradiction & Gap Detection

**Contradictions** — same entity, conflicting values:
- "Max 4 seats per booking" (section 3) vs "up to 10 seats" (section 7) → flag both with section refs

**Gaps** — referenced but not defined:
- Auth mentioned → no roles defined → "Missing: role permissions matrix"
- Payment mentioned → no gateway chosen → "Missing: payment provider (Stripe/VNPay)"
- File upload → no size limit → "Missing: max file size + allowed types"

---

## Step 7 — Task Breakdown

```
M{n}: <ModuleName>
  F{n}: <FeatureName>
    T{n}: <AtomicTask>  [🔴M] [⚠PAYMENT] depends-on: T1
```

**Task granularity rules**:
- 1 primary file changed OR 1 endpoint OR 1 component
- Max 2 hours estimated work
- Must have: clear input, clear output, 1 test case

**Complexity estimation**:
| Task Type | Hours |
|-----------|-------|
| Simple CRUD endpoint | 0.5h |
| CRUD + validation + tests | 1h |
| Business logic + multi-table write | 1.5h |
| 3rd-party API integration | 2h |
| Real-time feature | Split → 2 tasks |
| Payment integration | Split → 3+ tasks |

---

## Output Files

### analysis-summary.md (top ~20 lines — loaded frequently)
```markdown
## SUMMARY
App: <name>
Type: BRD / PRD / OpenAPI
Actors: Guest · Member · Admin
Modules: M1 Auth(5t) · M2 Orders(12t) · M3 Payment(8t)
Stack: <from context.json> — <additional suggestions>
Figma: Yes (6 UI screens) / No (API-only)

## Risk Flags
⚠ PAYMENT — gateway integration + PCI compliance
⚠ REALTIME — seat availability needs WebSocket

## Ambiguities (resolve at GATE 1)
1. "real-time seat update" — WebSocket or polling?
2. Payment provider — Stripe or VNPay?

## Gaps
- Missing: max file size for avatar upload
- Missing: role permissions matrix

---FULL ANALYSIS BELOW---
```

### analysis-full.md — complete breakdown
All modules/features/tasks with MoSCoW labels, dependency graph, complexity estimates,
contradictions, gaps, acceptance criteria per task.

---

## After Analysis
1. Show GATE 1 confirmation with SUMMARY
2. Wait for user confirm/edit/cancel
3. After confirm → populate TodoWrite with M{n}-F{n}-T{n} IDs
4. Write confirmed answers to `decisions.md`
5. Update analysis-summary.md with confirmed stack choices
