---
name: scaffold
model: claude-haiku-4-5-20251001
description: Create project folder structure and Docker setup from framework template
---

# /scaffold — Project Structure Scaffolding

Creates a complete folder structure with Docker from a framework template.

## Usage
```
/scaffold nextjs <ProjectName>
/scaffold nestjs <ProjectName>
/scaffold fullstack-ts <ProjectName>   → Next.js + NestJS monorepo
/scaffold react-native <ProjectName>
/scaffold angular <ProjectName>
/scaffold django <ProjectName>
/scaffold fastapi <ProjectName>
/scaffold spring-boot <ProjectName> [--ddd]
/scaffold dotnet <ProjectName>
```

## Steps
1. Read `templates/structures/<framework>.md`
2. Show GATE confirmation with folder tree preview
3. After confirmation: create folders + key files in `context.json["path"]`
4. Create `.env.example` with required vars from analysis (if `/analyze` was run)
5. Update `context.json["env"]["required"]` from template defaults
6. Auto-run `/code-index` to capture new structure

## GATE (mandatory stop)
```
Will create in <path>:
<folder tree preview — top 20 lines>

Includes: Docker Compose + Dockerfile.dev + .env.example
Create? [yes / cancel]
```

## Docker Services (auto-selected by framework)
| Framework | Services |
|-----------|---------|
| nextjs + nestjs | app + postgres + redis |
| spring-boot | app + postgres + adminer |
| django | app + postgres + celery + redis |
| fastapi | app + postgres + redis |
| react-native | (no Docker — mobile app) |

## After Scaffold
- Run `/code-index` automatically
- Suggest: `/design --figma` if Figma URL is in context.json
