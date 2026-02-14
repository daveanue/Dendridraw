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
import { useEffect, useCallback, useRef, type RefObject } from 'react';
import { useMindmapStore } from '../store/mindmapStore';
import { getMindmapShortcutAction } from './shortcutPolicy';

/** Ref to track whether inline editing is active. */
let isEditing = false;

export function setEditingState(editing: boolean): void {
    isEditing = editing;
}

export function useKeyboardShortcuts(
    onStartEdit: (nodeId: string) => void,
    scopeRef: RefObject<HTMLElement | null>,
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
    useEffect(() => {
        onStartEditRef.current = onStartEdit;
    }, [onStartEdit]);

    useEffect(() => {
        const scopeElement = scopeRef.current;
        if (!scopeElement) return;

        function isEditableTarget(target: EventTarget | null): boolean {
            if (!(target instanceof HTMLElement)) return false;
            return Boolean(
                target.closest(
                    'input, textarea, select, button, a, [contenteditable=""], [contenteditable="true"], [role="textbox"]',
                ),
            );
        }

        function handleKeyDown(e: KeyboardEvent): void {
            const selectedId = getSelectedNodeId();
            const action = getMindmapShortcutAction({
                key: e.key,
                hasSelection: Boolean(selectedId),
                isEditing,
                hasModifier: e.ctrlKey || e.metaKey || e.altKey,
                isEditableTarget: isEditableTarget(e.target),
            });
            if (!action) return;

            e.preventDefault();
            e.stopPropagation();

            switch (action) {
                case 'addChild': {
                    const newId = addChild(selectedId!);
                    requestAnimationFrame(() => onStartEditRef.current(newId));
                    return;
                }
                case 'addSibling': {
                    const newId = addSibling(selectedId!);
                    requestAnimationFrame(() => onStartEditRef.current(newId));
                    return;
                }
                case 'deleteNode':
                    deleteNode(selectedId!);
                    return;
                case 'toggleCollapse':
                    toggleCollapse(selectedId!);
                    return;
                case 'deselect':
                    selectNode(null);
                    return;
                case 'startEdit':
                    onStartEditRef.current(selectedId!);
                    return;
            }
        }

        scopeElement.addEventListener('keydown', handleKeyDown, { capture: true });
        return () => {
            scopeElement.removeEventListener('keydown', handleKeyDown, { capture: true });
        };
    }, [addChild, addSibling, deleteNode, toggleCollapse, selectNode, getSelectedNodeId, scopeRef]);
}
