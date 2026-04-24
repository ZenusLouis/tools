---
name: react
description: >
  Activate when: context.json framework includes "react" (and NOT "nextjs").
  Provides React patterns for SPAs — Vite, CRA, or similar setups.
role: FRONTEND
model: claude-sonnet-4-6
disable-model-invocation: true
---

# React Skill

## Component Patterns
- Functional components only — no class components
- Custom hooks for reusable logic: prefix with `use`
- Co-locate state as low as needed — lift only when shared
- Composition over prop drilling: Context or Zustand for distant state

## Hooks Rules
- `useState`: local UI state only
- `useEffect`: external sync (subscriptions, timers) — not data fetching
- `useMemo` / `useCallback`: only when profiler shows perf issue — not preemptively
- Custom hook in its own file: `use<Name>.ts`

## Data Fetching
- TanStack Query (React Query) for server state — not useEffect + useState
- SWR as lighter alternative
- Zustand for client-only state (UI state, auth, preferences)

## Project Structure (Vite / SPA)
```
src/
  components/
    ui/           ← atomic, reusable (no business logic)
    features/     ← feature-specific components
  hooks/          ← shared custom hooks
  stores/         ← Zustand stores
  services/       ← API call functions
  types/          ← TypeScript types
  pages/          ← route-level components (react-router)
  lib/            ← utilities, constants
```

## Styling
- Tailwind CSS preferred
- CSS Modules for scoped styles when needed
- No inline styles except dynamic values

## Key Packages
- Routing: react-router-dom
- Forms: react-hook-form + zod
- State: Zustand
- Data: TanStack Query
- Read versions from package.json — never assume

## Anti-Patterns
- No fetch in useEffect for data loading — use React Query
- No prop drilling > 2 levels — use Context or Zustand
- No index as key in lists with reorderable items
- No mutating state directly

## Learned Patterns
<!-- auto-learned entries appended below -->
