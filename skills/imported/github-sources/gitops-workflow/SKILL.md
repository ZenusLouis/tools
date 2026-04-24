---
name: gitops-workflow
description: Use when working with ArgoCD, Flux, Kustomize, Kubernetes manifests, image tag bumps, secret boundaries, or GitOps source-of-truth decisions.
---

# GitOps Workflow

Use for Kubernetes and GitOps changes.

## Upstream Sources

- https://github.com/kodustech/awesome-agent-skills
- https://github.com/803/skills-supply

## Workflow

1. Identify source of truth before editing: app repo manifests, GitOps repo Application, or live secret script.
2. Keep real secrets outside Git.
3. Render Kustomize before applying when possible.
4. After sync, check Argo status, deployment events, pod logs, and rollout.
5. Record which repo/path ArgoCD watches.
