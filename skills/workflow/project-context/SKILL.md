---
name: project-context
description: >
  Activate when: /start command is run, or user asks about the current project,
  active task, or project setup. Manages session context loading.
model: claude-haiku-4-5-20251001
allowed-tools: Read, Write
---

# Project Context Skill

## Session Bootstrap (/start)
Read exactly 3 files in sequence:

```
1. projects/<name>/context.json    (limit: 50 lines)
2. projects/<name>/code-index.md   (limit: 15 lines — header only)
3. projects/<name>/progress.json   (limit: 30 lines)
```

If no active project → read `projects/registry.json` → ask user which project to load.

## Output after /start
```
✓ Project: <name>
  Stack:       <frameworks from context.json>
  Active task: <activeTask or "none">
  MCP Profile: <mcpProfile>
  Last indexed: <lastIndexed>

Module in progress: <active module> (<n>/<total> tasks done)
Unresolved risks: <n> (run /progress --risks to view)

Context: ~800 tokens loaded.
```

## /project use <name>
- Read `projects/registry.json` → find path
- Load context.json from that path
- Update session active project

## Context Refresh
If `lastIndexed` is > 7 days ago → suggest `/code-index --delta`
If `activeTask` is set → show task name + hint to `/run-task <id>`
