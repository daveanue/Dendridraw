/**
 * Canvas component — wraps Excalidraw and wires it to the semantic layer.
 *
 * Responsibilities:
 * - Renders Excalidraw with elements derived from the tree model
 * - Detects clicks on elements → maps to semantic node selection
 * - Syncs label edits back to the store
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    CaptureUpdateAction,
    Excalidraw,
    convertToExcalidrawElements,
} from '@excalidraw/excalidraw';
import { useMindmapStore } from '../store/mindmapStore';
import { computeLayout } from '../engine/layout';
import { buildElementDescriptors } from '../engine/renderer';
import { setEditingState, useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import type { AppState, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement, OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import {
    isManagedElement,
    resolveLabelNodeId,
    resolveSelectedManagedNodeId,
} from './canvasSync';

type SelectionMap = Record<string, true>;

export default function Canvas() {
    const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
    const isInitialRender = useRef(true);
    const latestSceneElementsRef = useRef<readonly ExcalidrawElement[]>([]);
    const shortcutScopeRef = useRef<HTMLDivElement | null>(null);

    // Subscribe to store slices
    const rootId = useMindmapStore((s) => s.rootId);
    const nodes = useMindmapStore((s) => s.nodes);
    const selectedNodeId = useMindmapStore((s) => s.selectedNodeId);
    const selectNode = useMindmapStore((s) => s.selectNode);
    const updateLabel = useMindmapStore((s) => s.updateLabel);

    // Compute layout → element descriptors → Excalidraw elements
    const layout = useMemo(() => computeLayout(rootId, nodes), [rootId, nodes]);
    const descriptors = useMemo(
        () => buildElementDescriptors(rootId, nodes, layout),
        [rootId, nodes, layout],
    );
    const elements = useMemo(
        () => convertToExcalidrawElements(descriptors),
        [descriptors],
    );
    const managedShapeIds = useMemo(() => {
        const ids = new Set<string>();
        for (const element of elements) {
            if (isManagedElement(element) && element.customData.role === 'shape') {
                ids.add(element.id);
            }
        }
        return ids;
    }, [elements]);

    const projectedShapeIds = useMemo(() => {
        const ids = new Set<string>();
        for (const element of elements) {
            if (isManagedElement(element) && element.customData.role === 'shape') {
                ids.add(element.customData.mindmapNodeId);
            }
        }
        return ids;
    }, [elements]);

    const isManagedSceneElement = useCallback(
        (element: ExcalidrawElement): boolean => {
            if (isManagedElement(element)) return true;
            return Boolean(
                element.type === 'text' &&
                element.containerId &&
                managedShapeIds.has(element.containerId),
            );
        },
        [managedShapeIds],
    );

    const mergeWithUnmanagedElements = useCallback(
        (managedElements: readonly ExcalidrawElement[]): ExcalidrawElement[] => {
            const unmanagedElements = latestSceneElementsRef.current.filter(
                (element) => !isManagedSceneElement(element),
            );
            return [...unmanagedElements, ...managedElements];
        },
        [isManagedSceneElement],
    );

    const areSelectionMapsEqual = useCallback(
        (a: Readonly<Record<string, true>>, b: Readonly<Record<string, true>>): boolean => {
            const aKeys = Object.keys(a);
            const bKeys = Object.keys(b);
            if (aKeys.length !== bKeys.length) return false;
            for (const key of aKeys) {
                if (!b[key]) return false;
            }
            return true;
        },
        [],
    );

    // Push elements to Excalidraw when they change
    useEffect(() => {
        if (!api) return;
        const mergedElements = mergeWithUnmanagedElements(elements);

        // Derived scene updates should not pollute undo/redo history.
        api.updateScene({
            elements: mergedElements,
            captureUpdate: CaptureUpdateAction.NEVER,
        });

        // Scroll to content on initial render
        if (isInitialRender.current) {
            isInitialRender.current = false;
            requestAnimationFrame(() => {
                api.scrollToContent(elements, { fitToContent: true, animate: true });
            });
        }
    }, [api, elements, mergeWithUnmanagedElements]);

    // Sync store node selection back to Excalidraw selection.
    useEffect(() => {
        if (!api || !selectedNodeId || !projectedShapeIds.has(selectedNodeId)) return;
        const shapeId = `shape-${selectedNodeId}`;
        const targetSelection: SelectionMap = { [shapeId]: true };
        const currentSelection = api.getAppState().selectedElementIds || {};
        if (areSelectionMapsEqual(currentSelection, targetSelection)) return;
        api.updateScene({
            appState: { selectedElementIds: targetSelection },
            captureUpdate: CaptureUpdateAction.NEVER,
        });
    }, [api, selectedNodeId, projectedShapeIds, areSelectionMapsEqual]);

    // Handle onChange from Excalidraw — detect node selection and label edits
    const handleChange = useCallback(
        (sceneElements: readonly OrderedExcalidrawElement[], appState: AppState) => {
            latestSceneElementsRef.current = sceneElements;
            setEditingState(Boolean(appState?.editingTextElement));

            const byId = new Map<string, ExcalidrawElement>();
            for (const element of sceneElements) {
                byId.set(element.id, element);
            }

            // --- Selection detection ---
            const selectedIds = Object.keys(appState?.selectedElementIds || {});
            if (selectedIds.length > 0) {
                const selectedManagedNodeId = resolveSelectedManagedNodeId(selectedIds, byId);
                const currentSelected = useMindmapStore.getState().selectedNodeId;
                if (selectedManagedNodeId) {
                    if (currentSelected !== selectedManagedNodeId) {
                        selectNode(selectedManagedNodeId);
                    }
                } else if (currentSelected !== null) {
                    selectNode(null);
                }
            } else if (useMindmapStore.getState().selectedNodeId !== null) {
                selectNode(null);
            }

            // --- Label sync ---
            for (const element of sceneElements) {
                if (element.type !== 'text' || typeof element.text !== 'string') continue;
                const nodeId = resolveLabelNodeId(element, byId);
                if (!nodeId) continue;
                const currentNode = useMindmapStore.getState().nodes[nodeId];
                if (currentNode && element.text !== currentNode.label) {
                    updateLabel(nodeId, element.text);
                }
            }
        },
        [selectNode, updateLabel],
    );

    // Handle label edit start (for keyboard shortcut)
    const handleStartEdit = useCallback((nodeId: string) => {
        if (!api) return;

        const shapeId = `shape-${nodeId}`;
        const sceneElements = api.getSceneElements();
        const labelElement = sceneElements.find(
            (element) => element.type === 'text' && element.containerId === shapeId,
        );
        if (!labelElement) return;

        api.updateScene({
            appState: {
                selectedElementIds: { [shapeId]: true },
                editingTextElement: labelElement as AppState['editingTextElement'],
            },
            captureUpdate: CaptureUpdateAction.NEVER,
        });
    }, [api]);

    const handleScopePointerDownCapture = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (
            target.closest(
                'input, textarea, select, button, a, [contenteditable=""], [contenteditable="true"], [role="textbox"]',
            )
        ) {
            return;
        }
        event.currentTarget.focus({ preventScroll: true });
    }, []);

    // Register keyboard shortcuts
    useKeyboardShortcuts(handleStartEdit, shortcutScopeRef);

    return (
        <div
            ref={shortcutScopeRef}
            tabIndex={0}
            onPointerDownCapture={handleScopePointerDownCapture}
            style={{ width: '100%', height: '100%' }}
        >
            <Excalidraw
                excalidrawAPI={setApi}
                initialData={{
                    elements: [],
                    appState: {
                        theme: 'dark' as const,
                        viewBackgroundColor: '#1a1a2e',
                    },
                }}
                onChange={handleChange}
                UIOptions={{
                    canvasActions: {
                        clearCanvas: false,
                        loadScene: false,
                    },
                }}
            />
        </div>
    );
}
