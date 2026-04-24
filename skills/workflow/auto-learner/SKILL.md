---
name: auto-learner
description: >
  Activate when: user corrects Claude's output ("no, use X instead", "that's wrong",
  "actually we do Y here"), user rejects a suggestion, Claude makes a second attempt
  at the same task, or a codebase pattern differs from the loaded framework skill.
  Rate limit: max 1 trigger per task, max 3 per session. Skip if identical lesson exists.
model: claude-haiku-4-5-20251001
disable-model-invocation: true
---

# Auto-Learner Skill

## Pre-Check (always first — zero tokens if already known)
Grep `projects/<name>/decisions.md` and `memory/global/lessons.md` for the lesson topic.
If already recorded → skip entirely, return without action.

## Detection
Identify the type of correction:
- **Framework pattern**: NestJS/Next.js/etc. convention the skill got wrong
- **Project-specific**: this project's choice (library, pattern, convention)
- **General mistake**: applies across all projects

## Extraction
Extract the lesson in ≤ 1 line:
- What was wrong: `<bad pattern>`
- What is correct: `<correct pattern>`
- Context: when it applies

## Routing
| Type | Save to |
|------|---------|
| Framework pattern | `skills/frameworks/<fw>/SKILL.md` → `## Learned Patterns` section |
| Project-specific | `projects/<name>/decisions.md` |
| General mistake | `memory/global/lessons.md` |

## Confirmation (1 line only)
```
Save lesson: "<extracted lesson>"? [y/skip]
```
If user says `y` → append to target file.
If user says `skip` → discard, do not ask again this session.

## Append Format (framework skill)
```markdown
- **[YYYY-MM-DD]** <lesson text>
```

## Constraints
- Max 1 trigger per task (cooldown resets on /task-done)
- Max 3 appends per session
- Never read the full skill file after appending — Write-only (append)
- Never ask twice about the same lesson in the same session
