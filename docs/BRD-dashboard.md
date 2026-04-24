# BRD — GlobalClaudeSkills Dashboard
**Version:** 3.0 | **Date:** 2026-04-19 | **Status:** Approved for Development

---

## 1. Overview & Vision

**GlobalClaudeSkills Dashboard** là trung tâm điều hành (Management Hub) cho hệ thống phát triển phần mềm hỗ trợ bởi AI. Dashboard cung cấp giao diện visual để theo dõi projects, quản lý tasks, monitor token usage, và quản lý knowledge base — thay thế hoàn toàn việc phải nhớ CLI commands.

**Tech Stack:** Next.js 15 (App Router) + TypeScript + Tailwind CSS + Geist font  
**Architecture:** File-based — đọc/ghi trực tiếp `d:\GlobalClaudeSkills\` qua Next.js Server Actions (không cần REST API server riêng)  
**Runtime:** Localhost only — `http://localhost:3000`

---

## 2. Actors

| Actor | Mô tả |
|-------|--------|
| **Developer** | Người dùng duy nhất — xem progress, quản lý tasks, monitor costs, edit config |

---

## 3. Navigation Structure

```
Sidebar (persistent):
├── Dashboard          → /
├── Projects
│   ├── List           → /projects
│   ├── [name]         → /projects/[name]
│   └── Add New        → /projects/new  (wizard)
├── Tasks              → /tasks  (kanban, scope = active project)
├── Token Stats        → /tokens
├── Knowledge          → /knowledge
├── MCP Monitor        → /mcp
└── Settings           → /settings
```

Active project persisted in `localStorage` — không reload mất context.

---

## 4. Module Specifications

### M1 — Dashboard `GET /` ✅ Stitch designed
**Goal:** Cái nhìn tổng quan toàn hệ thống

**Features:**
- **F1.1** 4 stat cards: Active Projects (count từ registry.json), Tasks Done Today (sum từ global log), Tokens Today + progress bar (% vs 100k limit), Session Cost ($)
- **F1.2** Active Projects list: tên, framework tags, progress bar %, active task ID (monospace font), last indexed date — click → `/projects/[name]`
- **F1.3** Recent Activity timeline: 5 entries gần nhất từ `global-YYYY-MM-DD.jsonl` — task ID, project, time ago, commit hash
- **F1.4** Knowledge Nuggets: 3 lessons ngẫu nhiên từ `lessons.md` (read-only, inspirational)
- **F1.5** Auto-refresh mỗi 30s — dùng Next.js `revalidate` + client-side interval

**Data reads:** `registry.json`, `projects/*/context.json`, `projects/*/progress.json`, `logs/global-*.jsonl`

---

### M2 — Task Board `GET /tasks` ✅ Stitch designed
**Goal:** Quản lý vòng đời tasks theo kanban

**Features:**
- **F2.1** Project selector dropdown (top-left) — switch active project
- **F2.2** Module selector dropdown — chuyển giữa modules trong project
- **F2.3** Progress bar: `x/n tasks (xx%)` cho module đang xem
- **F2.4** 4 Kanban columns: PENDING (gray) / IN PROGRESS (yellow) / COMPLETED (green) / BLOCKED (red)
- **F2.5** Task card: ID monospace, tên, feature tag chip, estimate badge, dependency lock icon nếu có deps chưa xong
- **F2.6** Task detail panel (right sidebar, slide-in): full description, dependencies list, risk warnings, "Mark Done" + "Mark Blocked" buttons — **không có "Run Task"** (chỉ CLI làm được)
- **F2.7** Quick filter bar: filter by status / feature
- **F2.8** Add Task form (inline, bottom của PENDING column): nhập tên → save vào `progress.json`
- **F2.9** Gate indicators: badge hiện task đang ở Gate nào (G1/G2/G3/G4)

**Data reads/writes:** `projects/<name>/progress.json`

---

### M3 — Token Analytics `GET /tokens` ✅ Stitch designed
**Goal:** Kiểm soát budget và phân tích chi phí

**Features:**
- **F3.1** Date range tabs: Today / Week / Month
- **F3.2** Hero metric: tổng tokens + cost estimate + % daily budget (100k default)
- **F3.3** Donut chart: phân bổ theo tool type — Read / Write / Bash / Agent / Grep / Glob
- **F3.4** Bar chart: daily usage 7 ngày, hôm nay highlight màu indigo
- **F3.5** Sessions table: Date, Project, Tasks Completed, Tokens, Cost, Duration — sorted by date desc
- **F3.6** Budget warning banner (amber) khi > 80% daily limit
- **F3.7** Budget threshold config: input field để set daily limit (lưu vào `localStorage`, default 100k)

**Data reads:** `logs/global-YYYY-MM-DD.jsonl` (parse tất cả entries, group by tool/date)

---

### M4 — Project Settings `GET /projects/[name]/settings` ⏳ Stitch pending
**Goal:** View và edit config của từng project

**Features:**
- **F4.1** General section: project name (read-only), folder path (read-only), MCP profile dropdown (editable)
- **F4.2** Documents section: BRD/PRD/API spec — file path input + Browse button (uses `<input type="file">` để pick path, không upload file)
- **F4.3** Tools & Integrations: Figma URL, GitHub URL, Linear URL — text inputs
- **F4.4** Environment Variables: list từ `context.json["env"]["required"]` — masked values (`••••••`) + Copy button (copy từ `.env.local` nếu có), Add/Remove buttons
- **F4.5** Save Changes button → ghi lại vào `context.json` via Server Action
- **F4.6** Danger Zone: "Remove Project" (xóa khỏi registry, không xóa code folder)

**Data reads/writes:** `projects/<name>/context.json`, `projects/registry.json`

---

### M5 — Add Project Wizard `GET /projects/new` ⏳ Stitch pending
**Goal:** Onboard project mới qua UI (thay `/project add` CLI)

**Features:**
- **F5.1** Step 1 — Detect: folder path input + Browse button, "Scan" button → đọc `package.json`/`pom.xml`/`requirements.txt` → hiện framework chips detected
- **F5.2** Step 2 — Configure: optional inputs — Figma URL, GitHub URL, BRD file path, MCP profile dropdown (auto-suggested từ framework)
- **F5.3** Step 3 — Index: "Start Indexing" button → gọi Server Action chạy `/code-index` equivalent, progress bar + "X files indexed"
- **F5.4** Completion: summary card → "Go to Dashboard" button
- **F5.5** Writes: `context.json` + updates `registry.json`

**Data reads/writes:** `projects/registry.json`, `projects/<name>/context.json`

---

### M6 — Knowledge Base `GET /knowledge` 🆕 v1
**Goal:** Browse và manage lessons + decisions

**Features:**
- **F6.1** Tabs: Global Lessons / Project Decisions (per-project dropdown)
- **F6.2** Lesson list: hiển thị từng entry từ `lessons.md` — framework tag, date badge, lesson text
- **F6.3** Search/filter: full-text search trong lessons + filter by framework tag
- **F6.4** Add lesson form: text input + framework dropdown → append vào `lessons.md` via Server Action
- **F6.5** Edit/delete lesson (inline edit, confirm before delete)
- **F6.6** Decision log viewer: group by project → list decisions từ `decisions.md`

**Data reads/writes:** `memory/global/lessons.md`, `projects/<name>/decisions.md`

---

### M7 — MCP Monitor `GET /mcp` 🆕 v1 (read-only)
**Goal:** Giám sát trạng thái MCP servers

**Features:**
- **F7.1** Server list từ `.mcp.json` — name, type (http/stdio), URL
- **F7.2** Status indicator: Active / Failed / Unknown — đọc từ `.claude.json` user config
- **F7.3** Profile viewer: danh sách profiles từ `mcp/profiles/*.json` — click để xem servers trong profile
- **F7.4** Copy `claude mcp add` command cho từng server

**Scope boundary:** Read-only — KHÔNG invoke tools trực tiếp từ UI (requires backend proxy, out of scope v1)

**Data reads:** `mcp/.mcp.json`, `mcp/profiles/*.json`, `C:\Users\<user>\.claude.json`

---

### M8 — Task Detail `GET /tasks/[id]` 🆕 v1
**Goal:** Xem chi tiết một task đã completed

**Features:**
- **F8.1** Task metadata: ID, name, module, feature, status, dates, duration, commit hash
- **F8.2** Files changed list: từ log entry `filesChanged[]` — click filename để xem trong VS Code (dùng `vscode://` URI scheme)
- **F8.3** Risk & assessment: hiển thị `risks[]` và `assessment` từ task log
- **F8.4** Lesson saved: nếu task có lesson → link sang Knowledge Base entry
- **F8.5** Simple diff view: show `+/-` line counts per file (không phải full diff — chỉ từ log metadata)

**Data reads:** `projects/<name>/logs/YYYY-MM-DD.jsonl` (filter by taskId)

---

### M9 — Log Viewer `GET /logs` 🆕 v2 (NOT v1)
**Goal:** Live tail và filter logs

**Deferred to v2** vì:
- "Live Tail" cần SSE hoặc polling endpoint — thêm complexity
- "Thought Pattern Search" không khả thi: log hiện tại không lưu AI reasoning, chỉ có `{ ts, tool, tokens }`
- v1 đã có Token Analytics (M3) đủ dùng cho monitoring

---

### M10 — Agent Console `GET /console` 🆕 v2 (NOT v1)
**Goal:** Chat UI bridge tới Claude CLI

**Deferred to v2** vì:
- Requires persistent WebSocket connection tới Claude Code process
- Gate confirmation buttons cần IPC mechanism giữa web UI và CLI
- Complexity cao, không phù hợp v1 scope

---

## 5. Non-Functional Requirements

| # | Requirement | Detail |
|---|-------------|--------|
| NFR1 | Dark mode only | bg `#0f0f17`, card `#1a1a2e`, accent `#6366f1` |
| NFR2 | Font | Geist (headline + body), monospace cho task IDs và paths |
| NFR3 | Status colors | green `#22c55e` done · yellow `#eab308` in-progress · red `#ef4444` blocked · gray `#6b7280` pending |
| NFR4 | Responsive | Desktop 1440px primary, min 1280px |
| NFR5 | Performance | Page load < 1s — file reads cached với Next.js `unstable_cache` |
| NFR6 | No auth | Localhost only, no login |
| NFR7 | Data integrity | Tất cả writes qua Server Actions — validate trước khi ghi file |
| NFR8 | Error states | Mọi page phải handle: file missing → empty state UI (không crash) |
| NFR9 | Keyboard | `Cmd/Ctrl+K` → global search, `P` → project switcher |

---

## 6. Error States (Required per NFR8)

| Scenario | UI Response |
|----------|-------------|
| `registry.json` missing | "No projects yet. Add your first project →" CTA |
| `progress.json` missing | Task Board shows empty state, "Run /code-index first" hint |
| Log file missing/empty | Token stats show zeros, no error thrown |
| `context.json` corrupted | Show raw JSON editor to fix manually |
| MCP server unreachable | Yellow "Disconnected" badge, không block UI |

---

## 7. Scope Summary

| Module | v1 | v2 |
|--------|----|----|
| M1 Dashboard | ✅ | — |
| M2 Task Board | ✅ | — |
| M3 Token Analytics | ✅ | — |
| M4 Project Settings | ✅ | — |
| M5 Add Project Wizard | ✅ | — |
| M6 Knowledge Base | ✅ | — |
| M7 MCP Monitor (read-only) | ✅ | — |
| M8 Task Detail | ✅ | — |
| M9 Log Viewer (live tail) | — | ✅ |
| M10 Agent Console | — | ✅ |

**v1: 8 modules, ~35 features**

---

## 8. Stitch Design References

**Stitch Project ID (v2):** `10146757762664662`  
**Stitch Project ID (v1, Dashboard only):** `4006582675318311222`

| Screen | Stitch ID | Project | Status |
|--------|-----------|---------|--------|
| M1 Dashboard | `163d28292e6b43d78ff589e68bd043b6` | v2 | ✅ Done |
| M2 Task Board | `3c0bcc04b6c243acaf21c14de419aaf4` | v2 | ✅ Done |
| M3 Token Analytics | `8fb6111a38b9469da2fef74d60ac1b4c` | v2 | ✅ Done |
| M4 Project Settings | `46229e6ecf6e40fc929e71a1595df4d9` | v2 | ✅ Done |
| M5 Add Project Wizard | `52c052a19344457db453e54ec66fdb6e` | v2 | ✅ Done |
| M6 Knowledge Base | `5bfd017b866f4e7d98c7f7a69ccde0fa` | v2 | ✅ Done |
| M7 MCP Monitor | `23a244ddbbdb46058085b71f78d26648` | v2 | ✅ Done |
| M8 Task Detail | `47818e05e9ab4d77aab8358908dfdafa` | v2 | ✅ Done |
| Projects List | `a7ed242352314edca32ba999c4b158e2` | v2 | ✅ Done |
| Project Overview | `8dc726882ff34ac0b5c1c8e0cc50a53d` | v2 | ✅ Done |
| Global Settings | `12a10fbb6832475ea328835f9e9b19c9` | v2 | ✅ Done |

---

## 9. Out of Scope (v1)

- Authentication / multi-user
- Remote deployment (Vercel/Railway)
- WebSocket / real-time streaming (M9, M10)
- Mobile responsive
- Direct MCP tool invocation từ UI
- AI thought log search (log format không support)
- Git diff viewer (chỉ show file list + line counts)
