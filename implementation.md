# Implementation

## Changed Files

- `apps/dashboard/src/components/projects/OnboardingEmptyState.tsx`
- `apps/dashboard/src/components/tasks/CommitComposerModal.tsx`
- `apps/dashboard/src/components/tasks/detail/CommitComposerButton.tsx`
- `apps/dashboard/src/components/labs/ConceptScreen.tsx`
- `apps/dashboard/src/app/(app)/labs/obsidian-logic/page.tsx`
- `apps/dashboard/src/app/(app)/labs/void-protocol/page.tsx`
- `apps/dashboard/src/app/(app)/labs/void-terminal/page.tsx`
- `apps/dashboard/src/app/(app)/premium/page.tsx`
- `apps/dashboard/src/app/(app)/projects/[name]/detail/page.tsx`
- `apps/dashboard/src/app/(app)/projects/[name]/settings/page.tsx`
- `apps/dashboard/src/app/(app)/projects/[name]/page.tsx`
- `apps/dashboard/src/app/(app)/projects/page.tsx`
- `apps/dashboard/src/app/(app)/page.tsx`
- `apps/dashboard/src/app/(app)/tasks/[id]/page.tsx`
- `apps/dashboard/src/components/tasks/TaskDetailPanel.tsx`
- `apps/dashboard/src/lib/lab-metrics.ts`
- `apps/dashboard/src/app/actions/templates.ts`
- `apps/dashboard/src/app/actions/mcp.ts`
- `apps/dashboard/src/app/(app)/projects/templates/page.tsx`
- `apps/dashboard/src/components/projects/TemplateScaffoldForm.tsx`
- `apps/dashboard/src/components/mcp/McpForms.tsx`
- `apps/dashboard/src/components/chat/ChatClient.tsx`
- `apps/dashboard/src/lib/analytics.ts`
- `apps/dashboard/src/components/tokens/SessionsTable.tsx`
- `apps/dashboard/src/components/mcp/McpServerList.tsx`
- `apps/dashboard/src/components/mcp/McpProfileViewer.tsx`
- `apps/dashboard/src/components/knowledge/LessonsList.tsx`
- `apps/dashboard/src/components/knowledge/LessonCard.tsx`
- `apps/dashboard/src/components/projects/ProjectConsoleActions.tsx`
- `apps/dashboard/src/app/(app)/projects/[name]/detail/page.tsx`
- `apps/dashboard/src/components/dashboard/RecentActivity.tsx`
- `apps/dashboard/src/components/labs/ConceptScreen.tsx`
- `apps/dashboard/src/app/layout.tsx`
- `apps/dashboard/src/app/icon.tsx`
- `apps/dashboard/src/components/layout/PageDocumentTitle.tsx`
- `apps/dashboard/src/components/layout/TopBar.tsx`
- `apps/dashboard/src/components/layout/TopBarControls.tsx`
- `apps/dashboard/src/config/site.ts`
- `apps/dashboard/src/app/login/page.tsx`
- `apps/dashboard/src/components/library/AgentLibraryClient.tsx`
- `apps/dashboard/src/app/(app)/layout.tsx`
- `apps/dashboard/src/components/layout/PageTransition.tsx`
- `apps/dashboard/src/components/layout/PageShell.tsx`
- `apps/dashboard/src/components/layout/Sidebar.tsx`
- `apps/dashboard/src/components/dashboard/StatCard.tsx`
- `apps/dashboard/src/components/dashboard/TokenUsageCard.tsx`

## Behavior

- Added onboarding empty state from the Stitch concept and wired it into dashboard/projects when there are no projects.
- Added commit composer modal and wired it into task drawer and full task detail.
- Added lab routes for `obsidian_logic`, `void_protocol`, and `void_terminal`.
- Added `/premium` to cover the premium dashboard Stitch screen.
- Added `/projects/[name]/detail` for the separate project detail console screen.
- Polished project settings with a left settings navigation column inspired by the MovieTheater settings screens.
- Added real project deploy/reindex server actions that write project activity into the database.
- Added local git status and commit endpoints for the commit composer. It reads staged changes and commits only staged files.
- Added activity export endpoint and wired `Download_logs.json` to a real JSON download.
- Bound `/labs/*` and `/premium` to live workspace metrics from projects, sessions, tools, roles, skills, and bridge devices.
- Added a real project template scaffold flow at `/projects/templates` and wired onboarding "Start from Template" to it.
- Added MCP server registration and MCP profile management server actions.
- Expanded chat to a three-column active session UI with context, files, active tools, and generated artifacts.
- Enriched token analytics history with provider, role/model, duration, export, and daily usage from both sessions and tool usage.
- Replaced the Token Analytics placeholder filter with working provider/source filters and clickable session detail cards.
- Added MCP Monitor server/profile detail views so server cards and profile server chips are inspectable.
- Added a Knowledge Base master-detail view so lessons can be clicked and reviewed without relying on hover-only controls.
- Replaced static project detail action text with working copy/open/settings actions and live project health labels.
- Made dashboard activity project events clickable and replaced the dead refresh icon with a real dashboard refresh link.
- Renamed lab/premium copy from concept language to workspace/runtime language backed by live metrics.
- Updated app metadata, generated favicon, and per-page browser titles so tabs display as `Library | GCS Console` instead of the old GlobalClaudeSkills Dashboard title.
- Standardized visible app naming to GCS Console and cleaned a Library import loading label.
- Changed the app shell to a fixed viewport layout: the sidebar stays at `100dvh`, sidebar nav scrolls internally, and page content scrolls independently.
- Compacted large dashboard token numbers and allowed stat values to wrap without stretching cards.

## Checks

- `npm run lint`
- `npm run build`

## Gaps

- Local git commit and open-local actions require the dashboard runtime to have access to the project path.
- Template scaffold creates a minimal local starter; richer framework-specific templates can be added on top of the same action.
