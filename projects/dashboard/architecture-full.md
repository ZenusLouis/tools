# Architecture Full — Dashboard

## Directory Changes from Scaffold
The scaffold created (auth) routes — these are removed (no auth per NFR6).
Replace with (app) route group with sidebar layout.

```
src/
├── app/
│   ├── (app)/                         ← NEW: authenticated shell
│   │   ├── layout.tsx                 ← Sidebar + TopBar shell
│   │   ├── page.tsx                   ← M1 Dashboard
│   │   ├── tasks/
│   │   │   ├── page.tsx               ← M2 Task Board
│   │   │   └── [id]/page.tsx          ← M8 Task Detail
│   │   ├── tokens/page.tsx            ← M3 Token Analytics
│   │   ├── projects/
│   │   │   ├── page.tsx               ← Projects List
│   │   │   ├── new/page.tsx           ← M5 Add Project Wizard
│   │   │   └── [name]/
│   │   │       ├── page.tsx           ← Project Overview
│   │   │       └── settings/page.tsx  ← M4 Project Settings
│   │   ├── knowledge/page.tsx         ← M6 Knowledge Base
│   │   ├── mcp/page.tsx               ← M7 MCP Monitor
│   │   └── settings/page.tsx          ← Global Settings
│   ├── layout.tsx                     ← Root layout (html, body, fonts, providers)
│   ├── globals.css                    ← Dark mode CSS vars + Tailwind
│   └── not-found.tsx / error.tsx
│
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx                ← Nav links, active project indicator
│   │   ├── TopBar.tsx                 ← Page title, global search (Cmd+K)
│   │   └── PageShell.tsx             ← Layout wrapper with consistent padding
│   ├── ui/                           ← Existing stubs (Button, Input, Dialog)
│   ├── charts/                       ← 'use client'
│   │   ├── DonutChart.tsx            ← Recharts PieChart for token split
│   │   └── BarChart.tsx              ← Recharts BarChart for daily usage
│   └── features/
│       ├── dashboard/                ← M1 components
│       ├── tasks/                    ← M2 components (KanbanBoard, TaskCard, TaskPanel)
│       ├── tokens/                   ← M3 components
│       ├── projects/                 ← M4/M5 components
│       ├── knowledge/                ← M6 components
│       └── mcp/                      ← M7 components
│
├── lib/
│   ├── fs/
│   │   ├── resolve.ts                ← getClaudeRoot(), resolvePath(rel)
│   │   ├── json.ts                   ← readJSON<T>(), writeJSON(), patchJSON()
│   │   ├── jsonl.ts                  ← readJSONL<T>(), appendJSONL()
│   │   └── markdown.ts               ← readMarkdown(), appendMarkdown(), patchMarkdown()
│   ├── parsers/
│   │   ├── logs.ts                   ← parseLogs(), groupByTool(), groupByDate()
│   │   ├── lessons.ts                ← parseLessons(), serializeLessons()
│   │   └── cost.ts                   ← calcCost(tokens): number → tokens/1M * 3.0
│   ├── actions/
│   │   ├── tasks.ts                  ← markDone(), markBlocked(), addTask()
│   │   ├── projects.ts               ← saveProjectConfig(), removeProject()
│   │   ├── knowledge.ts              ← addLesson(), editLesson(), deleteLesson()
│   │   └── wizard.ts                 ← createProject(), indexProject()
│   ├── hooks/
│   │   └── useActiveProject.ts       ← 'use client' — localStorage sync
│   └── utils/
│       ├── cn.ts                     ← existing
│       └── format.ts                 ← existing + formatDuration(), formatTokens()
│
├── types/
│   ├── api.types.ts                  ← existing
│   ├── project.types.ts              ← Project, Context, Registry types
│   ├── task.types.ts                 ← Task, Module, Feature, Gate types
│   └── log.types.ts                  ← LogEntry, SessionSummary types
│
└── config/
    ├── site.ts                       ← Nav items, app name
    └── env.ts                        ← Zod: CLAUDE_ROOT, NEXTAUTH vars
```

## Server Action Pattern
```ts
// lib/actions/tasks.ts
"use server";
import { revalidatePath } from "next/cache";
import { readJSON, writeJSON } from "@/lib/fs/json";
import { resolvePath } from "@/lib/fs/resolve";

export async function markDone(projectName: string, taskId: string) {
  const path = resolvePath(`projects/${projectName}/progress.json`);
  const progress = await readJSON(path);
  // mutate in-memory → validate → write
  await writeJSON(path, updated);
  revalidatePath("/tasks");
}
```

## CLAUDE_ROOT Resolver
```ts
// lib/fs/resolve.ts
export function getClaudeRoot(): string {
  return process.env.CLAUDE_ROOT ?? "d:\\GlobalClaudeSkills";
}
export function resolvePath(rel: string): string {
  return path.join(getClaudeRoot(), rel);
}
```

## Cost Formula
```ts
// lib/parsers/cost.ts
export const calcCost = (tokens: number): number =>
  (tokens / 1_000_000) * 3.0;
```

## Active Project State
- Persisted in `localStorage["activeProject"]`
- React Context provider in `(app)/layout.tsx` (client component)
- Sidebar reads context for highlighting + active task badge
- Task Board, Settings pages read from context (no URL param needed)

## Recharts Integration
- `DonutChart` and `BarChart` are `'use client'` wrappers
- Data fetched server-side, passed as props
- No client-side data fetching for charts

## Error Handling (NFR8)
Each page catches file-not-found via try/catch in the Server Component:
```ts
const data = await readJSON(path).catch(() => null);
if (!data) return <EmptyState message="..." />;
```

## Removed from Scaffold
- `(auth)/login` and `(auth)/register` — no auth per NFR6
- `lib/auth/session.ts` — not needed
- `app/api/auth/[...nextauth]/route.ts` — not needed
- next-auth, jose dependencies — remove from package.json
