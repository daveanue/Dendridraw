# Dendridraw Build Tracker

Last updated: 2026-02-11
Owner: Product + Engineering

## North Star
Create a mindmap-native workflow on top of Excalidraw:
- Semantic tree is the source of truth.
- Excalidraw is the rendering/interaction engine.
- Keyboard-first flow is faster than manual shapes/arrows.

## Current Focus (Now)
1. Interaction reliability (highest priority)
- [ ] Selection sync between Excalidraw and store is always correct.
- [ ] Text edit sync is consistent for bound labels.
- [ ] Keyboard shortcuts (`Tab`, `Enter`, `Delete`, `Space`, `F2`) behave predictably.

2. Direct manipulation
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
- Build validated with increased Node memory (`--max-old-space-size=4096`).

## How We Update This File
On every meaningful change:
1. Move completed items from `Current Focus`/`Next Up` to checked.
2. Add one bullet to `Update Log` with what changed and why.
3. Update `Last updated` date.
