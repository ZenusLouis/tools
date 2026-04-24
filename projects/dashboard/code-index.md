# Code Index: dashboard [HEADER — load on /start]
Modules: app (20 files) | components (8 files) | lib (5 files) | config (2 files) | types (2 files)
Total: 37 files | Last indexed: 2026-04-19
Quick lookup: layout→src/app/(app) | sidebar→src/components/layout | lib→src/lib | stats→src/lib/stats.ts | config→src/config
---FULL INDEX BELOW---

## src/app/
- `layout.tsx` — Root layout with Geist font variables + globals import
- `not-found.tsx` — 404 page handler
- `error.tsx` — Error boundary client component
- `globals.css` — Tailwind + dark mode CSS vars (--bg-base, --card, --accent, etc.)

## src/app/(app)/
- `layout.tsx` — App shell: Sidebar + content flex container
- `page.tsx` — M1 Dashboard: 4 stat cards (getDashboardStats → StatCard)
- `loading.tsx` — Dashboard skeleton: 4 stat cards + projects + activity + nuggets (M0-F1-T2)
- `tasks/page.tsx` — M2 Task Board: project + module selectors (URL params), fetches options server-side
- `tasks/[id]/page.tsx` — M8 Task Detail: findTaskDetail + getTaskLogEntry, renders 5 detail cards
- `tokens/page.tsx` — M3 Token Analytics: DateRangeTabs + HeroMetric (tokens, cost, % budget)
- `tokens/loading.tsx` — Tokens skeleton: tabs + 3 hero cards + 2 charts + sessions table (M0-F1-T2)
- `tasks/loading.tsx` — Tasks skeleton: selectors + progress bar + 4 Kanban columns (M0-F1-T2)
- `projects/page.tsx` — M9 Projects List: grid 3 cols, ProjectCard components (framework chips, progress bar, active task, settings icon)
- `projects/new/page.tsx` — M5 Add Project Wizard: loads MCP profiles, renders WizardShell
- `projects/new/actions.ts` — scanProject() + createProject() Server Actions (detect framework, write context.json + registry.json + code-index.md)
- `projects/[name]/page.tsx` — M9 Project Overview: stats row (4 tiles), module progress list, links/docs, recent activity, code index status
- `projects/[name]/settings/page.tsx` — M4 Project Settings: General section (name/path read-only, MCP profile dropdown)
- `knowledge/page.tsx` — M6 Knowledge Base: loads lessons + decisions + projects, renders KnowledgeClient
- `knowledge/actions.ts` — addLessonAction, editLessonAction, deleteLessonAction Server Actions
- `mcp/page.tsx` — M7 MCP Monitor: loads servers + profiles, renders McpServerList + McpProfileViewer
- `settings/page.tsx` — M10 Global Settings: Preferences (budget, MCP profile, auto-refresh) + About section

## src/components/layout/
- `Sidebar.tsx` — Client component: nav links with active state via usePathname, Lucide icons
- `TopBar.tsx` — Page title header bar (accepts optional `actions` ReactNode slot)
- `PageShell.tsx` — Main content area wrapper with consistent padding
- `PageTransition.tsx` — Client component: AnimatePresence + motion.div page fade/slide wrapper (M0-F1-T1)

## src/components/ui/
- `index.ts` — Barrel export for UI components (Button, Input, Dialog, Skeleton)
- `button.tsx` — Reusable Button with motion.button + whileTap scale press (M0-F1-T3)
- `input.tsx` — Reusable Input component with Tailwind styling
- `dialog.tsx` — Reusable Dialog component (client-side)
- `skeleton.tsx` — Skeleton pulse component for loading states (M0-F1-T2)

## src/components/dashboard/
- `StatCard.tsx` — Stat card with label, value, optional progress bar + sub text
- `ActiveProjectsList.tsx` — Project rows: name, framework tags, progress bar, activeTask (mono), lastIndexed; empty state with CTA
- `RecentActivity.tsx` — Timeline of 5 recent completed tasks: taskId (mono), project, time ago, commit hash, note
- `KnowledgeNuggets.tsx` — 3 daily-seeded random lessons: framework tag, date, text with bold/code rendering
- `AutoRefresh.tsx` — Client component: calls router.refresh() on 30s interval; respects `auto-refresh-enabled` localStorage key (M1-F1-T5, M10)

## src/components/projects/
- `ProjectCard.tsx` — Project card: name, framework chips, progress bar, active task dot, settings icon link (M9-F1)

## src/components/tasks/
- `TaskBoardSelectors.tsx` — Client component: project + module dropdowns, URL param state (?project=&module=)
- `ModuleProgressBar.tsx` — Module progress: id, name, completed/total count, % bar; empty state
- `KanbanBoard.tsx` — 4 columns (pending/in-progress/completed/blocked) with status dot colors, task count badge, renders TaskCard
- `TaskCard.tsx` — Task card: ID (mono), name, featureId chip, estimate badge, lock icon if unmet deps
- `TaskDetailPanel.tsx` — Slide-in right panel: deps list (met/unmet), Mark Done/Blocked Server Actions, locked warning
- `TaskBoardClient.tsx` — "use client" wrapper: selectedTask + status/feature filter state, renders FilterBar + KanbanBoard + TaskDetailPanel
- `FilterBar.tsx` — Status pill buttons (all/pending/in-progress/completed/blocked) + feature dropdown
- `AddTaskForm.tsx` — Inline "Add task" form at bottom of PENDING column; calls addTask() Server Action

## src/lib/
- `tasks.ts` — getProjectOptions(), getModuleOptions(), getModuleProgress(), getModuleTasks(), getCompletedTaskIds(): reads registry + progress.json; KanbanTask.gates: ("G3"|"G4")[]
- `api/client.ts` — Axios API client with base URL and interceptors
- `auth/session.ts` — NextAuth session utilities
- `utils/cn.ts` — clsx + tailwind-merge utility for conditional classNames
- `utils/format.ts` — Date formatting utility
- `stats.ts` — getDashboardStats(): reads registry.json + today's JSONL log → activeProjects, tasksToday, tokenCount, sessionCost, tokenPercent
- `projects.ts` — getActiveProjects() → ProjectSummary[]; getProjectDetail(name) → ProjectDetail (modules, links, docs, codeIndexExists) (M9)
- `activity.ts` — getRecentActivity(n): scans last 3 days of JSONL logs, expands session.tasksCompleted → ActivityItem[]; timeAgo() helper
- `lessons.ts` — getRandomLessons(n): parses memory/global/lessons.md by ## section, day-seeded shuffle → Lesson[]
- `knowledge.ts` — getAllLessons(), appendLesson(), updateLesson(), deleteLesson(), getAllProjectDecisions(), parseDecisions()
- `task-detail.ts` — findTaskDetail(id) searches all projects, getTaskLogEntry(id) scans JSONL logs → TaskDetail + TaskLogEntry
- `analytics.ts` — getAnalytics(range): scans JSONL logs for today/week/month → AnalyticsData {totalTokens, totalCost, toolBreakdown, dailyUsage, sessions}
- `settings.ts` — getProjectContext(name), getMcpProfiles(): reads context.json + mcp/profiles dir
- `mcp.ts` — getMcpServers() (.mcp.json), getMcpProfiles() (profiles/*.json), buildMcpAddCommand(server)

## src/components/tasks/detail/
- `TaskMetaCard.tsx` — Task metadata: ID, name, module, feature, status, estimate, deps, date, duration, commit, tokens (T1)
- `FilesChangedCard.tsx` — Files list with vscode:// URI links + +/- counts; empty state if not logged (T2)
- `RisksCard.tsx` — Risk list from log entry; empty state if none (T3)
- `LessonLinkCard.tsx` — Lesson text from log + link to Knowledge Base; empty state if none (T4)
- `DiffCard.tsx` — Per-file diff bar with +/- totals; empty state if filesChanged not logged (T5)

## src/components/mcp/
- `McpServerList.tsx` — Server table: name, type badge, URL/cmd, "Unknown" yellow badge, CopyButton (M7-F1-T1,T2,T4)
- `McpProfileViewer.tsx` — Collapsible profile list: expand to see server names + type + URL (M7-F1-T3)

## src/components/knowledge/
- `KnowledgeClient.tsx` — "use client": tab state (lessons/decisions), search input, framework filter, project dropdown (M6-F1-T1,T3)
- `LessonsList.tsx` — Filters lessons by search+framework, groups by framework, renders LessonCard (M6-F1-T2,T3)
- `LessonCard.tsx` — Inline edit (click pencil → input → save/cancel) + confirm-delete flow (M6-F1-T5)
- `AddLessonForm.tsx` — Collapsible add-lesson form: framework select/custom + text → addLessonAction (M6-F1-T4)
- `DecisionLog.tsx` — Decision viewer grouped by project: D1/D2 cards with title + body (M6-F1-T6)

## src/components/wizard/
- `WizardShell.tsx` — Client: 4-step wizard state manager + step indicator breadcrumb (M5)
- `Step1Path.tsx` — Folder path input + Scan button → calls scanProject() → shows name/framework (M5-F1-T1)
- `Step2Config.tsx` — MCP profile dropdown + Figma/GitHub/Linear URLs + BRD/PRD paths (M5-F1-T2)
- `Step3Index.tsx` — Animated step-by-step indexing progress + calls createProject() (M5-F1-T3)
- `Step4Done.tsx` — Success screen listing created files + Go to Dashboard / Settings links (M5-F1-T4)

## src/components/settings/
- `GeneralSection.tsx` — General form section: name (read-only), path (read-only mono), MCP profile dropdown
- `DocumentsSection.tsx` — Documents form section: BRD, PRD, API spec file path inputs (M4-F1-T2)
- `ToolsSection.tsx` — Tools & Integrations section: Figma, GitHub, Linear URL inputs (M4-F1-T3)
- `EnvSection.tsx` — Client component: env vars masked list, Copy button, Add/Remove, hidden JSON input (M4-F1-T4)
- `SettingsForm.tsx` — Client form wrapper using useActionState + saveSettings Server Action; composes all sections
- `GlobalSettingsClient.tsx` — "use client": token budget input, default MCP profile dropdown, auto-refresh toggle (M10)
- `DangerZone.tsx` — Client component: Remove Project confirm flow → calls removeProject Server Action (M4-F1-T6)

## src/app/(app)/projects/[name]/settings/
- `actions.ts` — saveSettings (writes context.json) + removeProject (removes from registry.json, redirects) Server Actions (M4-F1-T5)

## src/components/tokens/
- `DateRangeTabs.tsx` — Client tab bar: Today / 7 Days / 30 Days, sets ?range= URL param
- `HeroMetric.tsx` — 3 stat cards: total tokens, cost ($3/1M), % daily budget with progress bar
- `DonutChart.tsx` — Recharts PieChart (donut): token split by tool, color-coded per tool type
- `DailyBarChart.tsx` — Recharts BarChart: 7-day daily usage, today bar indigo, others dark gray
- `SessionsTable.tsx` — Sessions table: date, project, tasks (green), tokens, cost; totals footer row
- `BudgetWarningBanner.tsx` — Amber banner when tokens > 80% of daily budget; shows %, used/limit, remaining
- `BudgetConfig.tsx` — "use client": reads/writes STORAGE_KEY from localStorage (default 100k), renders config input + BudgetWarningBanner with live budget

## src/config/
- `site.ts` — Site metadata and navigation config
- `env.ts` — Zod env validation schema

## src/types/
- `api.types.ts` — TypeScript interfaces for API responses
- `index.ts` — Barrel export for all types
