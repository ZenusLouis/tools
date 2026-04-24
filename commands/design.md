---
name: design
model: claude-sonnet-4-6
description: Generate architecture + tech stack decisions based on analysis. Optionally create Figma screens.
---

# /design — Architecture Design

Generates architecture decisions and tech stack from analysis.

## Usage
```
/design           → text architecture only
/design --figma   → architecture + generate Figma screens via Stitch
```

## Steps (token-optimized)
1. Read `projects/<name>/analysis-summary.md` — SUMMARY section only (20 lines)
2. Read `projects/<name>/code-index.md` — header 15 lines (if exists)
3. Read `projects/<name>/decisions.md` — confirmed answers
4. Invoke `architecture-designer` skill

## Output
- `projects/<name>/architecture-summary.md` (~30 lines — loaded frequently)
- `projects/<name>/architecture-full.md` (full detail — loaded on demand)

## GATE 2 (mandatory stop)
Before generating tasks, show architecture summary and wait for approval:
```
ARCHITECTURE PROPOSAL — Approve before coding

Stack: <table>
Modules: <list with task counts>
Assumptions: <list>

Approve? [yes / change X / cancel]
```

## --figma Flag
After GATE 2 approval:
1. List detected UI screens from analysis (show count first)
2. If screens > 8: ask "Generate designs for all N screens? (this makes N Stitch API calls) [yes / top-8 / cancel]"
3. For each screen (up to user-confirmed limit): `stitch.generate_screen_from_text` → get nodeId
4. Map tasks to nodeIds → write `design-map.json`
5. Backend tasks with no UI → `null` in design-map (no Stitch call)
6. Call `figma.generate_diagram` once for architecture FigJam

**Note:** Does NOT auto-call `figma.get_design_context` — that happens during `/run-task`.
**Cost guard:** Each Stitch call = ~500-2000 tokens. Ask before generating many screens.

## After Approval
- Suggest: `/scaffold <detected-framework>`
- If `--figma`: show design-map.json summary (n tasks with design, n backend-only)
