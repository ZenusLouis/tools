---
name: mcp-use
model: claude-haiku-4-5-20251001
description: Load an MCP profile or add a specific MCP server for the current session
---

**RESPONSE RULE: Reply in ≤ 5 lines. No tables, no headers, no markdown blocks.**

# /mcp-use — MCP Profile Management

Controls which MCP servers are active in the current session.
Each server's tool descriptions consume context tokens — only load what's needed.

## Usage
```
/mcp-use fullstack        → enable: github + figma + stitch + postman + supabase + typescript-lsp + context7
/mcp-use frontend         → enable: github + figma + stitch + context7 + typescript-lsp
/mcp-use backend-java     → enable: github + jdtls-lsp + context7
/mcp-use backend-python   → enable: github + context7 + supabase + postman
/mcp-use api-design       → enable: github + postman + context7
/mcp-use figma            → add figma server to current session
/mcp-use list             → show currently active MCP servers
```

## Available Profiles
See `mcp/profiles/*.json` for full server lists per profile.

## Auto-Selection
`/start` reads `context.json["mcpProfile"]` and loads that profile automatically.
Use `/mcp-use` to override or add servers mid-session.

## Output
```
MCP profile loaded: fullstack
Active servers: github · figma · stitch · postman · supabase · typescript-lsp
Token impact: ~2,400 tokens for tool descriptions
```

## How MCP Loading Works
MCP servers are loaded at **session start** from `.mcp.json` — Claude Code has no runtime API to enable/disable them mid-session. `/mcp-use` is a **guidance command**: it shows which servers are needed and whether they're configured.

If a needed server is missing from your active session:
1. Run `claude mcp list` to see what's installed
2. Run `claude mcp add <name>` to register a server
3. Restart the Claude Code session — new servers load on startup

Use `/mcp-use list` to see which MCP tools are currently available in this session.
