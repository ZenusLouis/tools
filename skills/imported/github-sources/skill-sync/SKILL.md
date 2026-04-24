---
name: skill-sync
description: Use when syncing, cataloging, importing, or updating agent skills across Claude Code, Codex, ChatGPT/OpenAI, Cursor, OpenCode, or local SKILL.md-compatible folders.
---

# Skill Sync

Use for keeping skill sources organized and portable.

## Upstream Sources

- https://github.com/jdrhyne/agent-skills
- https://github.com/803/skills-supply

## Workflow

1. Add source metadata to `agents/sources/github-skill-sources.json`.
2. Add dashboard-importable entries to `skills/imported/marketplace.json`.
3. Create small local wrappers in `skills/imported/github-sources`.
4. Do not vendor large external repos unless explicitly requested.
5. Preserve source URL and role compatibility.
