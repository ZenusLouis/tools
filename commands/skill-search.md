---
name: skill-search
model: claude-haiku-4-5-20251001
description: Search marketplace and GitHub for Claude Code skills/plugins
---

# /skill-search — Find Skills

Searches for Claude Code skills from local marketplace index and GitHub.

## Usage
```
/skill-search testing
/skill-search figma
/skill-search "api documentation"
```

## Steps
1. Check `skills/imported/marketplace.json` (local cache, no network)
2. If insufficient: search GitHub `topic:claude-code-plugin <topic>`
3. List results with: name, description, stars, source

## Output
```
Results for "testing":

Local marketplace:
  qodo-skills       — AI-assisted test generation (★ 234)
  pr-review-toolkit — Code review + test coverage check (★ 89)

GitHub:
  anthropics/commit-commands — Official git workflow commands (★ 1.2k)
  user/jest-skill            — Jest-specific testing patterns (★ 45)

Install: /skill-install <name>
```
