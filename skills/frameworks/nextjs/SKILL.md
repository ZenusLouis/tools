---
name: nextjs
description: >
  Activate when: context.json framework includes "nextjs", or package.json contains "next".
  Provides Next.js App Router patterns, conventions, and best practices.
role: FRONTEND
model: claude-sonnet-4-6
disable-model-invocation: true
---

# Next.js Skill

## App Router Conventions
- Pages: `src/app/<route>/page.tsx` — async Server Components by default
- Layouts: `src/app/<route>/layout.tsx` — wraps children, persists across navigation
- Route groups: `(group)/` — organize routes without affecting URL
- Loading: `loading.tsx` — Suspense boundary for the route segment
- Error: `error.tsx` — must be Client Component (`"use client"`)
- Server Actions: in `actions.ts` files or inline with `"use server"` directive

## Data Fetching
- Server Component: fetch directly in async component body — no useEffect
- Client Component: use SWR or TanStack Query — never fetch in useEffect for initial load
- `cache: 'no-store'` for dynamic data; default is cached
- `revalidate: N` for ISR (seconds)

## Component Rules
- Default: Server Component (no hooks, no browser APIs)
- Add `"use client"` only when: useState, useEffect, browser events, browser APIs needed
- Keep Client Component leaf nodes — push them as far down the tree as possible
- Pass server data as props to client components — don't duplicate fetches

## Routing
- Dynamic: `[id]/page.tsx` — params: `{ params: { id: string } }`
- Catch-all: `[...slug]/page.tsx`
- Parallel routes: `@slot/page.tsx`
- API routes: `src/app/api/<route>/route.ts` — export GET, POST, etc.

## Project Structure
```
src/app/           ← pages and layouts
src/components/
  ui/              ← atomic, no business logic (shadcn components here)
  features/        ← feature components with business logic
src/lib/
  api/             ← API client, fetch wrappers
  stores/          ← Zustand stores
  hooks/           ← shared hooks
src/types/         ← global TypeScript types
src/config/        ← constants, env validation (zod)
```

## Key Packages
- Styling: Tailwind CSS v4 (native PostCSS) + shadcn/ui
- Forms: react-hook-form + zod
- State: Zustand (client), server state via Server Components
- Auth: NextAuth.js or custom JWT
- Read versions from package.json — never assume
- Tailwind v4: use `@import "tailwindcss";` in `globals.css` and `@tailwindcss/postcss` in PostCSS config.

## Anti-Patterns
- No `pages/` directory with App Router (pick one)
- No `getServerSideProps` / `getStaticProps` in App Router
- No fetching in Client Components when Server Component can do it
- No client-only state management for server data
- No legacy `@tailwind base/components/utilities` directives in v4 projects (use `@import "tailwindcss"`)

## Learned Patterns
<!-- auto-learned entries appended below -->
- **[2026-04-19]** Tailwind v4 scaffolding: use `@import "tailwindcss"` (not v3 `@tailwind` directives) in globals.css, and `@tailwindcss/postcss` in PostCSS config. Also use `@theme` block for Tailwind-native color/font tokens instead of extending in tailwind.config.ts.
