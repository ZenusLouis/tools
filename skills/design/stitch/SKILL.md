---
name: stitch
description: >
  Activate when: user asks to generate UI screens, create mockups, design pages,
  or use Stitch to visualize a feature. Also activates during /design --figma flow
  when generating screens for tasks.
model: claude-sonnet-4-6
disable-model-invocation: true
allowed-tools: mcp__stitch__create_project, mcp__stitch__create_design_system, mcp__stitch__generate_screen_from_text, mcp__stitch__list_screens, mcp__stitch__get_screen, mcp__stitch__list_projects, mcp__stitch__get_project, mcp__stitch__edit_screens, mcp__stitch__generate_variants, mcp__stitch__apply_design_system, mcp__stitch__update_design_system, mcp__stitch__list_design_systems
---

# Stitch Skill

Stitch MCP generates UI screens from text prompts and returns HTML + screenshot.

## ⚠ Critical Rules
- **NEVER call generate_screen_from_text in parallel** — call ONE at a time, wait for result
- If call times out: check `list_screens` first — generation may have succeeded in background
- Use `GEMINI_3_FLASH` for fast iteration, `GEMINI_3_1_PRO` for final quality
- Keep prompts focused (1 screen, clear layout) — long prompts increase timeout risk

## Workflow

### New Project
1. `create_project` → get projectId
2. `create_design_system` → define colors, fonts, roundness, designMd
3. `apply_design_system` (or `update_design_system`) → apply to project
4. Generate screens one by one with `generate_screen_from_text`
5. Save projectId to `context.json["tools"]["stitch"]`

### Add Screen to Existing Project
1. Read projectId from `context.json["tools"]["stitch"]`
2. Call `generate_screen_from_text` with projectId + prompt
3. If timeout → call `list_screens` to get result

### Edit Existing Screen
1. `list_screens` → find screenId
2. `edit_screens` with change description

## Prompt Writing Rules
- Describe layout structure first (sidebar, header, main content)
- Specify exact components: cards, tables, charts, forms
- Include sample data so design looks realistic (not empty states)
- State color values explicitly: background, accent, status colors
- Keep prompt under 200 words to avoid timeouts

## Design System Template (dark dev tool)
```
colorMode: DARK
headlineFont: GEIST
bodyFont: GEIST  
customColor: #6366f1
colorVariant: TONAL_SPOT
roundness: ROUND_EIGHT
designMd: "Developer tool. Dark bg #0f0f17, card bg #1a1a2e, indigo accent #6366f1.
           Status: green=#22c55e done, yellow=#eab308 in-progress, red=#ef4444 blocked."
```

## Screen Prompt Template
```
[Screen name] for [app name].

[Layout]: [sidebar/header/main structure]

[Main content]:
- [Section 1]: [components with sample data]
- [Section 2]: [components with sample data]

[Theme]: dark bg #0f0f17, indigo accent #6366f1, card bg #1a1a2e.
```

## Output
After generating each screen:
- Report: screen title + nodeId (screenId)
- Save nodeId to `design-map.json` for the relevant task
- Suggest next screen or `/figma read` to pull into code
