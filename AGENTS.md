# AGENTS.md - Mermaid Flow Editor

> Guidelines for AI agents working in this codebase.

## Project Overview

Visual Mermaid flowchart editor: Monaco Editor (left) → Live Preview (center) → Style Panel (right).

**Stack**: React 19, TypeScript 5.9, Vite 7, Tailwind CSS v4, Zustand, Monaco Editor, Mermaid 11.

## Commands

```bash
npm run dev      # Vite dev server with HMR
npm run build    # tsc -b && vite build
npm run lint     # ESLint flat config
npm run preview  # Preview production build
npm run deploy   # Build + gh-pages deploy
```

**No test framework.** If adding tests, use Vitest.

## Project Structure

```
src/
├── App.tsx                 # Root with ResizableLayout
├── main.tsx                # Entry point
├── index.css               # Tailwind imports
├── components/
│   ├── Editor.tsx          # Monaco wrapper
│   ├── Preview.tsx         # Mermaid SVG + zoom/selection
│   ├── StylePanel.tsx      # Node/edge editing
│   ├── Toolbar.tsx         # Direction, export controls
│   └── ResizableLayout.tsx # Three-panel layout
├── store/
│   └── editorStore.ts      # Zustand store (single source of truth)
└── utils/
    ├── mermaid.ts          # Init/render helpers
    └── styleParser.ts      # Parse/update style directives
```

## Code Style

### TypeScript
- **Strict mode** enabled, no unused locals/params
- Target ES2022, module resolution: `bundler`, JSX: `react-jsx`
- Use explicit types for params/returns
- `type` for aliases, `interface` for extensible shapes
- **Never**: `as any`, `@ts-ignore`, `@ts-expect-error`

### Imports
- Order: React/external → relative
- Named exports (default only for `App`)
- Use `import type` for type-only imports

```typescript
import type { NodeStyle } from '../store/editorStore'
import { useEditorStore } from '../store/editorStore'
```

### React
- Functional components only
- Hooks: `useState`, `useEffect`, `useCallback`, `useRef`
- All state via Zustand (`useEditorStore`)

### Tailwind CSS v4
- Utility classes only, no CSS modules
- Spacing: multiples of 4 (`p-4`, `gap-2`)
- Colors: `gray-*`, `blue-*`, `red-*`, `green-*`

### Naming

| Entity | Convention | Example |
|--------|------------|---------|
| Components | PascalCase | `StylePanel` |
| Hooks | `use` prefix | `useEditorStore` |
| Functions | camelCase | `extractNodeIds` |
| Types | PascalCase | `NodeStyle` |
| Constants | SCREAMING_SNAKE | `DEFAULT_CODE` |

### Error Handling
```typescript
try {
  const { svg } = await renderMermaid(code, uniqueId)
} catch (err) {
  setError(err instanceof Error ? err.message : 'Render failed')
}
```

## Key Patterns

### Zustand Store
- Single source of truth in `editorStore.ts`
- **Do**: Use store methods (`setCode`, `insertNode`, `deleteNode`)
- **Don't**: Manipulate code directly in components

### Mermaid
- Init once via `initMermaid()` (idempotent)
- Render with unique IDs: `mermaid-${Date.now()}-${key}`
- Debounce 300ms

### Preview DOM
Direct SVG manipulation for click handlers, selection highlighting, zoom. Intentional due to Mermaid's output.

## Adding Features

**New component**: `src/components/`, named export
**New util**: `src/utils/`, pure functions
**State changes**: Add methods to `editorStore.ts`

### Add node shape
1. Add to `NodeShape` type
2. Add to `shapeWrappers` in `insertNode`/`updateNodeShape`
3. Add to `NODE_SHAPES` in `StylePanel.tsx`

### Add arrow type
1. Add to `ArrowType` type
2. Update regex in `updateEdgeLabel`/`parseEdges`
3. Add to `ARROW_TYPES` in `StylePanel.tsx`

## ESLint

Flat config (`eslint.config.js`) with:
- `@eslint/js` recommended rules
- `typescript-eslint` recommended
- `eslint-plugin-react-hooks` (rules of hooks)
- `eslint-plugin-react-refresh` (Vite HMR support)

Run `npm run lint` before committing. Fix all errors.

## Verification Checklist

Before submitting changes:
1. `npm run lint` passes
2. `npm run build` succeeds (includes type-check)
3. Manual test in browser (`npm run dev`)
4. No console errors in browser devtools

## Don'ts

- `any` type
- CSS files (use Tailwind)
- Direct state mutation
- Heavy deps without discussion
- Break three-panel layout
- Inline styles (except dynamic values)
