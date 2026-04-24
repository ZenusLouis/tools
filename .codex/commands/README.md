# Codex Commands

Codex does not use Claude slash-command files directly. These notes map GCS shared commands to Codex local work.

## Mappings

- `prepare-brief`: read project context, produce `brief.md`, do not edit code.
- `implement`: apply scoped code changes, run verification, produce `implementation.md`.
- `review`: inspect diff/tests, produce findings first, create `review.md`.
- `learn`: append a lesson to `agents/learning` or `projects/<project>/decisions.md`.
