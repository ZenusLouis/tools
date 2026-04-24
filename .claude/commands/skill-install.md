---
name: skill-install
model: claude-haiku-4-5-20251001
description: Install a Claude Code skill from marketplace or GitHub URL
---

# /skill-install — Install Skill

Downloads and installs a skill from the marketplace or a GitHub URL.

## Usage
```
/skill-install qodo-skills
/skill-install https://github.com/user/my-skill.git
```

## Steps
1. If name (not URL): look up URL in `skills/imported/marketplace.json`
2. Clone or download to `skills/imported/<name>/`
3. Validate: must contain `SKILL.md` or `commands/` folder
4. List what was added: skills + commands
5. Do NOT auto-activate — user decides when to use

## Output
```
✓ Installed: qodo-skills
  Skills added:    skills/imported/qodo-skills/test-generator/SKILL.md
  Commands added:  skills/imported/qodo-skills/commands/gen-tests.md
  
  Not auto-activated. Use /mcp-use or load manually.
```

## Note
Installed skills are in `skills/imported/` — separate from built-in skills.
Review before using: they come from third parties.
