---
name: code-index
description: Build or update the code-index.md file map for the active project
model: claude-haiku-4-5-20251001
---

# /code-index — Build/Update File Map

Creates or updates `projects/<name>/code-index.md` — the token-saving file map.

## Full Build: /code-index

**Steps:**
1. Read `context.json["path"]` → project root
2. Glob source files — exclude noise:
   ```
   Include: src/**/*.{ts,tsx,js,py,java,cs}
   Exclude: *.test.* | *.spec.* | *.mock.* | __tests__/ | __mocks__/
            node_modules/ | dist/ | .next/ | build/ | target/ | .git/
            migrations/ | alembic/versions/ | *.generated.* | *.d.ts
   ```
3. If file count > 200: warn "Large project — index may take a moment. Proceeding."
4. For each file: Grep for exports, class names, route decorators, function signatures (1 Grep per file)
5. Group by directory, write one-liner per file
6. Write `code-index.md`

**Format:**
```markdown
# Code Index: <ProjectName> [HEADER — load on /start]
Modules: <detected modules with file counts>
Total: <N> files | Last indexed: <date>
Quick lookup: <module>→<folder> | <module>→<folder>
---FULL INDEX BELOW---

## <folder>/
- `<relative/path/file.ext>` — <one-line description>
...
```

Header = first 15 lines (up to `---FULL INDEX BELOW---`).
Full index loaded only during `/run-task`.

## Delta Update: /code-index --delta

Faster — only re-indexes changed files since last index:

**Steps:**
1. `Bash: git -C <path> diff --name-only HEAD~1 HEAD`
2. Filter to source files only
3. Re-generate entries only for those files
4. Patch existing `code-index.md` — keep all other lines unchanged
5. Update `lastIndexed` timestamp in header

## After /scaffold
Run `/code-index` automatically after scaffold to capture new structure.
