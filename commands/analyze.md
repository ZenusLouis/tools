---
name: analyze
model: claude-sonnet-4-6
description: Parse BRD/PRD/requirement document → extract modules, tasks, ambiguities
---

# /analyze — Requirement Analysis

Parses a requirement document and generates a structured task breakdown.

## Usage
```
/analyze              → reads context.json["docs"]["brd"] automatically
/analyze prd          → reads context.json["docs"]["prd"]
/analyze <file-path>  → reads specified file
```

## Steps
1. Determine source file:
   - No arg → `context.json["docs"]["brd"]`; if null → ask: "BRD path? Run `/project link brd <path>` or pass file directly."
   - `prd` → `context.json["docs"]["prd"]`; if null → ask: "PRD path?"
   - `<path>` → use that path directly
2. Convert if needed: `.docx` via `pandoc`, `.pdf` via `pdftotext`
3. Invoke `requirement-analyzer` skill
4. Save to `projects/<name>/analysis-summary.md` + `analysis-full.md`

## Multiple Docs (sequential — not simultaneous)
```
/analyze              → BRD first → summary saved
/analyze prd          → PRD analyzed WITH BRD summary as context → merged
```
Never load all docs into context at once — sequential merge only.

## GATE 1 (mandatory stop)
After analysis, show confirmation box before generating tasks:
```
┌─────────────────────────────────────────┐
│ ANALYSIS SUMMARY — Please confirm       │
│ App: <name>                             │
│ Actors: <list>                          │
│ Modules: <M1(Nt) M2(Nt) ...>           │
│ Stack: <suggestion>                     │
│                                         │
│ ⚠ Ambiguities:                         │
│   1. "<quote>" → <question>             │
│                                         │
│ Confirm? [yes/edit/cancel]              │
└─────────────────────────────────────────┘
```

## After Confirmation
- Populate TodoWrite with `[M{n}-F{n}-T{n}]` task IDs
- Write confirmed answers to `decisions.md`
- Suggest: `/design` next
