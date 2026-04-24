---
name: research
model: claude-sonnet-4-6
description: Research a topic/error using internal lessons + context7 docs lookup. Saves result.
---

# /research — Research Topic or Error

Finds solutions using internal knowledge first, then external docs via context7 MCP.

## Usage
```
/research "NestJS circular dependency"
/research "CORS error fetch next.js api route"
/research --save-skill "React Server Components patterns"
```

## Steps (order matters for token savings)
1. Grep `memory/global/lessons.md` for topic → if found, return immediately
2. Grep `projects/<name>/decisions.md` for topic → if found, return immediately
3. If not found locally: use `context7 MCP` → lookup exact docs section
4. Summarize solution (not full docs — 5-10 lines max)
5. Append to `memory/global/lessons.md`:
   ```markdown
   - **[date]** <topic>: <solution summary>  [source: <lib>]
   ```

## --save-skill Flag
After research, also update `skills/frameworks/<fw>/SKILL.md` with the pattern.
Useful for general framework patterns worth remembering across all projects.

## Output
```
Research: NestJS circular dependency

Solution: Use forwardRef(() => ModuleB) in both modules' imports array.
Source: NestJS docs (context7)
Saved to: memory/global/lessons.md

Lesson was new — not found in local knowledge.
```
