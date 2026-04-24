# GCS Agent Hub

This folder is the provider-neutral source of truth for multi-agent work.

## Layout

- `roles/` stores generated role definitions used by the dashboard.
- `commands/` stores shared command contracts that can be adapted per provider.
- `learning/` stores cross-agent lessons, decisions, and feedback loops.
- `assignments/` stores workspace/task routing rules when a role is assigned to an agent.

Provider-specific runtime adapters live outside this folder:

- `.claude/` for Claude Code commands and role prompts.
- `.codex/` for Codex skills, command notes, and learning hooks.
- `.agents/providers/chatgpt/` for ChatGPT/OpenAI dashboard-run artifacts.
