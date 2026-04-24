---
name: figma
model: claude-sonnet-4-6
description: Interact with Figma — read design, generate diagram, create new file
---

# /figma — Figma Integration

Direct Figma operations. All calls are explicit — never auto-triggered.

## Usage
```
/figma read <url>        → pull design context for a specific node
/figma screenshot <url>  → capture screen for visual review
/figma diagram           → generate architecture diagram in FigJam
/figma new               → create new Figma file for active project
```

## /figma read <url>
1. Parse fileKey and nodeId from URL
2. Call `figma.get_design_context(fileKey, nodeId)`
3. Output: component structure, colors, spacing, variants
4. Ready for code generation

## /figma screenshot <url>
1. Call `figma.get_screenshot(fileKey, nodeId)`
2. Attach to context for visual reference

## /figma diagram
1. Read `projects/<name>/architecture-summary.md`
2. Call `figma.generate_diagram` → FigJam architecture board
3. Save FigJam URL to `context.json["tools"]["figjam"]`

## /figma new
1. Call `figma.create_new_file(name: "<ProjectName> Design")`
2. Save URL to `context.json["tools"]["figma"]`
3. Run `/design --figma` to populate with screens

## Note
Figma MCP must be enabled. If not: `/mcp-use figma` first.
