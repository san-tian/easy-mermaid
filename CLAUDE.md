# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Visual Mermaid flowchart editor with three-panel layout: Monaco Editor (left) → Live Preview (center) → Style Panel (right).

**Stack**: React 19, TypeScript 5.9, Vite 7, Tailwind CSS v4, Zustand, Monaco Editor, Mermaid 11.

## Commands

```bash
npm run dev      # Vite dev server with HMR
npm run build    # tsc -b && vite build (includes type-check)
npm run lint     # ESLint flat config
npm run preview  # Preview production build
npm run deploy   # Build + gh-pages deploy
```

**No test framework configured.** If adding tests, use Vitest.

## Architecture

### State Management
Single Zustand store (`src/store/editorStore.ts`) is the source of truth. All code modifications go through store methods (`setCode`, `insertNode`, `deleteNode`, `updateNodeStyle`, etc.). Never manipulate Mermaid code directly in components.

### Key Types
- `NodeShape`: `'rect' | 'round' | 'stadium' | 'diamond' | 'hexagon' | 'parallelogram' | 'circle'`
- `ArrowType`: `'-->' | '--->' | '-.->' | '==>'`
- `FlowDirection`: `'LR' | 'RL' | 'TB' | 'BT'`

### Mermaid Rendering
- Initialize once via `initMermaid()` (idempotent) in `src/utils/mermaid.ts`
- Render with unique IDs: `mermaid-${Date.now()}-${key}`
- Debounce 300ms for re-renders
- Preview component does direct SVG DOM manipulation for click handlers and selection highlighting

### Adding Features

**New node shape:**
1. Add to `NodeShape` type in `editorStore.ts`
2. Add to `shapeWrappers` in `insertNode`/`updateNodeShape`
3. Add to `NODE_SHAPES` in `StylePanel.tsx`

**New arrow type:**
1. Add to `ArrowType` type in `editorStore.ts`
2. Update regex in `updateEdgeLabel`/`parseEdges`
3. Add to `ARROW_TYPES` in `StylePanel.tsx`

## Code Style

- Strict TypeScript, no `any`, no `@ts-ignore`
- Functional components only, all state via Zustand
- Tailwind utility classes only, no CSS modules or inline styles (except dynamic values)
- Import order: React/external → relative; use `import type` for type-only imports
- Naming: PascalCase components/types, camelCase functions, `use` prefix for hooks

## Verification

Before submitting:
1. `npm run lint` passes
2. `npm run build` succeeds
3. Manual test in browser (`npm run dev`)
