# prepare-brief

## Purpose

Turn raw requirements, tickets, docs, or discussion into an implementation-ready brief.

## Inputs

- Project context from `projects/<project>/context.json`
- Existing decisions from `projects/<project>/decisions.md`
- Relevant skills from `skills/**/SKILL.md`
- User request or task ID

## Output Artifact

Write or return `brief.md` with:

- Problem statement
- Scope and non-goals
- Acceptance criteria
- Constraints and risks
- Suggested implementation owner role
- Verification plan

## Default Role

`ba-analyst`
