# Next.js — Production Structure Templates

> **Role: FRONTEND ONLY.** Pair with NestJS/FastAPI/Django/Spring Boot for backend.

---

## A. App Router — Standard SPA/SSR App

```
src/
├── app/                               ← App Router root
│   ├── (auth)/                        ← Route group: no shared layout
│   │   ├── login/
│   │   │   └── page.tsx               ← Server Component (async)
│   │   └── register/
│   │       └── page.tsx
│   │
│   ├── (main)/                        ← Route group: main shell layout
│   │   ├── layout.tsx                 ← Shell: Navbar + Sidebar
│   │   ├── dashboard/
│   │   │   └── page.tsx               ← Server Component (data fetch on server)
│   │   └── [feature]/
│   │       ├── page.tsx               ← List view (Server Component)
│   │       ├── [id]/
│   │       │   └── page.tsx           ← Detail view (SSR, generateMetadata)
│   │       └── loading.tsx            ← Suspense fallback
│   │
│   ├── api/                           ← Optional BFF API routes
│   │   └── auth/
│   │       └── [...nextauth]/
│   │           └── route.ts
│   │
│   ├── layout.tsx                     ← Root: html, body, fonts, providers
│   ├── globals.css
│   ├── not-found.tsx
│   └── error.tsx                      ← Error boundary (client component)
│
├── components/
│   ├── ui/                            ← Atomic UI components (no business logic)
│   │   ├── button.tsx                 ← Shadcn/UI or custom
│   │   ├── input.tsx
│   │   ├── dialog.tsx
│   │   └── index.ts                   ← Barrel export
│   │
│   └── features/                      ← Feature-scoped components (business-aware)
│       └── <feature>/
│           ├── index.ts               ← Barrel export
│           ├── <Feature>List.tsx      ← 'use client' — interactive list
│           ├── <Feature>Form.tsx      ← 'use client' — react-hook-form + zod
│           ├── <Feature>Card.tsx      ← Server or Client component
│           └── use<Feature>.ts        ← 'use client' hook (TanStack Query or SWR)
│
├── lib/
│   ├── api/
│   │   ├── client.ts                  ← Fetch wrapper (base URL, auth headers, error handling)
│   │   └── <feature>.api.ts           ← Feature-specific API calls
│   │
│   ├── auth/
│   │   └── session.ts                 ← Server-side session utils (iron-session or NextAuth)
│   │
│   ├── stores/                        ← Zustand client state
│   │   └── <feature>.store.ts
│   │
│   ├── hooks/                         ← App-wide shared hooks
│   │   └── use-debounce.ts
│   │
│   └── utils/
│       ├── format.ts
│       └── cn.ts                      ← clsx + tailwind-merge helper
│
├── types/                             ← TypeScript types (extends shared package if monorepo)
│   ├── api.types.ts
│   └── index.ts
│
└── config/
    ├── site.ts                        ← App name, nav items, metadata defaults
    └── env.ts                         ← Zod env validation (t3-env)

Root files:
├── next.config.ts
├── postcss.config.mjs                 ← Tailwind v4 PostCSS plugin
├── tailwind.config.ts                 ← Optional (legacy/shadcn compatibility)
├── components.json                    ← Shadcn config
├── .env.local                         ← gitignored
└── .env.example
```

---

## B. Complete package.json Dependencies

```json
{
  "dependencies": {
    "next": "latest",
    "react": "latest",
    "react-dom": "latest",

    "tailwindcss": "latest",
    "@tailwindcss/postcss": "latest",  ← Required for v4
    "postcss": "latest",
    "@tailwindcss/forms": "latest",
    "@tailwindcss/typography": "latest",

    "@tanstack/react-query": "latest",
    "@tanstack/react-query-devtools": "latest",

    "react-hook-form": "latest",
    "@hookform/resolvers": "latest",
    "zod": "latest",

    "zustand": "latest",

    "next-auth": "latest",
    "jose": "latest",

    "axios": "latest",

    "clsx": "latest",
    "tailwind-merge": "latest",
    "lucide-react": "latest",
    "class-variance-authority": "latest",

    "@radix-ui/react-dialog": "latest",
    "@radix-ui/react-dropdown-menu": "latest",
    "@radix-ui/react-toast": "latest"
  },
  "devDependencies": {
    "typescript": "latest",
    "@types/node": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "eslint": "latest",
    "eslint-config-next": "latest",
    "prettier": "latest",
    "prettier-plugin-tailwindcss": "latest",
    "@testing-library/react": "latest",
    "@testing-library/jest-dom": "latest",
    "jest": "latest",
    "jest-environment-jsdom": "latest",
    "playwright": "latest"
  }
}
```

---

## C. Configuration Files (Tailwind v4)

### 1. postcss.config.mjs
```javascript
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
export default config;
```

### 2. src/app/globals.css
```css
@import "tailwindcss";

/* Custom theme variables can be added here using @theme */
@theme {
  --color-brand: #3b82f6;
}
```

---

## Naming Conventions
- Components: `PascalCase` — `BookingForm.tsx`, `UserCard.tsx`
- Hooks: `camelCase` with `use` prefix — `useBooking.ts`, `useDebounce.ts`
- Stores: `camelCase` with `store` suffix — `booking.store.ts`
- API files: `camelCase` with feature + `.api` — `booking.api.ts`
- Types: `PascalCase` interfaces — `BookingResponse`, `CreateOrderRequest`
- Route segments: `kebab-case` directory names — `movie-detail/`, `user-settings/`
- CSS: Tailwind utility classes; no separate `.module.css` except for complex animations
