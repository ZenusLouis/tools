---
name: task-learn
model: claude-haiku-4-5-20251001
description: Manually save a lesson learned to the appropriate memory file
---

# /task-learn — Save Lesson Manually

Saves a lesson to the correct memory file based on scope.

## Usage
```
/task-learn "Used class-transformer instead of zod" "This project uses zod for validation"
/task-learn "NestJS service not in module providers" "Always declare in module providers array"
```

## Steps
1. Dedup check: Grep `decisions.md` + `lessons.md` for similar lesson
2. If similar exists → show it, ask: "Update existing or add new? [update/add/skip]"
3. Categorize: project-specific vs framework vs general
4. Route:
   - Project-specific → `projects/<name>/decisions.md`
   - Framework pattern → `skills/frameworks/<fw>/SKILL.md` → `## Learned Patterns`
   - General → `memory/global/lessons.md`
5. Append with date

## Entry Format
```markdown
- **[YYYY-MM-DD]** <mistake context>: <correct approach>
```
