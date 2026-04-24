---
name: skill-create
description: Scaffold a new custom skill from template
---

# /skill-create — Create New Skill

Scaffolds a new skill file with the correct frontmatter structure.

## Usage
```
/skill-create stripe-payments
/skill-create aws-deploy --type=command
```

## Steps
1. Determine type: model-invoked skill or user command
2. Create file at:
   - Skill: `skills/workflow/<name>/SKILL.md`
   - Command: `commands/<name>.md`
3. Populate with template frontmatter + sections

## SKILL.md Template
```markdown
---
name: <name>
description: >
  Activate when: <trigger condition>
model: claude-sonnet-4-6
disable-model-invocation: true
allowed-tools: Read, Write, Bash
---

# <Name> Skill

## When to Activate
<describe trigger>

## Steps
1. 
2. 

## Output
<what this skill produces>
```

## Command Template
```markdown
---
name: <name>
description: <one-line description>
---

# /<name> — <Title>

## Usage

## Steps

## Output
```
