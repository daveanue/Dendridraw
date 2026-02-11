/**
 * Canvas component — wraps Excalidraw and wires it to the semantic layer.
 *
 * Responsibilities:
 * - Renders Excalidraw with elements derived from the tree model
 * - Detects clicks on elements → maps to semantic node selection
 * - Syncs label edits back to the store
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Excalidraw, convertToExcalidrawElements } from '@excalidraw/excalidraw';
import { useMindmapStore } from '../store/mindmapStore';
import { computeLayout } from '../engine/layout';
import { buildElementDescriptors } from '../engine/renderer';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import type { DendridrawCustomData } from '../types/mindmap';

// Excalidraw's imperative API type — obtained via the excalidrawAPI callback
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExcalidrawAPI = any;

export default function Canvas() {
    const [api, setApi] = useState<ExcalidrawAPI>(null);
    const isInitialRender = useRef(true);

    // Subscribe to store slices
    const rootId = useMindmapStore((s) => s.rootId);
    const nodes = useMindmapStore((s) => s.nodes);
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

    // Track the last pushed state to avoid infinite update loops
    const lastPushedRef = useRef<string>('');

    // Push elements to Excalidraw when they change
    useEffect(() => {
        if (!api) return;

        // Build a simple fingerprint to detect real changes
        const fingerprint = JSON.stringify(
            descriptors.map((d) => ({ id: d.id, x: d.x, y: d.y, label: d.label?.text })),
        );

        if (fingerprint === lastPushedRef.current) return;
        lastPushedRef.current = fingerprint;

        api.updateScene({ elements });

        // Scroll to content on initial render
        if (isInitialRender.current) {
            isInitialRender.current = false;
            requestAnimationFrame(() => {
                api.scrollToContent(elements, { fitToContent: true, animate: true });
            });
        }
    }, [api, elements, descriptors]);

    // Handle onChange from Excalidraw — detect node selection and label edits
    const handleChange = useCallback(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (changedElements: readonly any[], appState: any) => {
            // --- Selection detection ---
            const selectedIds = Object.keys(appState?.selectedElementIds || {});
            if (selectedIds.length > 0) {
                for (const elId of selectedIds) {
                    const el = changedElements.find((e) => e.id === elId);
                    if (el?.customData?.mindmapNodeId) {
                        const nodeId = (el.customData as DendridrawCustomData).mindmapNodeId;
                        const currentSelected = useMindmapStore.getState().selectedNodeId;
                        if (currentSelected !== nodeId) {
                            selectNode(nodeId);
                        }
                        break;
                    }
                }
            }

            // --- Label sync ---
            for (const el of changedElements) {
                if (
                    el.type === 'text' &&
                    el.customData &&
                    (el.customData as DendridrawCustomData).role === 'label'
                ) {
                    const nodeId = (el.customData as DendridrawCustomData).mindmapNodeId;
                    const currentNode = useMindmapStore.getState().nodes[nodeId];
                    if (currentNode && el.text !== currentNode.label && el.text?.trim()) {
                        updateLabel(nodeId, el.text);
                    }
                }
            }
        },
        [selectNode, updateLabel],
    );

    // Handle label edit start (for keyboard shortcut)
    const handleStartEdit = useCallback((_nodeId: string) => {
        // For now, double-click on the node in Excalidraw triggers text edit.
        // F2 / programmatic edit trigger can be enhanced in the next iteration.
    }, []);

    // Register keyboard shortcuts
    useKeyboardShortcuts(handleStartEdit);

    return (
        <div style={{ width: '100%', height: '100%' }}>
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
