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

### State Ownership Contract (Current Implementation)
This is the practical contract implemented in code today:

1.  **`mindmapStore` owns semantic state**  
    It stores tree structure and node metadata (`rootIds`, `nodes`, `selectedNodeId`, etc.).
2.  **`Canvas` projects semantic state into Excalidraw**  
    Managed elements are generated from the store (`shape-*`, `arrow-*`, `label-*`, with `customData` links).
3.  **Only managed element changes sync back to the store**  
    We mirror these Excalidraw actions into `mindmapStore`:
    - node delete (managed shapes)
    - selection changes (managed nodes)
    - label edits (managed labels/text)
    - manual node moves (managed shapes -> `position`)
4.  **Unmanaged Excalidraw content is not tracked in `mindmapStore`**  
    Freeform shapes/text remain Excalidraw-owned. We preserve them during managed scene updates by merging unmanaged elements back into the scene.
5.  **History is native-first**  
    Undo/redo should be owned by Excalidraw for canvas interactions. The semantic store mirrors managed scene changes (including history-driven add/remove) instead of running a separate undo stack.
6.  **Persistence implication**  
    Without a dedicated Excalidraw scene persistence layer, unmanaged elements are runtime-only from the app's perspective.

### Current Model Snapshot (As Of February 13, 2026)
What we currently have is a **hybrid semantic-projection model with native interaction patches**:

1.  **Semantic-first structure**  
    Parent/child relationships, node type, collapse state, and soft-delete/restore live in Zustand.
2.  **Projected managed nodes**  
    Mindmap nodes/connectors are regenerated from semantic state, but IDs/customData stay stable.
3.  **Native connector behavior during interaction**  
    Existing managed arrows preserve Excalidraw-owned geometry so anchor/routing behavior feels native while dragging.
4.  **Native undo/redo ownership**  
    Keyboard/UI undo is Excalidraw-native; semantic state reconciles on managed remove/re-add events.
5.  **Position mirroring still exists**  
    We still persist dragged managed-node positions in semantic state to prevent projection resets after structural edits.

### Gap To Target (Miro-Like Mindmap)
Not yet implemented:

1.  **Subtree drag orchestration**  
    Dragging a parent does not yet move the entire semantic subtree as one operation.
2.  **Adaptive spacing/reflow on drop**  
    No local collision-aware re-layout pass yet (branch-level spacing adjustment).
3.  **Scene-first geometry ownership**  
    We still depend on semantic projection for managed geometry, rather than Excalidraw-scene-first geometry.

Code anchors:
- `src/store/mindmapStore.ts`
- `src/components/Canvas.tsx`
- `src/components/canvasSync.ts`
- `src/types/mindmap.ts`

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
