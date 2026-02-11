# Dendridraw

> **"Excalidraw is perfect for mind maps, but it lacks structure."**
> A semantic, keyboard-driven mind mapping layer built on top of Excalidraw.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run the dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to start mapping.

## ✨ Core Features (MVP)
-   **Semantic Structure:** True parent/child relationships (managed via Zustand).
-   **Hybrid Canvas:** Structured mind maps coexist with freeform Excalidraw drawings.
-   **Keyboard First:**
    -   `Tab`: Create child node
    -   `Enter`: Create sibling node
    -   `Del`: Delete node (and subtree)
    -   `Arrows`: Navigate (Coming soon)
-   **Auto-Layout:** Nodes are automatically positioned based on the tree structure.

## 🛠 Tech Stack
-   **Core:** React, TypeScript, Vite
-   **State:** Zustand (Tree model source of truth)
-   **Canvas:** `@excalidraw/excalidraw` (Renderer)
-   **Layout:** Custom offset-based engine

## 📂 Project Structure
-   `src/store` - Zustand store for the semantic tree (`mindmapStore.ts`)
-   `src/engine` - Layout and rendering logic (`layout.ts`, `renderer.ts`)
-   `src/components` - UI components (`Canvas.tsx`, `Toolbar.tsx`)
-   `src/types` - Core type definitions

## 📖 Learn More
See [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md) for the full vision, architecture diagrams, and roadmap.
