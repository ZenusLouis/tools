---
name: learn
description: >
  Activate when: /task-learn command is used, or user explicitly says "remember this"
  or "save this as a rule". Handles manual lesson saving.
model: claude-haiku-4-5-20251001
allowed-tools: Read, Write, Grep
---

# Learn Skill

## Usage
```
/task-learn "<what went wrong>" "<how to fix / avoid>"
```

## Process
1. Grep `memory/global/lessons.md` AND `projects/<name>/decisions.md` for similar lesson — dedup check
2. If similar exists → show it, ask "Update existing or add new?"
3. Categorize: framework / project-specific / general
4. Route to correct file (same as auto-learner routing)
5. Write entry with date and context

## Entry Format
```markdown
- **[YYYY-MM-DD]** <mistake context>: <fix/rule>
```

## Files
- General: `d:\GlobalClaudeSkills\memory\global\lessons.md`
- Project: `d:\GlobalClaudeSkills\projects\<name>\decisions.md`
- Framework: `d:\GlobalClaudeSkills\skills\frameworks\<fw>\SKILL.md`
