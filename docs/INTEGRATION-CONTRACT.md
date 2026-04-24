# Integration Contract — Core Hub ↔ Dashboard
**Version:** 1.0 | **Date:** 2026-04-19
**Purpose:** Định nghĩa toàn bộ file interfaces mà Dashboard đọc/ghi từ GlobalClaudeSkills core.

---

## 1. File System Root

```
BASE_DIR = d:\GlobalClaudeSkills\
PROJECT_DIR = {BASE_DIR}\projects\{projectName}\
LOG_DIR = {BASE_DIR}\logs\
MEMORY_DIR = {BASE_DIR}\memory\global\
MCP_DIR = {BASE_DIR}\mcp\
```

Dashboard access qua Next.js Server Actions — tất cả file I/O chạy server-side.  
**KHÔNG** expose file paths ra client. Client chỉ nhận parsed JSON.

---

## 2. File Contracts

### 2.1 `projects/registry.json` — Project Index
**Owner:** `/project add`, `/project use`  
**Dashboard:** READ (M1, M2, M4, M5), WRITE (M5 Add Project, M4 Remove)

```typescript
// Schema
type Registry = {
  _comment?: string
  _format?: string
  [projectName: string]: string  // "MovieTheater" → "projects/MovieTheater"
}

// Real keys only — filter out keys starting with "_"
function getProjects(registry: Registry): Record<string, string> {
  return Object.fromEntries(
    Object.entries(registry).filter(([k]) => !k.startsWith('_'))
  )
}
```

**Edge cases:**
- File missing → treat as `{}` — show "No projects" empty state
- Value is relative path → resolve từ `BASE_DIR`

---

### 2.2 `projects/{name}/context.json` — Project Config
**Owner:** `/project add`, `/project link`, `/scaffold`  
**Dashboard:** READ (M1, M2, M3, M4, M7), WRITE (M4 Settings save)

```typescript
type ContextJson = {
  name: string                          // "MovieTheater"
  path: string                          // "d:\\Code\\MovieTheater"
  framework: string[]                   // ["nextjs", "nestjs", "postgresql"]
  mcpProfile: string                    // "fullstack"
  docs: {
    brd?: string                        // absolute path to BRD file
    prd?: string
    notes?: string
    [key: string]: string | undefined
  }
  tools: {
    figma?: string                      // URL
    github?: string
    linear?: string
    stitch?: string                     // Stitch project ID
    figjam?: string
    [key: string]: string | undefined
  }
  env: {
    required: string[]                  // ["DATABASE_URL", "JWT_SECRET"]
    envFile: string                     // ".env.local"
  }
  lastIndexed: string                   // ISO 8601
  activeTask: string | null             // "M2-F1-T3" or null
}
```

**Edge cases:**
- `path` may use backslashes (Windows) — normalize với `path.normalize()`
- `docs.*` / `tools.*` có thể undefined — always optional chain
- `lastIndexed` có thể là chuỗi rỗng nếu chưa index lần nào

---

### 2.3 `projects/{name}/progress.json` — Task States
**Owner:** `/task-add`, `/task-done`, `/task-block`, `/task-commit`, `/run-task`  
**Dashboard:** READ (M1, M2, M8), WRITE (M2 mark done/blocked, M2 add task)

```typescript
type ProgressJson = {
  project: string
  activeModule: number
  modules: {
    [moduleId: string]: {              // "1", "2", ...
      name: string
      tasks: Task[]
    }
  }
}

type Task = {
  id: string                           // "M2-F1-T3"
  name: string
  feature: string                      // "Payment"
  status: "pending" | "in-progress" | "completed" | "blocked"
  createdAt: string                    // ISO 8601
  startedAt?: string | null
  completedAt?: string | null
  commitHash?: string | null
  blockedReason?: string | null
  risks: string[]
  dependencies: string[]               // ["M2-F1-T1", "M2-F1-T2"]
  estimate?: number | null             // hours
}
```

**Edge cases:**
- File missing → empty task board, show hint "Run /analyze first"
- `modules` là object (string keys), không phải array — iterate với `Object.entries()`
- `dependencies` có thể là `[]` hoặc undefined — normalize về `[]`
- Task với `status: "in-progress"` chỉ có 1 tại một thời điểm (không enforce, chỉ display)

**Dashboard write rules (Server Action):**
```typescript
// Chỉ được phép update 2 fields qua dashboard:
type AllowedTaskUpdate = {
  status: "completed" | "blocked"
  blockedReason?: string              // required nếu status = "blocked"
}
// KHÔNG cho phép edit: id, name, feature, dependencies qua UI
```

---

### 2.4 `logs/global-YYYY-MM-DD.jsonl` — Global Token Log
**Owner:** `token-tracker.py` (PostToolUse hook), `/task-commit`  
**Dashboard:** READ ONLY (M1, M3) — KHÔNG bao giờ ghi

Có **2 loại entries** trong cùng 1 file:

```typescript
// Type A: Tool call entry (từ token-tracker.py)
type ToolLogEntry = {
  ts: string          // ISO 8601 "2026-04-18T10:30:00.123456"
  tool: string        // "Read" | "Write" | "Bash" | "Grep" | "Glob" | "Agent"
  tokens: number
  // KHÔNG có field "type" — đây là điểm phân biệt với Type B
}

// Type B: Task completion entry (từ /task-commit)
type TaskLogEntry = {
  project: string
  taskId: string
  taskName: string
  status: "completed"
  timestamp: string
  durationMin: number
  tokensUsed: number
  costUSD: number
  commitHash: string
  risks: string[]
  // KHÔNG có field "tool"
}

// Discriminate khi parse:
function isToolEntry(e: unknown): e is ToolLogEntry {
  return typeof e === 'object' && e !== null && 'tool' in e
}
function isTaskEntry(e: unknown): e is TaskLogEntry {
  return typeof e === 'object' && e !== null && 'taskId' in e
}
```

**Parse pattern:**
```typescript
async function parseGlobalLog(date: string): Promise<{
  toolEntries: ToolLogEntry[]
  taskEntries: TaskLogEntry[]
}> {
  const file = `logs/global-${date}.jsonl`
  // Đọc line by line, skip malformed lines (try/catch per line)
  // File có thể không tồn tại → return { toolEntries: [], taskEntries: [] }
}
```

**Cost estimation:**
```typescript
const COST_PER_1K_TOKENS = {
  sonnet: 0.003,   // $3 per 1M tokens (blended input+output)
  haiku: 0.00025,
  default: 0.003
}
// Dashboard dùng default rate — không biết model nào dùng cho tool call nào
```

---

### 2.5 `projects/{name}/logs/YYYY-MM-DD.jsonl` — Project Task Log
**Owner:** `/task-commit`  
**Dashboard:** READ ONLY (M8 Task Detail)

```typescript
type ProjectTaskLog = {
  taskId: string
  taskName: string
  module?: string
  feature?: string
  status: "completed" | "blocked"
  startTime?: string
  endTime: string
  durationMin: number
  filesChanged: string[]              // relative paths từ project root
  commitHash: string
  tokensUsed: number
  risks: string[]
  blockers: string[]
  assessment: string
  lessonsLearned?: string
}
```

**Edge cases:**
- `filesChanged` paths là relative từ `context.json["path"]` — resolve trước khi hiện
- `lessonsLearned` thường không có (optional field)
- Một ngày có thể có nhiều log entries cho nhiều tasks

---

### 2.6 `memory/global/lessons.md` — Global Knowledge Base
**Owner:** `/task-learn`, `auto-learner`, `/research`  
**Dashboard:** READ + WRITE (M6 Knowledge Base)

**Format:**
```markdown
# Global Lessons

## {FrameworkName}
- **[YYYY-MM-DD]** {lesson text}

## General
- **[YYYY-MM-DD]** {lesson text}
```

**Parse pattern:**
```typescript
type Lesson = {
  date: string          // "2026-04-18"
  text: string          // lesson content
  framework: string     // section heading, e.g. "NestJS", "General"
}

function parseLessons(markdown: string): Lesson[] {
  // Split by "## " headings → get framework name
  // Within each section, match "- **[YYYY-MM-DD]** text" pattern
  // Regex: /- \*\*\[(\d{4}-\d{2}-\d{2})\]\*\* (.+)/g
}
```

**Write pattern (append only):**
```typescript
// KHÔNG rewrite toàn bộ file — chỉ append vào đúng section
// Nếu section (framework) chưa có → tạo mới ở cuối file
// Format: "- **[2026-04-19]** {text}\n"
```

---

### 2.7 `projects/{name}/decisions.md` — Project Decisions Log
**Owner:** `/analyze`, `/task-learn`, Gates confirmations  
**Dashboard:** READ (M6 Decision Log viewer)

**Format:**
```markdown
# Decisions: {ProjectName}

## YYYY-MM-DD
- [{Module}] {decision text}
```

**Parse:** Group by date heading, extract bullet entries với module tag.

---

### 2.8 `mcp/.mcp.json` — MCP Server Registry
**Owner:** Manual config  
**Dashboard:** READ ONLY (M7 MCP Monitor)

```typescript
type McpConfig = {
  mcpServers: {
    [serverName: string]: {
      type: "http" | "stdio"
      url?: string                    // http type
      command?: string               // stdio type
      args?: string[]
      headers?: Record<string, string>
      note?: string                  // documentation field, not standard MCP
      install_prereq?: string        // documentation field
    }
  }
}
```

**Security:** `headers` có thể chứa API keys → **KHÔNG** trả về headers xuống client. Chỉ expose: `name`, `type`, `url` (masked nếu có key trong URL), `note`.

---

### 2.9 `mcp/profiles/*.json` — MCP Profiles
**Owner:** Manual config  
**Dashboard:** READ ONLY (M7, M4 mcpProfile dropdown)

```typescript
type McpProfile = {
  profile: string         // "fullstack"
  description: string
  servers: string[]       // ["github", "figma", "stitch"]
  use_when: string
}
```

---

### 2.10 `projects/{name}/code-index.md` — File Map
**Owner:** `/code-index`  
**Dashboard:** READ (M1 last indexed date, M4 show index status)

Dashboard chỉ đọc **15 lines đầu** (header):
```typescript
// Header format:
// # Code Index: {ProjectName} [HEADER — load on /start]
// Modules: Auth(12f) Booking(8f) ...
// Total: 87 files | Last indexed: 2026-04-18
// Quick lookup: auth→src/modules/auth/ | ...
// ---FULL INDEX BELOW---

function parseCodeIndexHeader(content: string): {
  totalFiles: number
  lastIndexed: string
  modules: string
} {
  const lines = content.split('\n').slice(0, 15)
  // Extract từ line "Total: X files | Last indexed: YYYY-MM-DD"
}
```

---

## 3. Server Action Contracts

Dashboard chỉ được phép **5 write operations** — tất cả qua Server Actions:

| Action | File modified | Validation required |
|--------|--------------|-------------------|
| `updateTaskStatus(projectName, taskId, status, reason?)` | `progress.json` | status ∈ allowed values, taskId exists |
| `addTask(projectName, moduleId, task)` | `progress.json` | name required, moduleId exists |
| `saveProjectSettings(projectName, settings)` | `context.json` | path exists on disk, URL format valid |
| `registerProject(projectData)` | `registry.json` + new `context.json` | path exists, name unique |
| `appendLesson(framework, text)` | `lessons.md` | text không rỗng, length < 500 chars |

**KHÔNG** cho phép qua dashboard:
- Xóa tasks
- Edit task name/ID/dependencies
- Xóa lessons
- Xóa log files
- Modify `progress.json` fields khác ngoài status

---

## 4. Data Flow Diagrams

### M1 Dashboard load:
```
registry.json
  → for each project:
      context.json → { name, framework, activeTask, lastIndexed }
      progress.json → { activeModule, completedCount, totalCount }
logs/global-{today}.jsonl
  → sum(tokens) → todayTokens
  → filter(isTaskEntry, today) → recentActivity[5]
```

### M3 Token Analytics (Today):
```
logs/global-{today}.jsonl
  → filter(isToolEntry) → group by tool → donut chart data
  → sum per hour → bar chart data  
  → filter(isTaskEntry) → sessions table
```

### M2 Task Board load:
```
registry.json → project list (dropdown)
context.json → activeModule (default module selector)
progress.json → modules[activeModule].tasks
  → group by status → 4 columns
  → check dependencies: task.dependencies.every(dep =>
      tasks.find(t => t.id === dep)?.status === "completed"
    ) → show lock icon if false
```

---

## 5. Caching Strategy

```typescript
import { unstable_cache } from 'next/cache'

// Cache keys & revalidation
const CACHE = {
  registry:     { key: 'registry',      ttl: 60  },   // 1 min
  context:      { key: 'ctx-{name}',    ttl: 30  },   // 30s
  progress:     { key: 'prog-{name}',   ttl: 15  },   // 15s — changes often
  globalLog:    { key: 'log-{date}',    ttl: 30  },   // 30s
  lessons:      { key: 'lessons',       ttl: 300 },   // 5 min — changes rarely
  mcpConfig:    { key: 'mcp',           ttl: 600 },   // 10 min — almost never changes
}

// After Server Action write → revalidatePath + revalidateTag
```

---

## 6. Type Safety Package

Dashboard nên tạo `packages/shared/types/hub.ts` chứa tất cả types trên.  
Import trong cả Server Actions và Client Components.

```typescript
// packages/shared/types/hub.ts
export type { Registry, ContextJson, ProgressJson, Task }
export type { ToolLogEntry, TaskLogEntry, ProjectTaskLog }
export type { Lesson, McpConfig, McpProfile }
```
