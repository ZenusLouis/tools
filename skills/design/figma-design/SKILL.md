---
name: figma-design
description: >
  Activate when: /figma command is used, context.json has tools.figma URL and user
  asks about UI design, components, or screen implementation from a Figma design.
model: claude-sonnet-4-6
disable-model-invocation: true
allowed-tools: Read, Write, Grep
---

# Figma Design Skill — Design-to-Code Implementation

## Skill Boundaries

| Task | Skill to Use |
|------|-------------|
| Implement Figma design → code | **This skill** |
| Create/edit nodes IN Figma canvas | figma-use MCP directly |
| Build screen from text description (no Figma) | Stitch MCP directly |
| Only map Code Connect components | figma-code-connect |
| Generate architecture FigJam diagram | `/figma diagram` command |

---

## Core Principle
Each task pulls ONLY its mapped Figma node — never the full file.
The mapping lives in `projects/<name>/design-map.json`.

Before any Figma call:
1. Read `design-map.json` → get `nodeId` for the task
2. `nodeId: null` → skip Figma entirely (backend/logic task)
3. `nodeId` exists → call `get_design_context(fileKey, nodeId)` — 1 node only

---

## 7-Step Implementation Workflow

### Step 1 — Extract Node ID
Parse Figma URL: `https://figma.com/design/:fileKey/:name?node-id=42-15`
- `fileKey` = path segment after `/design/`
- `nodeId` = `node-id` param, convert `-` to `:` (e.g. `42-15` → `42:15`)
- Desktop MCP: select node directly, no URL needed

### Step 2 — Fetch Design Context
```
get_design_context(fileKey=":fileKey", nodeId="42:15")
```
Returns: layout properties, typography, colors, design tokens, component variants, spacing.
If response is truncated → use `get_metadata()` first, then fetch individual child nodes.

### Step 3 — Capture Visual Reference
```
get_screenshot(fileKey=":fileKey", nodeId="42:15")
```
This screenshot is the **source of truth** for visual validation throughout implementation.
Compare against it at every step — not just at the end.

### Step 4 — Download Assets
- Retrieve images, icons, SVGs from Figma payload
- Use localhost URLs directly — do NOT import new icon packages or create placeholders
- Icons already in project's icon library → use those; don't duplicate

### Step 5 — Translate to Project Conventions
- Treat Figma output as **design representation**, not final code
- Check `code-index.md` first → does this component already exist? If yes, adapt it
- Replace Figma's raw suggestions with project's token system (Tailwind config / CSS vars / Angular Material)
- Reuse existing components; extend rather than recreate
- Respect routing, state management, data-fetch patterns from framework SKILL.md

### Step 6 — Achieve Visual Parity
- Match Figma design with pixel-accurate layout
- Use design tokens, NOT hardcoded hex/px values
- WCAG 2.1 AA: minimum 4.5:1 contrast for text, 3:1 for UI elements
- Map all Figma states to component variants/props

### Step 7 — Validate Against Figma
- Layout, typography, colors match screenshot
- Interactive states: hover, active, disabled, loading, error
- Responsive behavior at all breakpoints
- Asset rendering (images, icons sharp, not blurry)
- Accessibility: keyboard navigation, focus rings, screen reader labels

---

## Framework Token Mapping

### Figma → Tailwind CSS
```
Figma fill color     → bg-{color}-{shade} / text-{color}-{shade}
Figma spacing 16px   → p-4 / m-4 / gap-4  (Tailwind 4px base grid)
Figma radius 8px     → rounded-lg
Figma shadow medium  → shadow-md / shadow-lg
Figma font size 14px → text-sm
Figma font weight 600→ font-semibold
Figma auto-layout row→ flex flex-row items-center gap-{n}
Figma auto-layout col→ flex flex-col gap-{n}
Figma grid layout   → grid grid-cols-{n} gap-{n}
```

### Figma → CSS Variables / Design Tokens
```css
/* Map Figma token → CSS variable → usage */
--color-primary: #3b82f6;      /* Figma: "Brand/Primary" */
--color-surface: #ffffff;       /* Figma: "Surface/Default" */
--color-error: #ef4444;         /* Figma: "Semantic/Error" */
--spacing-base: 4px;            /* Figma: 4px grid */
--radius-md: 8px;               /* Figma: "Radius/Medium" */
--shadow-card: 0 4px 12px rgba(0,0,0,0.1);
```

### Figma → Angular Material Theming
```typescript
const theme = createTheme({
  primary: { main: '#3b82f6' },  // Figma: "Brand/Primary"
  error:   { main: '#ef4444' },  // Figma: "Semantic/Error"
  background: { paper: '#ffffff', default: '#f8fafc' },
});
```

### Figma → React Native StyleSheet
```typescript
const styles = StyleSheet.create({
  container: {
    padding: 16,              // Figma: 16px padding
    gap: 12,                  // Figma: 12px gap
    backgroundColor: '#fff',  // Figma: "Surface/Default"
    borderRadius: 8,          // Figma: "Radius/Medium"
  },
});
```

---

## Component Hierarchy — Atomic Design

Read Figma layer tree from bottom up:
```
Atoms        ← Basic elements: Button, Input, Icon, Badge, Avatar
Molecules    ← Composed from atoms: SearchBar (Input + Button), FormField (Label + Input + Error)
Organisms    ← Composed from molecules: Navbar, ProductCard, LoginForm
Templates    ← Layout scaffolds: PageLayout, DashboardShell, AuthLayout
Pages        ← Full screen instances of templates with real data
```

**Decision rule:**
- Layer used in 3+ places across the design → extract as reusable atom/molecule
- Layer is one-off, tightly coupled → keep inline or as local component
- Check `code-index.md` for existing atoms before creating new ones

---

## Figma Variants → Component Props

```
Figma Variant: "State=Default"   → default (no prop needed)
Figma Variant: "State=Hover"     → CSS :hover / hover: prefix (Tailwind)
Figma Variant: "State=Active"    → active: prefix / :active pseudo-class
Figma Variant: "State=Disabled"  → disabled={true} prop + opacity-50
Figma Variant: "State=Loading"   → loading={true} prop + spinner overlay
Figma Variant: "State=Error"     → error={true} prop + error color tokens
Figma Variant: "Size=Small/Medium/Large" → size prop: 'sm' | 'md' | 'lg'
Figma Variant: "Theme=Light/Dark"→ CSS class toggle / prefers-color-scheme
```

---

## Responsive Breakpoints from Figma

Infer breakpoints from Figma frame widths:
```
Frame 375px  → Mobile    → Tailwind: default (no prefix)
Frame 768px  → Tablet    → Tailwind: md: prefix
Frame 1280px → Desktop   → Tailwind: xl: prefix
Frame 1440px → Wide      → Tailwind: 2xl: prefix
```

Fluid patterns:
- Text that changes size across frames → `clamp()` or responsive Tailwind classes
- Sidebar visible on desktop, hidden on mobile → `hidden md:block`
- Grid columns change → `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`

---

## Accessibility (WCAG 2.1 AA — mandatory)

Always enforce from Figma annotations and design:
```
Text contrast  ≥ 4.5:1 for body text (≥ 3:1 for large text ≥18pt bold)
UI elements    ≥ 3:1 contrast (buttons, inputs, icons)
Focus rings    2px solid visible outline on ALL interactive elements
ARIA labels    icon-only buttons → aria-label="Action description"
Form inputs    aria-describedby pointing to error message element
Images         meaningful → alt="description"; decorative → alt=""
Touch targets  minimum 44×44px on mobile (React Native / web mobile)
```

---

## /figma Command Behaviors

```
/figma read <url>        → get_design_context(nodeId from URL) → describe findings, prepare for code gen
/figma screenshot <url>  → get_screenshot → attach as visual reference for implementation
/figma diagram           → generate_diagram in FigJam (architecture/flow visualization)
/figma new               → create_new_file → link URL to context.json["tools"]["figma"]
```

---

## Common Issues

| Issue | Solution |
|-------|---------|
| Truncated design context | `get_metadata()` first, then fetch specific child nodeIds |
| Visual mismatch after implement | Side-by-side with screenshot; check spacing, color, typography |
| Assets not loading | Use localhost MCP asset URLs directly; check MCP endpoint |
| Token conflicts | Prefer project tokens; adjust minimally for fidelity |
| Component already in codebase | Adapt existing — do NOT recreate from Figma |
| Absolute positioning in Figma | Redesign with flex/grid; use screenshot as layout reference |

---

## Design-Map Generation (during `/design --figma`)

For each task with a UI component → capture `nodeId` from Stitch MCP and write to `design-map.json`:
```json
{
  "M2-F1-T3": { "nodeId": "12:34", "name": "BookingForm", "type": "component" },
  "M2-F1-T4": { "nodeId": "12:56", "name": "SeatPicker",  "type": "component" },
  "M1-F1-T1": null
}
```
Backend/logic tasks → `null` → `/run-task` skips Figma entirely for those tasks.

## Learned Patterns
<!-- auto-learned entries appended below -->
