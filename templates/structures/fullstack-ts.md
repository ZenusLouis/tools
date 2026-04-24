# Full-Stack TypeScript Monorepo — Next.js (FE) + NestJS (BE)

> **Frontend:** Next.js App Router — SSR, RSC, Client Components
> **Backend:** NestJS — REST API / BFF, Kafka consumers, Auth
> **Shared:** Types, validation schemas, constants (no framework deps)

---

## A. Monorepo Structure

```
project-root/
├── apps/
│   ├── web/                           ← FRONTEND — Next.js App Router
│   └── api/                           ← BACKEND  — NestJS
│
├── packages/
│   └── shared/                        ← Types, Zod schemas, constants
│       ├── src/
│       │   ├── types/
│       │   │   ├── user.types.ts
│       │   │   └── order.types.ts
│       │   ├── schemas/               ← Zod schemas (shared validation)
│       │   │   ├── user.schema.ts
│       │   │   └── order.schema.ts
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── docker-compose.yml
├── docker-compose.dev.yml
├── turbo.json                          ← Turborepo pipeline
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

---

## B. Frontend — Next.js App Router (apps/web/)

```
apps/web/
├── src/
│   ├── app/                           ← App Router (Next.js)
│   │   ├── (auth)/                    ← Route group: no layout
│   │   │   ├── login/
│   │   │   │   └── page.tsx           ← Server Component
│   │   │   └── register/
│   │   │       └── page.tsx
│   │   ├── (main)/                    ← Route group: with main layout
│   │   │   ├── layout.tsx             ← Shell: Navbar, Sidebar
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   └── [feature]/
│   │   │       ├── page.tsx           ← List view (Server Component)
│   │   │       └── [id]/
│   │   │           └── page.tsx       ← Detail view (SSR)
│   │   ├── api/                       ← BFF API routes (optional)
│   │   │   └── auth/[...nextauth]/
│   │   │       └── route.ts
│   │   ├── layout.tsx                 ← Root: fonts, providers, metadata
│   │   ├── globals.css
│   │   └── not-found.tsx
│   │
│   ├── components/
│   │   ├── ui/                        ← Shadcn/UI atomic components (no business logic)
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   └── dialog.tsx
│   │   └── features/                  ← Feature components (business-aware)
│   │       └── <feature>/
│   │           ├── index.ts           ← Barrel export
│   │           ├── <Feature>List.tsx  ← Client Component
│   │           ├── <Feature>Form.tsx  ← react-hook-form + zod
│   │           └── use<Feature>.ts    ← Custom hook (SWR/TanStack Query)
│   │
│   ├── lib/
│   │   ├── api/
│   │   │   ├── client.ts              ← Fetch wrapper (base URL, auth headers)
│   │   │   └── <feature>.api.ts       ← API calls per feature
│   │   ├── auth/
│   │   │   └── auth.ts                ← NextAuth or custom auth helpers
│   │   ├── stores/                    ← Zustand global state
│   │   │   └── <feature>.store.ts
│   │   └── utils/
│   │       └── format.ts
│   │
│   ├── types/                         ← App-local types (extends @shared/types)
│   └── config/
│       ├── site.ts                    ← App metadata, nav config
│       └── env.ts                     ← Zod env validation (t3-env or custom)
│
├── public/
├── next.config.ts
├── tailwind.config.ts
├── components.json                    ← Shadcn config
├── .env.local                         ← gitignored
├── .env.example
└── package.json
```

---

## C. Backend — NestJS (apps/api/)

```
apps/api/
├── src/
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── dto/
│   │   │   │   ├── login.dto.ts
│   │   │   │   └── register.dto.ts
│   │   │   ├── guards/
│   │   │   │   └── jwt-auth.guard.ts
│   │   │   ├── strategies/
│   │   │   │   └── jwt.strategy.ts
│   │   │   ├── auth.controller.ts     ← POST /auth/login, /auth/refresh
│   │   │   ├── auth.service.ts        ← JWT logic, bcrypt, refresh rotation
│   │   │   └── auth.module.ts
│   │   │
│   │   └── <feature>/
│   │       ├── dto/
│   │       │   ├── create-<feature>.dto.ts
│   │       │   ├── update-<feature>.dto.ts
│   │       │   └── <feature>-response.dto.ts
│   │       ├── entities/
│   │       │   └── <feature>.entity.ts   ← TypeORM @Entity, @Version
│   │       ├── events/
│   │       │   └── <feature>-created.event.ts
│   │       ├── <feature>.controller.ts
│   │       ├── <feature>.service.ts      ← All business logic
│   │       ├── <feature>.repository.ts   ← Custom queries (optional)
│   │       └── <feature>.module.ts
│   │
│   ├── common/
│   │   ├── decorators/
│   │   │   └── current-user.decorator.ts
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts
│   │   ├── interceptors/
│   │   │   ├── logging.interceptor.ts
│   │   │   └── transform.interceptor.ts
│   │   └── pipes/
│   │
│   ├── config/
│   │   └── database.config.ts
│   │
│   ├── database/
│   │   └── migrations/
│   │       └── YYYYMMDDHHMMSS-create-users.ts  ← TypeORM migrations
│   │
│   └── main.ts
│
├── test/
│   ├── unit/
│   └── e2e/
│
├── .env.example
└── package.json
```

---

## D. Shared Package (packages/shared/)

```typescript
// packages/shared/src/types/user.types.ts
// Pure TypeScript — NO framework imports

export interface User {
  id: number;
  email: string;
  createdAt: string;
}

export interface CreateUserRequest {
  email: string;
  password: string;
}

// packages/shared/src/schemas/user.schema.ts
import { z } from 'zod';

export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// Used in FE (react-hook-form resolver) AND BE (class-validator fallback)
```

---

## E. Docker Compose

```yaml
version: '3.9'
services:
  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    ports: ["3000:3000"]
    environment:
      NEXT_PUBLIC_API_URL: http://api:4000
    depends_on: [api]

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    ports: ["4000:4000"]
    environment:
      DATABASE_URL: postgresql://postgres:dev@db:5432/appdb
      JWT_SECRET: ${JWT_SECRET}
      REDIS_URL: redis://redis:6379
    depends_on: [db, redis]

  db:
    image: postgres:16-alpine
    environment: {POSTGRES_DB: appdb, POSTGRES_PASSWORD: dev}
    volumes: [db_data:/var/lib/postgresql/data]
    ports: ["5432:5432"]

  redis:
    image: redis:7-alpine

volumes:
  db_data:
```

---

## F. Complete Dependencies

### apps/web/ — package.json
```json
{
  "dependencies": {
    "next": "latest",
    "react": "latest",
    "react-dom": "latest",

    "tailwindcss": "latest",
    "@tailwindcss/forms": "latest",
    "shadcn-ui": "latest",

    "react-hook-form": "latest",
    "@hookform/resolvers": "latest",
    "zod": "latest",

    "swr": "latest",                    
    "@tanstack/react-query": "latest",

    "zustand": "latest",

    "next-auth": "latest",
    "jose": "latest",

    "clsx": "latest",
    "tailwind-merge": "latest",
    "lucide-react": "latest"
  }
}
```

### apps/api/ — package.json
```json
{
  "dependencies": {
    "@nestjs/common": "latest",
    "@nestjs/core": "latest",
    "@nestjs/platform-express": "latest",
    "@nestjs/config": "latest",
    "@nestjs/typeorm": "latest",
    "typeorm": "latest",
    "pg": "latest",
    "@nestjs/jwt": "latest",
    "@nestjs/passport": "latest",
    "passport-jwt": "latest",
    "bcrypt": "latest",
    "@nestjs/swagger": "latest",
    "@nestjs/throttler": "latest",
    "class-validator": "latest",
    "class-transformer": "latest",
    "nestjs-pino": "latest"
  }
}
```

---

## Naming Conventions
- FE components: `PascalCase` — `BookingForm.tsx`, `UserCard.tsx`
- FE hooks: `camelCase` with `use` prefix — `useBooking.ts`
- FE files: `PascalCase` for components, `camelCase` for utilities
- BE files: `kebab-case` — `user.service.ts`, `create-user.dto.ts`
- BE classes: `PascalCase` — `UserService`, `CreateUserDto`
- Shared types: `PascalCase` interfaces — `UserResponse`, `CreateOrderRequest`
- API routes: `/api/v1/users/:id` (kebab-case, versioned, BE owns)
- DB tables: `snake_case` — `user_roles`, `order_items`
