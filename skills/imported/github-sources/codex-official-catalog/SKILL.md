---
name: codex-official-catalog
description: Use when importing, comparing, or designing Codex-compatible Agent Skills from the official OpenAI skills catalog; helps choose official/curated/experimental skill sources and preserve SKILL.md structure.
---

# Codex Official Catalog

Use the official OpenAI skills repository as the first reference when creating Codex-compatible skills.

## Source

https://github.com/openai/skills

## Workflow

1. Prefer official or curated skills before experimental ones.
2. Preserve the required `SKILL.md` frontmatter: `name` and `description`.
3. Keep wrappers in this repo small; link to the upstream source instead of copying large skill bodies.
4. If a skill is adopted, create a local wrapper under `skills/imported/github-sources/<skill>/SKILL.md`.
5. Record source URL and intended roles in `skills/imported/marketplace.json`.
