---
name: planning-with-files
description: Use when a BA, researcher, or lead agent needs file-based planning for complex tasks, multi-step implementation briefs, research notes, or long-running work across Claude, Codex, or ChatGPT.
---

# Planning With Files

Inspired by file-based planning skills from curated SKILL.md repositories.

## Upstream Sources

- https://github.com/mxyhi/ok-skills
- https://github.com/openai/skills

## Workflow

1. Create or update a plan artifact instead of holding the plan only in chat.
2. Keep plan sections: goal, context, assumptions, steps, owners, verification, risks.
3. Assign role ownership using `agents/assignments/default-routing.json`.
4. When implementation begins, hand off only the current step and relevant context to the Dev role.
