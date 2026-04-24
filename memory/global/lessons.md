# Global Lessons

Lessons learned across all projects. Checked before any /research call.

## NestJS
- **Circular dependency**: Use `forwardRef(() => ModuleB)` in both modules' imports array. [2026-04-18]
- **Validation pipe**: Set global in main.ts with `whitelist: true, transform: true` — not per-controller. [2026-04-18]
- **Transaction (Prisma)**: Use `prisma.$transaction(async (tx) => { ... })` for multi-table writes. [2026-04-18]

## Next.js App Router
- **Server component fetch**: Fetch directly in async component body — no useEffect, no useState. [2026-04-18]
- **Client component placement**: Keep client components as leaf nodes — push "use client" as far down as possible. [2026-04-18]
- **Env vars**: Only `NEXT_PUBLIC_` prefix is exposed to browser — never put secrets there. [2026-04-18]

## Spring Boot
- **@Transactional placement**: Put on service layer methods, not repository. readOnly=true for read methods. [2026-04-18]
- **N+1 prevention**: Use `FetchType.LAZY` + `@EntityGraph` or JOIN FETCH for specific queries. [2026-04-18]
- **Self-invocation**: Calling @Transactional method from same class skips proxy — extract to separate bean. [2026-04-18]

## FastAPI
- **Async session**: Use `AsyncSession` + `async with db.begin()` for transactions in async FastAPI. [2026-04-18]
- **Response model**: Always specify `response_model` on endpoints — controls serialization, prevents data leaks. [2026-04-18]

## Django
- **Atomic transactions**: Use `@transaction.atomic` decorator or `with transaction.atomic():` context manager. [2026-04-18]
- **N+1**: Always use `select_related` (FK) or `prefetch_related` (M2M) — check query count in tests. [2026-04-18]

## General
- **Prisma migration conflict**: Run `prisma migrate resolve --applied <migration-name>` when migration is stuck. [2026-04-18]
- **ACID multi-step writes**: Any operation touching > 1 table must be wrapped in a transaction. [2026-04-18]
- **Optimistic locking**: Use version field (@Version in JPA, rowversion in EF Core) for concurrent updates. [2026-04-18]
