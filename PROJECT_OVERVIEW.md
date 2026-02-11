# Dendridraw — Project Overview

> **"Excalidraw is perfect for mind maps, but it lacks structure."**
> Dendridraw solves this by adding a semantic, keyboard-driven mind mapping layer on top of Excalidraw's canvas.

## 1. Core Vision
We aren't building "another mind map tool." We are building a **thinking companion** that combines:
1.  **Semantic Structure:** A true tree model (nodes, parents, siblings) for frictionless editing.
2.  **Visual Freedom:** The hand-drawn aesthetic and infinite canvas of Excalidraw.
3.  **Hybrid Workflow:** Structured mind maps coexist with freeform sketching and annotation.

### Why This Matters (Market Wedge)
Other tools force a choice: **Structure** (XMind, MindMeister) vs. **Freedom** (Miro, Excalidraw).
Dendridraw is the **only tool** that offers high structure *and* high visual freedom in a lightweight package.

---

## 2. Technical Architecture

### The "Hybrid Canvas" Model
We do not fork Excalidraw. We treat it as a **rendering engine**.

```mermaid
graph TD
    UserInput[User Input (Keyboard/Mouse)] -->|Intercepts| SemanticLayer
    SemanticLayer[Semantic Layer (Zustand Store)] -->|Updates| TreeModel
    TreeModel[Tree Model (Source of Truth)] -->|Computes| LayoutEngine
    LayoutEngine[Layout Engine] -->|Generates| ExcalidrawElements
    ExcalidrawElements[Excalidraw Elements] -->|Sync| ExcalidrawCanvas
    ExcalidrawCanvas[Excalidraw Canvas] -->|Render| Screen
    
    subgraph "Dendridraw Core"
    SemanticLayer
    TreeModel
    LayoutEngine
    end
    
    subgraph "External Libraires"
    ExcalidrawCanvas
    end
```

1.  **Source of Truth:** A custom Zustand store manages the semantic tree (`nodes`, `relationships`, `metadata`).
2.  **Projection:** We *project* this tree into standard Excalidraw elements (rectangles, arrows, text).
3.  **Identity:** Elements are tagged with `customData: { mindmapNodeId: "..." }`.
    -   **Tagged elements** are managed by Dendridraw (locked layout, special behaviors).
    -   **Untagged elements** are managed by Excalidraw native behavior (freeform drawing).

### Tech Stack
-   **Framework:** React + Vite + TypeScript (Fast, standard)
-   **State:** Zustand (Simple, scalable store)
-   **Canvas:** `@excalidraw/excalidraw` (MIT licensed library)
-   **Layout (MVP):** Custom offset-based engine (Simple, predictable)
-   **Layout (Future):** `dagre` or `elkjs` (For complex auto-layout)
-   **Persistence:** IndexedDB via `dexie` (Local-first, fast)

---

## 3. Roadmap & Phases

### Phase 1: The Core (✅ Complete)
-   [x] Project scaffold (Vite + TS)
-   [x] Semantic tree model (CRUD)
-   [x] Basic renderer & layout
-   [x] Keyboard shortcuts (`Tab`, `Enter`, `Del`)
-   [x] Toolbar UI

### Phase 2: UX Polish & Feel (Current Focus)
-   [ ] **Selection Handling:** Sync selection properly between canvas and state.
-   [ ] **Direct Manipulation:** Drag nodes to reorder/reparent (the "magic" feeling).
-   [ ] **Text Editing:** Seamless in-place editing (F2 / double-click).
-   [ ] **Collapse/Expand:** Hide branches to manage complexity.

### Phase 3: The Information Layer
-   [ ] **Notes:** Markdown notes attached to nodes (progressive disclosure).
-   [ ] **Links:** External URL references.
-   [ ] **Visual Types:** Distinct styles for Topics, Tasks, and References.

### Phase 4: Production Ready
-   [ ] **Persistence:** Save/load from IndexedDB.
-   [ ] **Export:** Image export (PNG/SVG) and JSON.
-   [ ] **Landing Page:** Simple marketing site.

---

## 4. Key Decisions Log
| Decision | Choice | Rationale |
| :--- | :--- | :--- |
| **Canvas Strategy** | Embed Lib (Not Fork) | Maintenance, stability, community updates. |
| **State Management** | Zustand | Less boilerplate than Redux, cleaner than Context. |
| **Layout Engine** | Custom (MVP) | `dagre` is heavy; simple offset works for <50 nodes. |
| **Backend** | Local-Only (MVP) | Zero infra cost, privacy-first, fastest to ship. |
