---
name: project
model: claude-haiku-4-5-20251001
description: Manage project registry — add, switch, link docs/tools, list projects
---

# /project — Project Registry Management

## Subcommands

### /project add <path>
Register a new project from an existing folder path.

**Steps:**
1. Glob `<path>/package.json` → detect Node.js frameworks (next, nestjs, react, etc.)
2. Glob `<path>/pom.xml` → detect Java/Spring Boot
3. Glob `<path>/requirements.txt` or `pyproject.toml` → detect Python frameworks
4. Glob `<path>/*.csproj` → detect .NET
5. Ask each question **one at a time** — wait for user reply before asking next:
   - Ask: "Figma URL? (Enter to skip)"  → wait for reply → save if provided
   - Ask: "GitHub repo URL? (Enter to skip)" → wait for reply → save if provided
   - Ask: "Linear project URL? (Enter to skip)" → wait for reply → save if provided
   - Ask: "BRD document path? (Enter to skip)" → wait for reply → save if provided
6. Create `d:\GlobalClaudeSkills\projects\<name>\context.json`
7. Update `projects/registry.json`
8. Auto-run `/code-index` for the project

**mcpProfile auto-selection (pick first match):**
| Framework detected | Profile assigned |
|--------------------|-----------------|
| `nextjs` or `nestjs` | `fullstack` |
| `spring-boot` | `backend-java` |
| `django` or `fastapi` | `backend-python` |
| only FE (react/angular/react-native, no backend) | `frontend` |
| anything else / unknown | `fullstack` |

**context.json created:**
```json
{
  "name": "<detected from folder name>",
  "path": "<absolute path>",
  "framework": ["<detected>"],
  "mcpProfile": "<auto-selected per table above>",
  "docs": {},
  "tools": {},
  "env": { "required": [], "envFile": ".env" },
  "lastIndexed": "<now>",
  "activeTask": null
}
```

**Note on auto-index:** Skip `/code-index` if no source files detected in `<path>/src` or `<path>/app` (i.e., project is brand new/empty). `/scaffold` will run it after creating files.

### /project use <name>
Switch active project for this session. Reads context.json from registry path.

### /project link <type> <path|url>
Link a document or tool URL to the active project's context.json.

```
/project link brd d:\Docs\BRD.docx         → context.json["docs"]["brd"]
/project link prd d:\Docs\PRD.pdf           → context.json["docs"]["prd"]
/project link figma https://figma.com/...   → context.json["tools"]["figma"]
/project link github https://github.com/... → context.json["tools"]["github"]
/project link linear https://linear.app/... → context.json["tools"]["linear"]
```

### /project list
Print all registered projects from registry.json with their framework and last indexed date.

### /project show
Pretty-print the active project's context.json.
