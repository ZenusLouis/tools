# GCS Agent Instructions

This repository supports Claude Code, Codex, ChatGPT/OpenAI dashboard agents, and custom roles.

## Source Of Truth

- Shared agent registry: `agents/registry.json`
- Shared roles: `agents/roles/*.json`
- Shared commands: `agents/commands/*.md`
- Shared learning: `agents/learning/*.md`
- Imported skill catalog: `skills/imported/marketplace.json`
- Imported skill wrappers: `skills/imported/github-sources/*/SKILL.md`

## Provider Adapters

- Claude Code: `.claude/commands`, `.claude/roles`
- Codex: `.codex/commands`, `.codex/skills`
- ChatGPT/OpenAI dashboard-run: `.agents/providers/chatgpt`

## Working Rules

1. Read `agents/registry.json` before adding provider-specific artifacts.
2. Add reusable skills under `skills/**/SKILL.md`; add provider wrappers only when needed.
3. Keep external GitHub sources as metadata/wrappers unless explicitly asked to vendor code.
4. Keep secrets out of Git. Runtime secrets are applied through bridge/deploy scripts.
5. For task work, emit artifacts: `brief.md`, `implementation.md`, `review.md`, or learning notes.

## Useful Commands

```text
python scripts/agent_skill_catalog.py check
python scripts/agent_skill_catalog.py report
```
