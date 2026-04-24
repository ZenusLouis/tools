---
name: security-review
description: Use when reviewing application security risks, auth/session handling, secret management, CI/CD credentials, Kubernetes secrets, dependency risks, or SAST findings.
---

# Security Review

Use for focused security checks.

## Upstream Sources

- https://github.com/kodustech/awesome-agent-skills
- https://github.com/alirezarezvani/claude-skills

## Workflow

1. Identify trust boundaries and secret flow.
2. Check auth/session middleware and API route protection.
3. Verify secrets are not committed and are not logged.
4. Review deployment manifests for least privilege and safe rollout behavior.
5. Output findings first with severity and concrete fix.
