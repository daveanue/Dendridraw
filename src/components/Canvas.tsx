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

function normalizeLabelForStore(text: string): string {
    return text.trim().length === 0 ? '' : text;
}

export default function Canvas() {
    const [api, setApiState] = useState<ExcalidrawImperativeAPI | null>(null);
    const isInitialRender = useRef(true);
    const latestSceneElementsRef = useRef<readonly ExcalidrawElement[]>([]);
    const suppressOnChangeRef = useRef(false);
    const shortcutScopeRef = useRef<HTMLDivElement | null>(null);
    const [mindmapModeEnabled, setMindmapModeEnabled] = useState(false);

    const setApi = useCallback((nextApi: ExcalidrawImperativeAPI) => {
        setApiState((currentApi) => (currentApi === nextApi ? currentApi : nextApi));
    }, []);

    // Subscribe to store slices
    const rootId = useMindmapStore((s) => s.rootId);
    const nodes = useMindmapStore((s) => s.nodes);
    const selectedNodeId = useMindmapStore((s) => s.selectedNodeId);
    const addChild = useMindmapStore((s) => s.addChild);
    const selectNode = useMindmapStore((s) => s.selectNode);
    const updateLabel = useMindmapStore((s) => s.updateLabel);

    // Compute layout → element descriptors → Excalidraw elements
    const layout = useMemo(() => computeLayout(rootId, nodes), [rootId, nodes]);
    const descriptors = useMemo(
        () => buildElementDescriptors(rootId, nodes, layout),
        [rootId, nodes, layout],
    );
    const elements = useMemo(
        // Preserve semantic IDs so store<->scene selection/edit mapping stays stable.
        () => convertToExcalidrawElements(descriptors, { regenerateIds: false }),
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

    // Push projected elements to Excalidraw, preserving semantic selection.
    useEffect(() => {
        if (!api) return;
        const mergedElements = mergeWithUnmanagedElements(elements);
        const currentSelection = api.getAppState().selectedElementIds || {};
        const targetSelection: SelectionMap =
            selectedNodeId && projectedShapeIds.has(selectedNodeId)
                ? { [`shape-${selectedNodeId}`]: true }
                : {};
        const shouldSyncSelection = !areSelectionMapsEqual(currentSelection, targetSelection);

        // Derived scene updates should not pollute undo/redo history.
        suppressOnChangeRef.current = true;
        api.updateScene({
            elements: mergedElements,
            appState: shouldSyncSelection ? { selectedElementIds: targetSelection } : undefined,
            captureUpdate: CaptureUpdateAction.NEVER,
        });
        requestAnimationFrame(() => {
            suppressOnChangeRef.current = false;
        });

        // Scroll to content on initial render
        if (isInitialRender.current) {
            isInitialRender.current = false;
            requestAnimationFrame(() => {
                api.scrollToContent(elements, { fitToContent: true, animate: true });
            });
        }
    }, [
        api,
        elements,
        mergeWithUnmanagedElements,
        selectedNodeId,
        projectedShapeIds,
        areSelectionMapsEqual,
    ]);

    // Handle onChange from Excalidraw — detect node selection and label edits
    const handleChange = useCallback(
        (sceneElements: readonly OrderedExcalidrawElement[], appState: AppState) => {
            latestSceneElementsRef.current = sceneElements;
            setEditingState(Boolean(appState?.editingTextElement));
            if (suppressOnChangeRef.current) return;

            const byId = new Map<string, ExcalidrawElement>();
            for (const element of sceneElements) {
                byId.set(element.id, element);
            }

            if (appState?.editingTextElement) return;

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
                const normalizedLabel = normalizeLabelForStore(element.text);
                if (currentNode && normalizedLabel !== currentNode.label) {
                    updateLabel(nodeId, normalizedLabel);
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

        suppressOnChangeRef.current = true;
        api.updateScene({
            appState: {
                selectedElementIds: { [shapeId]: true },
                editingTextElement: labelElement as AppState['editingTextElement'],
            },
            captureUpdate: CaptureUpdateAction.NEVER,
        });
        requestAnimationFrame(() => {
            suppressOnChangeRef.current = false;
        });
    }, [api]);

    const scheduleStartEdit = useCallback((nodeId: string) => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                handleStartEdit(nodeId);
            });
        });
    }, [handleStartEdit]);

    const createChildAndStartEdit = useCallback((parentNodeId: string) => {
        // Defer store updates to avoid state updates during Excalidraw render transitions.
        requestAnimationFrame(() => {
            const newNodeId = addChild(parentNodeId);
            scheduleStartEdit(newNodeId);
        });
    }, [addChild, scheduleStartEdit]);

    const isInteractiveTarget = useCallback((target: EventTarget | null): boolean => {
        if (!(target instanceof HTMLElement)) return false;
        return Boolean(
            target.closest(
                'input, textarea, select, button, a, [contenteditable=""], [contenteditable="true"], [role="textbox"]',
            ),
        );
    }, []);

    const resolveNodeIdFromHitElement = useCallback((element: ExcalidrawElement | null): string | null => {
        if (!element) return null;

        let resolved: ExcalidrawElement | undefined = element;
        if (resolved.type === 'text' && resolved.containerId && api) {
            const containerId = resolved.containerId;
            const container = api.getSceneElements().find(
                (sceneElement) => sceneElement.id === containerId,
            );
            if (container) resolved = container;
        }

        if (!isManagedElement(resolved)) return null;
        return resolved.customData.mindmapNodeId;
    }, [api]);

    const resolveSelectedManagedNodeIdFromApi = useCallback((): string | null => {
        if (!api) return null;
        const selectedIds = Object.keys(api.getAppState().selectedElementIds || {});
        if (selectedIds.length === 0) return null;
        const byId = new Map<string, ExcalidrawElement>();
        for (const sceneElement of api.getSceneElements()) {
            byId.set(sceneElement.id, sceneElement);
        }
        return resolveSelectedManagedNodeId(selectedIds, byId);
    }, [api]);

    useEffect(() => {
        if (!api || !mindmapModeEnabled) return;

        const unsubscribe = api.onPointerUp((activeTool, pointerDownState, event) => {
            if (activeTool.type !== 'selection') return;
            if (pointerDownState.drag.hasOccurred) return;
            if (event.button !== 0) return;
            if (isInteractiveTarget(event.target)) return;
            if (api.getAppState().editingTextElement) return;
            // Keep default Excalidraw behavior on single-click.
            // Mindmap node creation is explicit (+ Node) or double-click.
            if (event.detail < 2) return;

            const hitNodeId = resolveNodeIdFromHitElement(
                pointerDownState.hit.element as ExcalidrawElement | null,
            );
            const state = useMindmapStore.getState();
            const currentSelectedNodeId = resolveSelectedManagedNodeIdFromApi() || state.selectedNodeId;

            const parentNodeId = hitNodeId || currentSelectedNodeId || state.rootId;
            if (!parentNodeId) return;

            createChildAndStartEdit(parentNodeId);
        });

        return unsubscribe;
    }, [
        api,
        mindmapModeEnabled,
        createChildAndStartEdit,
        isInteractiveTarget,
        resolveNodeIdFromHitElement,
        resolveSelectedManagedNodeIdFromApi,
    ]);

    const toggleMindmapMode = useCallback(() => {
        setMindmapModeEnabled((enabled) => {
            const next = !enabled;
            if (next && api) {
                api.setActiveTool({ type: 'selection' });
            }
            return next;
        });
    }, [api]);

    const handleQuickAddNode = useCallback(() => {
        const state = useMindmapStore.getState();
        const parentNodeId = resolveSelectedManagedNodeIdFromApi() || state.selectedNodeId || state.rootId;
        if (!parentNodeId) return;
        createChildAndStartEdit(parentNodeId);
    }, [createChildAndStartEdit, resolveSelectedManagedNodeIdFromApi]);

    // Register keyboard shortcuts
    useKeyboardShortcuts(handleStartEdit, shortcutScopeRef);

    return (
        <div
            ref={shortcutScopeRef}
            tabIndex={0}
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
                renderTopRightUI={() => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'auto' }}>
                        <button
                            type="button"
                            onClick={toggleMindmapMode}
                            style={{
                                height: 32,
                                borderRadius: 8,
                                border: mindmapModeEnabled ? '1px solid #40c057' : '1px solid #495057',
                                background: mindmapModeEnabled ? '#2b8a3e' : '#343a40',
                                color: '#f8f9fa',
                                fontSize: 12,
                                fontWeight: 600,
                                padding: '0 12px',
                                cursor: 'pointer',
                            }}
                        >
                            {mindmapModeEnabled ? 'Mindmap: On' : 'Mindmap: Off'}
                        </button>
                        <button
                            type="button"
                            onClick={handleQuickAddNode}
                            disabled={!mindmapModeEnabled}
                            style={{
                                height: 32,
                                borderRadius: 8,
                                border: '1px solid #495057',
                                background: mindmapModeEnabled ? '#364fc7' : '#495057',
                                color: '#f8f9fa',
                                fontSize: 12,
                                fontWeight: 600,
                                padding: '0 12px',
                                cursor: mindmapModeEnabled ? 'pointer' : 'not-allowed',
                                opacity: mindmapModeEnabled ? 1 : 0.7,
                            }}
                        >
                            + Node
                        </button>
                    </div>
                )}
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
