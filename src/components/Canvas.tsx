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
    hasManagedElementId,
    isManagedElement,
    resolveManagedShapeNodeId,
    resolveLabelNodeId,
    resolveSelectedManagedNodeId,
} from './canvasSync';

type SelectionMap = Record<string, true>;
const POSITION_EPSILON = 0.5;
const ADD_NODE_TOOL_ATTR = 'data-dendridraw-add-node-tool';
const ADD_NODE_BUTTON_SCENE_OFFSET = 18;
const ADD_NODE_BUTTON_SIZE = 24;
const RECT_EPSILON = 0.5;

type ViewportTransform = {
    scrollX: number;
    scrollY: number;
    zoomValue: number;
    offsetLeft: number;
    offsetTop: number;
};

type AddNodeButton = {
    key: string;
    nodeId: string;
    x: number;
    y: number;
    title: string;
};

type ScopeRect = {
    left: number;
    top: number;
    width: number;
    height: number;
};

function toViewportTransform(appState: AppState): ViewportTransform {
    return {
        scrollX: appState.scrollX,
        scrollY: appState.scrollY,
        zoomValue: appState.zoom.value,
        offsetLeft: appState.offsetLeft,
        offsetTop: appState.offsetTop,
    };
}

function normalizeLabelForStore(text: string): string {
    return text.trim().length === 0 ? '' : text;
}

function toScopeRect(rect: DOMRect): ScopeRect {
    return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
    };
}

function areViewportTransformsEqual(a: ViewportTransform, b: ViewportTransform): boolean {
    return (
        Math.abs(a.scrollX - b.scrollX) <= POSITION_EPSILON &&
        Math.abs(a.scrollY - b.scrollY) <= POSITION_EPSILON &&
        Math.abs(a.zoomValue - b.zoomValue) <= Number.EPSILON &&
        Math.abs(a.offsetLeft - b.offsetLeft) <= POSITION_EPSILON &&
        Math.abs(a.offsetTop - b.offsetTop) <= POSITION_EPSILON
    );
}

export default function Canvas() {
    const [api, setApiState] = useState<ExcalidrawImperativeAPI | null>(null);
    const [viewportTransform, setViewportTransform] = useState<ViewportTransform | null>(null);
    const [scopeRect, setScopeRect] = useState<ScopeRect | null>(null);
    const isInitialRender = useRef(true);
    const latestSceneElementsRef = useRef<readonly ExcalidrawElement[]>([]);
    const suppressOnChangeRef = useRef(false);
    const shortcutScopeRef = useRef<HTMLDivElement | null>(null);
    const knownManagedShapeIdsRef = useRef<Set<string>>(new Set());

    const updateViewportTransform = useCallback((appState: AppState) => {
        const next = toViewportTransform(appState);
        setViewportTransform((current) => {
            if (current && areViewportTransformsEqual(current, next)) {
                return current;
            }
            return next;
        });
    }, []);

    const setApi = useCallback((nextApi: ExcalidrawImperativeAPI) => {
        setApiState((currentApi) => (currentApi === nextApi ? currentApi : nextApi));
        const nextTransform = toViewportTransform(nextApi.getAppState());
        setViewportTransform((current) => (
            current && areViewportTransformsEqual(current, nextTransform)
                ? current
                : nextTransform
        ));
    }, []);

    // Subscribe to store slices
    const rootIds = useMindmapStore((s) => s.rootIds);
    const nodes = useMindmapStore((s) => s.nodes);
    const selectedNodeId = useMindmapStore((s) => s.selectedNodeId);
    const initRoot = useMindmapStore((s) => s.initRoot);
    const addChild = useMindmapStore((s) => s.addChild);
    const deleteNode = useMindmapStore((s) => s.deleteNode);
    const selectNode = useMindmapStore((s) => s.selectNode);
    const updateLabel = useMindmapStore((s) => s.updateLabel);
    const setNodePosition = useMindmapStore((s) => s.setNodePosition);

    // Compute layout → element descriptors → Excalidraw elements
    const layout = useMemo(() => computeLayout(rootIds, nodes), [rootIds, nodes]);
    const descriptors = useMemo(
        () => buildElementDescriptors(rootIds, nodes, layout),
        [rootIds, nodes, layout],
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

    useEffect(() => {
        for (const shapeId of managedShapeIds) {
            knownManagedShapeIdsRef.current.add(shapeId);
        }
    }, [managedShapeIds]);

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
            if (hasManagedElementId(element.id)) return true;

            const maybeBoundElement = element as ExcalidrawElement & {
                startBinding?: { elementId: string } | null;
                endBinding?: { elementId: string } | null;
            };
            if (
                hasManagedElementId(maybeBoundElement.startBinding?.elementId) ||
                hasManagedElementId(maybeBoundElement.endBinding?.elementId)
            ) {
                return true;
            }

            return Boolean(
                element.type === 'text' &&
                element.containerId &&
                (
                    managedShapeIds.has(element.containerId) ||
                    knownManagedShapeIdsRef.current.has(element.containerId) ||
                    hasManagedElementId(element.containerId)
                ),
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

    useEffect(() => {
        const scopeElement = shortcutScopeRef.current;
        if (!scopeElement) return;

        const syncScopeRect = () => {
            const nextRect = toScopeRect(scopeElement.getBoundingClientRect());
            setScopeRect((currentRect) => {
                if (
                    currentRect &&
                    Math.abs(currentRect.left - nextRect.left) <= RECT_EPSILON &&
                    Math.abs(currentRect.top - nextRect.top) <= RECT_EPSILON &&
                    Math.abs(currentRect.width - nextRect.width) <= RECT_EPSILON &&
                    Math.abs(currentRect.height - nextRect.height) <= RECT_EPSILON
                ) {
                    return currentRect;
                }
                return nextRect;
            });
        };

        syncScopeRect();
        const observer = new ResizeObserver(syncScopeRect);
        observer.observe(scopeElement);
        window.addEventListener('scroll', syncScopeRect, { passive: true });
        window.addEventListener('resize', syncScopeRect);

        return () => {
            observer.disconnect();
            window.removeEventListener('scroll', syncScopeRect);
            window.removeEventListener('resize', syncScopeRect);
        };
    }, [api]);

    // Handle onChange from Excalidraw — detect node selection and label edits
    const handleChange = useCallback(
        (sceneElements: readonly OrderedExcalidrawElement[], appState: AppState) => {
            const previousSceneElements = latestSceneElementsRef.current;
            latestSceneElementsRef.current = sceneElements;
            setEditingState(Boolean(appState?.editingTextElement));
            updateViewportTransform(appState);
            if (suppressOnChangeRef.current) return;

            // Mirror direct Excalidraw deletes of managed shapes back to the semantic tree.
            // This keeps child nodes/connectors from lingering when a parent shape is removed
            // through Excalidraw UI actions (context menu/action bar).
            const currentSceneElementsById = new Map(
                sceneElements.map((element) => [element.id, element]),
            );
            const removedManagedNodeIds = new Set<string>();
            for (const previousElement of previousSceneElements) {
                const removedNodeId = resolveManagedShapeNodeId(previousElement);
                if (!removedNodeId || !projectedShapeIds.has(removedNodeId)) continue;
                const currentElement = currentSceneElementsById.get(previousElement.id);
                const wasDeletedPreviously = Boolean(
                    (previousElement as ExcalidrawElement & { isDeleted?: boolean }).isDeleted,
                );
                const isDeletedNow = currentElement
                    ? Boolean((currentElement as ExcalidrawElement & { isDeleted?: boolean }).isDeleted)
                    : true;
                const isRemovedFromScene = !currentElement;
                const isNewlyDeleted = isDeletedNow && !wasDeletedPreviously;
                if (isRemovedFromScene || isNewlyDeleted) {
                    removedManagedNodeIds.add(removedNodeId);
                }
            }
            if (removedManagedNodeIds.size > 0) {
                const state = useMindmapStore.getState();
                const topLevelRemovedNodeIds = [...removedManagedNodeIds].filter((nodeId) => {
                    let parentId = state.nodes[nodeId]?.parentId || null;
                    while (parentId) {
                        if (removedManagedNodeIds.has(parentId)) return false;
                        parentId = state.nodes[parentId]?.parentId || null;
                    }
                    return true;
                });
                for (const nodeId of topLevelRemovedNodeIds) {
                    if (state.nodes[nodeId]) {
                        deleteNode(nodeId);
                    }
                }
                return;
            }

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

            // --- Position sync ---
            for (const element of sceneElements) {
                if (!isManagedElement(element) || element.customData.role !== 'shape') continue;
                const nodeId = element.customData.mindmapNodeId;
                const currentNode = useMindmapStore.getState().nodes[nodeId];
                if (!currentNode) continue;
                const fallbackPosition = layout[nodeId];
                const referencePosition = currentNode.position || fallbackPosition;
                if (!referencePosition) continue;
                const hasMoved =
                    Math.abs(referencePosition.x - element.x) > POSITION_EPSILON ||
                    Math.abs(referencePosition.y - element.y) > POSITION_EPSILON;
                if (hasMoved) {
                    setNodePosition(nodeId, { x: element.x, y: element.y });
                }
            }
        },
        [deleteNode, layout, projectedShapeIds, selectNode, setNodePosition, updateLabel, updateViewportTransform],
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
    /* this function resolves the managed node id from the excalidraw api 
    on whatever element is selected by the user
    */
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

    const handleCreateMindmapTree = useCallback(() => {
        initRoot('Mindmap Tree');
    }, [initRoot]);

    const addNodeButtons = useMemo(() => {
        if (!scopeRect || !viewportTransform) return [];
        const buttons: AddNodeButton[] = [];

        const toScopePoint = (sceneX: number, sceneY: number): { x: number; y: number } => {
            const viewportPoint = {
                x: (sceneX + viewportTransform.scrollX) * viewportTransform.zoomValue + viewportTransform.offsetLeft,
                y: (sceneY + viewportTransform.scrollY) * viewportTransform.zoomValue + viewportTransform.offsetTop,
            };
            return {
                x: viewportPoint.x - scopeRect.left,
                y: viewportPoint.y - scopeRect.top,
            };
        };

        for (const element of elements) {
            if (!isManagedElement(element) || element.customData.role !== 'shape') continue;
            const nodeId = element.customData.mindmapNodeId;
            const node = nodes[nodeId];
            if (!node) continue;

            const centerY = element.y + element.height / 2;
            const rightAnchor = toScopePoint(
                element.x + element.width + ADD_NODE_BUTTON_SCENE_OFFSET,
                centerY,
            );

            if (node.parentId === null) {
                const leftAnchor = toScopePoint(
                    element.x - ADD_NODE_BUTTON_SCENE_OFFSET,
                    centerY,
                );
                buttons.push({
                    key: `node-add-left-${nodeId}`,
                    nodeId,
                    x: leftAnchor.x,
                    y: leftAnchor.y,
                    title: 'Add subnode',
                });
            }

            buttons.push({
                key: `node-add-right-${nodeId}`,
                nodeId,
                x: rightAnchor.x,
                y: rightAnchor.y,
                title: node.parentId === null ? 'Add subnode' : 'Add child node',
            });
        }

        return buttons;
    }, [elements, nodes, scopeRect, viewportTransform]);

    // Inject an "add node" button into Excalidraw's built-in toolbar.
    useEffect(() => {
        const scopeElement = shortcutScopeRef.current;
        if (!scopeElement) return;

        const resolveToolbarTarget = (): HTMLElement | null => {
            const toolbarShapeProbe = scopeElement.querySelector<HTMLElement>(
                '.excalidraw [data-testid="toolbar-rectangle"]',
            );
            const shapeToolContainer = toolbarShapeProbe?.closest('.ToolIcon')?.parentElement;
            if (shapeToolContainer) return shapeToolContainer;

            return (
                scopeElement.querySelector<HTMLElement>('.excalidraw .App-toolbar .App-toolbar-content') ||
                scopeElement.querySelector<HTMLElement>('.excalidraw .App-toolbar .App-toolbar-container') ||
                scopeElement.querySelector<HTMLElement>('.excalidraw .App-toolbar .shapes-section')
            );
        };

        const ensureButton = (): void => {
            const buttonLabel = 'Create mindmap tree';
            const existing = scopeElement.querySelector<HTMLButtonElement>(`button[${ADD_NODE_TOOL_ATTR}="true"]`);
            if (existing) {
                existing.onclick = handleCreateMindmapTree;
                existing.setAttribute('aria-label', buttonLabel);
                existing.setAttribute('title', buttonLabel);
                const keyBinding = existing.querySelector<HTMLElement>('.ToolIcon__keybinding');
                if (keyBinding) {
                    keyBinding.textContent = '';
                }
                return;
            }

            const insertionTarget = resolveToolbarTarget();
            if (!insertionTarget) return;

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'ToolIcon ToolIcon_type_button Shape';
            button.setAttribute(ADD_NODE_TOOL_ATTR, 'true');
            button.setAttribute('aria-label', buttonLabel);
            button.setAttribute('title', buttonLabel);
            button.setAttribute('data-testid', 'toolbar-mindmap-add');
            button.onclick = handleCreateMindmapTree;

            const icon = document.createElement('div');
            icon.className = 'ToolIcon__icon';
            icon.innerHTML = `
                <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                    <path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
                </svg>
            `;
            button.append(icon);

            const keyBinding = document.createElement('div');
            keyBinding.className = 'ToolIcon__keybinding';
            keyBinding.textContent = '';
            button.append(keyBinding);

            insertionTarget.append(button);
        };

        ensureButton();
        const observer = new MutationObserver(() => {
            ensureButton();
        });
        observer.observe(scopeElement, { childList: true, subtree: true });

        return () => {
            observer.disconnect();
            const existing = scopeElement.querySelector<HTMLButtonElement>(`button[${ADD_NODE_TOOL_ATTR}="true"]`);
            existing?.remove();
        };
    }, [handleCreateMindmapTree]);

    useEffect(() => {
        if (!api) return;

        const unsubscribe = api.onPointerUp((activeTool, pointerDownState, event) => {
            if (activeTool.type !== 'selection') return;
            if (pointerDownState.drag.hasOccurred) return;
            if (event.button !== 0) return;
            if (isInteractiveTarget(event.target)) return;
            if (api.getAppState().editingTextElement) return;
            // Keep default Excalidraw behavior on single-click.
            // Mindmap node creation happens on double-click of a node/selection.
            if (event.detail < 2) return;

            const hitNodeId = resolveNodeIdFromHitElement(
                pointerDownState.hit.element as ExcalidrawElement | null,
            );
            const state = useMindmapStore.getState();
            const currentSelectedNodeId = resolveSelectedManagedNodeIdFromApi() || state.selectedNodeId;

            const parentNodeId = hitNodeId || currentSelectedNodeId;
            if (!parentNodeId) return;

            createChildAndStartEdit(parentNodeId);
        });

        return unsubscribe;
    }, [
        api,
        createChildAndStartEdit,
        isInteractiveTarget,
        resolveNodeIdFromHitElement,
        resolveSelectedManagedNodeIdFromApi,
    ]);

    useEffect(() => {
        if (!api) return;
        return api.onScrollChange(() => {
            updateViewportTransform(api.getAppState());
        });
    }, [api, updateViewportTransform]);

    // Register keyboard shortcuts
    useKeyboardShortcuts(handleStartEdit, shortcutScopeRef);

    return (
        <div
            ref={shortcutScopeRef}
            tabIndex={0}
            style={{ width: '100%', height: '100%', position: 'relative' }}
        >
            <Excalidraw
                excalidrawAPI={setApi}
                initialData={{
                    elements: [],
                }}
                onChange={handleChange}
            />
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    zIndex: 2,
                }}
            >
                {addNodeButtons.map((button) => (
                    <button
                        key={button.key}
                        type="button"
                        title={button.title}
                        aria-label={button.title}
                        onPointerDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                        }}
                        onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            createChildAndStartEdit(button.nodeId);
                        }}
                        style={{
                            position: 'absolute',
                            left: `${button.x}px`,
                            top: `${button.y}px`,
                            width: `${ADD_NODE_BUTTON_SIZE}px`,
                            height: `${ADD_NODE_BUTTON_SIZE}px`,
                            transform: 'translate(-50%, -50%)',
                            border: '1px solid #495057',
                            borderRadius: '999px',
                            background: '#ffffff',
                            color: '#1f2933',
                            fontSize: '16px',
                            lineHeight: 1,
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 1px 4px rgba(0, 0, 0, 0.18)',
                            pointerEvents: 'auto',
                            display: 'grid',
                            placeItems: 'center',
                            padding: 0,
                        }}
                    >
                        +
                    </button>
                ))}
            </div>
        </div>
    );
}
