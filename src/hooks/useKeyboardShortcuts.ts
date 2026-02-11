/**
 * Keyboard shortcuts hook for mindmap operations.
 *
 * Tab   → create child of selected node
 * Enter → create sibling of selected node
 * Delete/Backspace → soft-delete selected node
 * Space → toggle collapse
 * Escape → deselect
 * F2    → start editing label (triggers Excalidraw text edit)
 *
 * Shortcuts are only active when not editing text inside Excalidraw.
 */
import { useEffect, useCallback, useRef } from 'react';
import { useMindmapStore } from '../store/mindmapStore';

/** Ref to track whether inline editing is active. */
let isEditing = false;

export function setEditingState(editing: boolean): void {
    isEditing = editing;
}

export function useKeyboardShortcuts(
    onStartEdit: (nodeId: string) => void,
): void {
    const addChild = useMindmapStore((s) => s.addChild);
    const addSibling = useMindmapStore((s) => s.addSibling);
    const deleteNode = useMindmapStore((s) => s.deleteNode);
    const toggleCollapse = useMindmapStore((s) => s.toggleCollapse);
    const selectNode = useMindmapStore((s) => s.selectNode);

    const getSelectedNodeId = useCallback(
        () => useMindmapStore.getState().selectedNodeId,
        [],
    );

    // Use a ref to hold onStartEdit to avoid re-binding on every render
    const onStartEditRef = useRef(onStartEdit);
    onStartEditRef.current = onStartEdit;

    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent): void {
            // Don't intercept when user is typing in an input/textarea or editing
            if (isEditing) return;
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;

            const selectedId = getSelectedNodeId();
            if (!selectedId) return;

            switch (e.key) {
                case 'Tab': {
                    e.preventDefault();
                    e.stopPropagation();
                    const newId = addChild(selectedId);
                    // Trigger edit mode on the new node
                    requestAnimationFrame(() => onStartEditRef.current(newId));
                    break;
                }
                case 'Enter': {
                    e.preventDefault();
                    e.stopPropagation();
                    const newId = addSibling(selectedId);
                    requestAnimationFrame(() => onStartEditRef.current(newId));
                    break;
                }
                case 'Delete':
                case 'Backspace': {
                    e.preventDefault();
                    e.stopPropagation();
                    deleteNode(selectedId);
                    break;
                }
                case ' ': {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleCollapse(selectedId);
                    break;
                }
                case 'Escape': {
                    e.preventDefault();
                    selectNode(null);
                    break;
                }
                case 'F2': {
                    e.preventDefault();
                    onStartEditRef.current(selectedId);
                    break;
                }
                default:
                    break;
            }
        }

        window.addEventListener('keydown', handleKeyDown, { capture: true });
        return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
    }, [addChild, addSibling, deleteNode, toggleCollapse, selectNode, getSelectedNodeId]);
}
