# Global Coding Rules

## Universal
- No comments unless WHY is non-obvious (hidden constraint, subtle invariant, workaround)
- No code outside task scope
- No error handling for scenarios that can't happen
- Trust internal code and framework guarantees
- No feature flags or backwards-compat shims — just change the code
- Three similar lines is better than a premature abstraction
- No half-finished implementations

## Task Rules
- Each task ≤ 2 hours estimated work
- Each task touches ≤ 1 primary file (or 1 function/endpoint)
- Every task must have: clear input, clear output, at least 1 test case
- Break further if estimate > 2h — always ask user before proceeding

## Git Rules
- Commit message: `[TASK-ID] short description`
- Full body: task description + module context
- No --no-verify, no --no-gpg-sign unless user explicitly requests
- No force push to main/master
- One task = one commit (unless trivial fix)
- Stage specific files — never `git add -A` blindly

## Database & ACID Rules
- Multi-table writes **MUST** be in a single transaction (all-or-nothing)
- Roll back on any exception — never commit partial state
- `readOnly = true` / `AsNoTracking()` for read-only queries — better performance + intent clarity
- Optimistic locking (version/rowversion field) for entities updated concurrently
- Keep transactions short — no external HTTP calls, emails, or file I/O inside a transaction
- Parameterized queries / ORM always — never string-concatenated SQL
- Index foreign keys and any column used in WHERE / ORDER BY clauses

## Security (OWASP-aware)
- No SQL string concatenation — use parameterized queries / ORM
- Sanitize all user inputs at system boundary
- Never log sensitive data (tokens, passwords, PII)
- Use env vars for secrets — never hardcode
- No eval(), no dynamic require() with user input
- Validate file paths to prevent traversal attacks

## Testing
- Unit test: pure functions, business logic
- Integration test: API endpoints, DB queries
- No mock of DB unless explicitly requested (prefer real test DB)
- Test file next to source: `foo.test.ts` beside `foo.ts`

## Per-Framework Rules
See: `d:\GlobalClaudeSkills\skills\frameworks\<name>\SKILL.md`
