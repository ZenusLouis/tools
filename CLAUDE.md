# Global Claude Code — Master Instructions
<!-- Last verified: 2026-04-18 | Living document — update when behavior needs changing -->

<!-- ═══ STABLE BLOCK — place first for prompt cache hit (5-min TTL) ═══ -->

## Core Behavior
- Response ≤ 100 words unless task requires more detail
- **Commands** (`/start`, `/mcp-use`, `/progress`, `/task-list`, etc.): output ONLY the defined Output block from the command file — no extra explanation, no markdown headers, no tables unless the Output block specifies it
- Never volunteer multi-paragraph explanations for simple commands
- **NEVER** add code outside task scope; no refactor beyond what's asked
- Validate only at system boundaries (user input, external APIs)
- No backwards-compat hacks, no half-finished implementations

## Token Saving — **MANDATORY**
1. **ALWAYS** read `projects/<name>/code-index.md` (header 15 lines) before scanning project
2. Use Grep/Glob BEFORE Read — only Read files confirmed necessary
3. Use `context.json` for all project URLs/config — **NEVER** ask for URLs already stored there
4. Use Haiku model for read-only commands: `/token-stats`, `/task-log`, `/task-list`, `/start`
5. Check `decisions.md` before asking any question — may already be answered
6. File > 300 lines: Read with offset+limit only. File > 1000 lines: Grep first.
7. **NEVER** load `**/*` Glob without file extension filter

## Session Bootstrap — Run `/start` Every Session
Loads 3 files (~800 tokens total):
- `projects/<name>/context.json` — URLs, framework names, active task
- `projects/<name>/code-index.md` — file map (header only)
- `projects/<name>/progress.json` — task state + unresolved risks

## Task System
- ID format: `M{n}-F{n}-T{n}` (Module-Feature-Task), e.g. `M2-F1-T3`
- Each task ≤ 2 hours work, touches ≤ 1 primary file
- Commit format: `[TASK-ID] short description`

## ACID Compliance — **MANDATORY** for DB Operations
- Any write touching > 1 table **MUST** be wrapped in a transaction
- Catch exceptions and roll back explicitly — never silently swallow DB errors
- Use optimistic locking (version field) for concurrent update scenarios
- **NEVER** use `SELECT FOR UPDATE` without a timeout — risk of deadlock
- See framework-specific patterns in `skills/frameworks/<fw>/SKILL.md`

## Confirmation Gates — **Mandatory Stops**
- **GATE 1**: After `/analyze` — show summary box, wait for confirm before tasks
- **GATE 2**: After `/design` — show architecture, wait for approve before coding
- **GATE 3**: Before first task of each Module — confirm module start
- **GATE 4**: Before `/task-commit` — show diff summary, confirm message

## Learning
After any mistake: `/task-learn "<what happened>" "<how to avoid>"`
Saved to: `d:\GlobalClaudeSkills\memory\global\lessons.md`

## Anti-Patterns — **NEVER Do These**
- Don't scan project folder without checking code-index first
- Don't ask about URLs/tools already in context.json
- Don't start coding without passing the appropriate GATE
- Don't auto-call Figma MCP — only on explicit `/figma` command or `/run-task` with nodeId
- Don't load all framework skills — only those in `context.json["framework"]`

@d:\GlobalClaudeSkills\RULES.md
