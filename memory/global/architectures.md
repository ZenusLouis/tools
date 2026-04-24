# Architecture Patterns

Reference architectures for common project types.

## Full-Stack Web (Next.js + NestJS)
- Frontend: Next.js App Router (SSR + React)
- Backend: NestJS modular monolith
- DB: PostgreSQL + Prisma ORM
- Cache: Redis (sessions, rate limiting, seat holds)
- Auth: JWT + refresh token rotation
- Deploy: Docker Compose dev / Vercel (web) + Railway (api) prod

## Java Backend API (Spring Boot)
- Layered: domain → application → infrastructure → presentation
- DB: PostgreSQL + JPA/Hibernate
- Transactions: `@Transactional` on service layer
- Auth: Spring Security + JWT
- Deploy: Docker + PostgreSQL + Adminer

## Python API (FastAPI)
- Layered: routes → services → repositories → models
- DB: PostgreSQL + SQLAlchemy async
- Migrations: Alembic
- Auth: JWT via python-jose
- Deploy: Docker + PostgreSQL + Redis

## Mobile (React Native + Expo)
- Navigation: Expo Router (file-based)
- State: Zustand + React Query
- Auth tokens: expo-secure-store
- Backend: any REST API

## Architecture Decision Log
<!-- Projects record their architecture decisions in their own projects/<name>/decisions.md -->
