# Architecture Summary — Dashboard

## Stack
- **Framework:** Next.js 15 App Router + TypeScript
- **Styling:** Tailwind CSS v4 + Geist font (dark mode only, CSS vars for colors)
- **Charts:** Recharts (client components — requires browser APIs)
- **Icons:** Lucide React
- **State:** React Context (active project) + localStorage (budget threshold, active project ID)
- **Data:** File system only — Node.js `fs` via Server Components + Server Actions
- **No database, no REST API, no auth**

## Route Map
```
(app) layout — Sidebar + shell
├── /                        → M1 Dashboard
├── /tasks                   → M2 Task Board
├── /tasks/[id]              → M8 Task Detail
├── /tokens                  → M3 Token Analytics
├── /projects                → Projects List
├── /projects/new            → M5 Add Project Wizard
├── /projects/[name]         → Project Overview
├── /projects/[name]/settings→ M4 Project Settings
├── /knowledge               → M6 Knowledge Base
├── /mcp                     → M7 MCP Monitor
└── /settings                → Global Settings
```

## Key Layers
- `src/lib/fs/` — CLAUDE_ROOT resolver, read/write JSON, JSONL, Markdown helpers
- `src/lib/parsers/` — JSONL log parser, lessons.md parser, cost calculator
- `src/lib/actions/` — Server Actions (tasks, projects, knowledge, settings)
- `src/components/layout/` — Sidebar, TopBar, PageShell
- `src/components/charts/` — DonutChart, BarChart (client, Recharts)

## Caching Strategy
- Server Components fetch files directly (no cache for mutation-heavy pages)
- `unstable_cache` for expensive reads (registry, progress) with tag-based revalidation
- `revalidatePath()` called in every Server Action after write

## NFR Colors (CSS vars in globals.css)
```
--bg-base:   #0f0f17   --card:      #1a1a2e
--accent:    #6366f1   --done:      #22c55e
--progress:  #eab308   --blocked:   #ef4444
--muted:     #6b7280
```
