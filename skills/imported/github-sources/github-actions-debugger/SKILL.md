---
name: github-actions-debugger
description: Use when debugging failed GitHub Actions, Jenkins, CI build logs, test failures, or deployment pipeline issues; converts logs into root cause, fix plan, and verification steps.
---

# GitHub Actions Debugger

Use for CI/CD failure triage.

## Upstream Sources

- https://github.com/mxyhi/ok-skills
- https://github.com/kodustech/awesome-agent-skills

## Workflow

1. Collect failing job name, command, and last 100-200 log lines.
2. Separate infrastructure failures from code/test failures.
3. Identify the first meaningful error, not just the final exit line.
4. Produce a fix plan and a rerun command.
