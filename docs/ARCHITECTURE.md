# Architecture — GlobalClaudeSkills Dashboard
**Version:** 1.0 | **Date:** 2026-04-19

---

## 1. ADR-001: Framework — Next.js 15 App Router

**Status:** Confirmed  
**Decision:** Next.js 15 với App Router + Server Components  
**Why:**
- File I/O phải chạy server-side → Server Components đọc file trực tiếp, không cần REST API
- Server Actions handle writes (update progress.json, append lessons.md)
- Zero API layer = ít complexity, phù hợp local tool
- Geist font built-in từ Vercel

**Rejected:** Vite + React SPA (cần backend riêng để đọc file system)

---

## 2. ADR-002: Component Library — shadcn/ui + Tailwind CSS

**Status:** Confirmed  
**Decision:** shadcn/ui với Tailwind CSS v4  
**Why:**
- Copy-paste components → dễ customize dark theme `#0f0f17` / `#1a1a2e`
- Không bị lock-in vào library design system
- Radix UI primitives đảm bảo accessibility (keyboard nav, ARIA)
- Geist font tích hợp tốt

**Key components dùng từ shadcn:**
`Button`, `Card`, `Badge`, `Select`, `Dialog`, `Tooltip`, `Tabs`, `Input`, `Separator`, `ScrollArea`, `DropdownMenu`

**Rejected:** MUI / Ant Design (quá opinionated, khó dark theme custom)

---

## 3. ADR-003: Charts — Recharts

**Status:** Confirmed  
**Decision:** Recharts  
**Why:**
- React-native (không cần wrapper)
- Dễ custom colors → match design system indigo `#6366f1`
- Lightweight, đủ cho Donut + Bar chart
- TypeScript support tốt

**Charts cần build:**
- `DonutChart` — token phân bổ theo tool type (M3)
- `BarChart` — daily usage 7 ngày (M3)

**Rejected:** Chart.js (cần canvas wrapper), Tremor (too opinionated styling)

---

## 4. ADR-004: State Management — Server Components + nuqs

**Status:** Confirmed  
**Decision:** Không dùng Zustand/Redux. Dùng:
- **Next.js Server Components** cho data fetching (read from files)
- **nuqs** cho URL search params (active project, selected module, date range filter)
- **localStorage** cho active project persistence giữa các sessions

**Why:** Dashboard chủ yếu read-only. Mutations chỉ qua Server Actions → revalidatePath. Không cần global client state.

**localStorage keys:**
```
gcs:activeProject   → "MovieTheater"
gcs:budgetLimit     → "100000"
```

---

## 5. ADR-005: File Reading Strategy

**Status:** Confirmed  
**Decision:** Next.js `unstable_cache` + `revalidateTag`

```typescript
// Đọc file với cache
const getProgress = unstable_cache(
  async (projectName: string) => readProgressJson(projectName),
  ['progress'],
  { revalidate: 15, tags: ['progress'] }
)

// Sau khi Server Action write → invalidate
revalidateTag('progress')
```

**Auto-refresh:** Client component dùng `useRouter().refresh()` mỗi 30s cho Dashboard (M1).

---

## 6. Folder Structure

```
apps/dashboard/                     ← Next.js app
├── app/
│   ├── layout.tsx                  ← Root: Sidebar + ThemeProvider
│   ├── page.tsx                    ← M1 Dashboard
│   ├── projects/
│   │   ├── page.tsx                ← Project list
│   │   ├── new/
│   │   │   └── page.tsx            ← M5 Add Project Wizard
│   │   └── [name]/
│   │       ├── page.tsx            ← Project overview
│   │       └── settings/
│   │           └── page.tsx        ← M4 Project Settings
│   ├── tasks/
│   │   └── page.tsx                ← M2 Task Board
│   ├── tokens/
│   │   └── page.tsx                ← M3 Token Analytics
│   ├── knowledge/
│   │   └── page.tsx                ← M6 Knowledge Base
│   └── mcp/
│       └── page.tsx                ← M7 MCP Monitor
│
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── TopBar.tsx
│   │   └── PageHeader.tsx
│   ├── dashboard/                  ← M1 components
│   │   ├── StatCard.tsx
│   │   ├── ProjectListItem.tsx
│   │   ├── ActivityTimeline.tsx
│   │   └── KnowledgeNuggets.tsx
│   ├── tasks/                      ← M2 components
│   │   ├── KanbanBoard.tsx
│   │   ├── KanbanColumn.tsx
│   │   ├── TaskCard.tsx
│   │   ├── TaskDetailPanel.tsx
│   │   ├── TaskFilter.tsx
│   │   └── AddTaskForm.tsx
│   ├── tokens/                     ← M3 components
│   │   ├── HeroMetric.tsx
│   │   ├── DonutChart.tsx
│   │   ├── WeeklyBarChart.tsx
│   │   ├── SessionsTable.tsx
│   │   └── BudgetWarning.tsx
│   ├── knowledge/                  ← M6 components
│   │   ├── LessonList.tsx
│   │   ├── LessonCard.tsx
│   │   ├── AddLessonForm.tsx
│   │   └── DecisionLog.tsx
│   ├── mcp/                        ← M7 components
│   │   ├── ServerList.tsx
│   │   └── ProfileViewer.tsx
│   └── ui/                         ← Shared atoms (shadcn + custom)
│       ├── StatusBadge.tsx
│       ├── ProgressBar.tsx
│       ├── MonoId.tsx              ← Monospace task ID display
│       ├── FrameworkTag.tsx
│       └── EmptyState.tsx
│
├── lib/
│   ├── hub/                        ← Core file readers (Server-only)
│   │   ├── registry.ts
│   │   ├── context.ts
│   │   ├── progress.ts
│   │   ├── logs.ts
│   │   ├── lessons.ts
│   │   └── mcp.ts
│   ├── actions/                    ← Server Actions
│   │   ├── task.actions.ts
│   │   ├── project.actions.ts
│   │   └── knowledge.actions.ts
│   └── utils/
│       ├── cost.ts                 ← Token → cost estimation
│       ├── date.ts
│       └── path.ts                 ← Windows path normalization
│
└── types/
    └── hub.ts                      ← All types từ Integration Contract
```

---

## 7. Component Inventory

### Layout (shared tất cả pages)
| Component | Props | Notes |
|-----------|-------|-------|
| `Sidebar` | `activeRoute` | Fixed left, 240px |
| `TopBar` | `projectName`, `onProjectChange` | Project switcher dropdown |
| `PageHeader` | `title`, `subtitle?`, `actions?` | Tiêu đề mỗi page |
| `EmptyState` | `icon`, `message`, `cta?` | Khi data rỗng |

### Shared Atoms (dùng nhiều nơi)
| Component | Props | Notes |
|-----------|-------|-------|
| `StatusBadge` | `status: TaskStatus` | Color-coded pill |
| `ProgressBar` | `value`, `max`, `showLabel?` | Linear progress |
| `MonoId` | `id: string` | Monospace task ID |
| `FrameworkTag` | `framework: string` | Colored chip (Next.js=blue, etc.) |

### M1 — Dashboard
| Component | Data source |
|-----------|-------------|
| `StatCard` × 4 | registry, progress, logs |
| `ProjectListItem` | context + progress per project |
| `ActivityTimeline` | global log (last 5 task entries) |
| `KnowledgeNuggets` | lessons.md (3 random) |

### M2 — Task Board
| Component | Data source |
|-----------|-------------|
| `KanbanBoard` | progress.json |
| `KanbanColumn` × 4 | filtered tasks by status |
| `TaskCard` | task data |
| `TaskDetailPanel` | selected task |
| `AddTaskForm` | → Server Action |
| `TaskFilter` | client-side filter on loaded tasks |

### M3 — Token Analytics
| Component | Data source |
|-----------|-------------|
| `HeroMetric` | global log sum |
| `DonutChart` | group by tool type |
| `WeeklyBarChart` | group by date (7 days) |
| `SessionsTable` | task log entries |
| `BudgetWarning` | total vs threshold |

### M4 — Project Settings
| Component | Data source |
|-----------|-------------|
| `SettingsForm` | context.json |
| `EnvVarList` | context.json + .env.local |

### M5 — Add Project Wizard
| Component | Notes |
|-----------|-------|
| `WizardStepper` | 3 steps: Detect → Configure → Index |
| `FrameworkDetector` | reads package.json/pom.xml |
| `IndexingProgress` | progress bar simulation |

### M6 — Knowledge Base
| Component | Data source |
|-----------|-------------|
| `LessonList` | lessons.md parsed |
| `LessonCard` | single lesson entry |
| `AddLessonForm` | → Server Action |
| `DecisionLog` | decisions.md per project |

### M7 — MCP Monitor
| Component | Data source |
|-----------|-------------|
| `ServerList` | .mcp.json |
| `ProfileViewer` | mcp/profiles/*.json |

### M8 — Task Detail
| Component | Data source |
|-----------|-------------|
| `TaskMeta` | project task log |
| `FileChangedList` | log.filesChanged[] |
| `RiskList` | log.risks[] |

---

## 8. Scalability Notes

- Dashboard chỉ cần chạy 1 user, 1 machine → không cần horizontal scale
- File reads < 1ms (local disk) → no DB needed
- Nếu `progress.json` > 500 tasks trong tương lai → consider pagination trên Task Board
