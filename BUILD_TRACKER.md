# Dendridraw Build Tracker

Last updated: 2026-02-12
Owner: Product + Engineering

## North Star
Create a mindmap-native workflow on top of Excalidraw:
- Semantic tree is the source of truth.
- Excalidraw is the rendering/interaction engine.
- Keyboard-first flow is faster than manual shapes/arrows.

## Current Focus (Now)
1. Interaction reliability (highest priority)
- [x] Selection sync between Excalidraw and store is always correct (for managed/unmanaged flows currently covered by tests).
- [x] Text edit sync is consistent for bound labels.
- [x] Keyboard shortcuts (`Tab`, `Enter`, `Delete`, `Space`, `F2`) behave predictably.
- [x] Deleting a managed node removes both the shape and its bound label text (no orphan text elements).

2. Mindmap tree element model
- [x] `Create mindmap tree` is integrated in the Excalidraw toolbar (shape tools area).
- [x] Tree creation is explicit (no auto-root creation on refresh).
- [x] Multiple independent trees can coexist on the same canvas (forest model).
- [ ] Add tree-level controls (select/delete/relabel entire tree as one element).

3. Direct manipulation
- [ ] Drag to reorder siblings.
- [ ] Drag to reparent to another node.
- [ ] Clear drop-target feedback while dragging.

## Next Up
1. Information layer
- [ ] Node notes (markdown).
- [ ] External links per node.
- [ ] Node type presets (topic/task/reference) with consistent visual style.

2. Persistence and export
- [ ] IndexedDB save/load.
- [ ] Export/import JSON.
- [ ] Export PNG/SVG.

## Later
1. Obsidian fit
- [ ] Clean import/export path for Obsidian Excalidraw workflows.
- [ ] Node metadata mapping to markdown-friendly format.

2. Scale
- [ ] Collapse/expand performance for larger maps.
- [ ] Evaluate `dagre`/`elkjs` for complex layout cases.

## Definition of Done (per feature)
- [ ] Works with keyboard and mouse.
- [ ] No canvas/store desync.
- [ ] Undo/redo behavior is intentional.
- [ ] Lint + typecheck + build pass.
- [ ] Documented in `README.md` or this tracker.

## Update Log
### 2026-02-11
- Migrated from single-root state to a multi-root forest model:
  - Replaced `rootId` with `rootIds` in semantic state.
  - `initRoot()` now creates a new independent tree instead of replacing prior trees.
  - Updated delete/restore semantics for root membership.
- Updated layout/renderer to project multiple roots in one scene:
  - `computeLayout()` now lays out all roots.
  - `buildElementDescriptors()` now renders all root trees.
  - Added layout tests for multi-root behavior and manual position overrides.
- Aligned UX with Excalidraw-first behavior:
  - Removed auto-root creation on refresh.
  - Restored stock Excalidraw look while preserving full-height canvas behavior without `index.css`.
  - Integrated `Create mindmap tree` into the Excalidraw toolbar flow.
- Fixed managed delete cleanup:
  - Removed orphan bound text when deleting managed nodes by hardening managed-element merge filtering.
- Hardened typing during the root model transition:
  - Added compatibility-safe `rootId`/`rootIds` normalization in layout/renderer helpers to prevent transient TS mismatches.
- Fixed scene sync behavior to rely more on Excalidraw primitives:
  - `CaptureUpdateAction.NEVER` for projected scene updates.
  - Better selection mapping for bound text/container elements.
  - Better label sync path for managed text/container bindings.
- Improved interaction reliability for node creation/editing and hybrid-canvas behavior:
  - Added store -> Excalidraw selection sync for managed node shapes.
  - Hardened Excalidraw -> store sync to clear semantic selection when unmanaged-only elements are selected.
  - Implemented keyboard edit-start path (`Tab`/`Enter`/`F2`) by selecting the node container and entering bound-text editing.
  - Preserved unmanaged Excalidraw elements during managed scene projection to avoid overwriting freeform canvas content.
  - Allowed empty managed labels during sync (removed trim guard) so clearing label text is consistent.
- Added focused reliability test coverage and extracted sync policies:
  - Added keyboard shortcut policy tests for edit-mode gating, modifier/editable-target guards, and key mapping behavior.
  - Added canvas sync tests for managed selection mapping and label->node resolution (including bound text containers).
  - Refactored shortcut/canvas sync decision logic into pure helpers to keep behavior deterministic and testable.
- Scoped keyboard shortcuts to the canvas interaction context (removed global shortcut interception risk with Excalidraw UI/settings).
- Build validated with increased Node memory (`--max-old-space-size=4096`).

## How We Update This File
On every meaningful change:
1. Move completed items from `Current Focus`/`Next Up` to checked.
2. Add one bullet to `Update Log` with what changed and why.
3. Update `Last updated` date.
