/**
 * Zustand store — single source of truth for the mindmap tree.
 *
 * All mutations go through this store. Excalidraw elements are
 * derived from this state, never the other way around.
 */
import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { MindmapNode, MindmapState, NodeType } from '../types/mindmap';

/* ------------------------------------------------------------------ */
/*  Helper: create a fresh node                                       */
/* ------------------------------------------------------------------ */

function createNode(
    label: string,
    parentId: string | null,
    type: NodeType = 'topic',
): MindmapNode {
    const now = Date.now();
    return {
        id: nanoid(10),
        label,
        parentId,
        childrenIds: [],
        type,
        collapsed: false,
        metadata: { createdAt: now, updatedAt: now },
    };
}

/* ------------------------------------------------------------------ */
/*  Store actions                                                     */
/* ------------------------------------------------------------------ */

export interface MindmapActions {
    /** Initialize the map with a root node. */
    initRoot: (label?: string) => void;
    /** Add a child to the given parent; returns the new node ID. */
    addChild: (parentId: string, label?: string) => string;
    /** Add a sibling after the given node; returns the new node ID. */
    addSibling: (siblingId: string, label?: string) => string;
    /** Update a node's label. */
    updateLabel: (nodeId: string, label: string) => void;
    /** Soft-delete a node and its entire subtree. */
    deleteNode: (nodeId: string) => void;
    /** Restore a soft-deleted node and its subtree. */
    restoreNode: (nodeId: string) => void;
    /** Toggle collapsed state. */
    toggleCollapse: (nodeId: string) => void;
    /** Set the currently selected node. */
    selectNode: (nodeId: string | null) => void;
    /** Change a node's type. */
    setNodeType: (nodeId: string, type: NodeType) => void;
    /** Persist a node's canvas position after manual drag. */
    setNodePosition: (nodeId: string, position: { x: number; y: number }) => void;
    /** Undo the latest semantic change. */
    undo: () => void;
    /** Redo the latest semantic change. */
    redo: () => void;
    /** Clear semantic undo/redo history. */
    clearHistory: () => void;
}

export type MindmapStore = MindmapState & MindmapActions;

type HistorySnapshot = Pick<
    MindmapState,
    'rootIds' | 'nodes' | 'deletedNodes' | 'selectedNodeId' | 'focusBranchId'
>;

type StatePatch = Partial<HistorySnapshot>;

/* ------------------------------------------------------------------ */
/*  Helpers for subtree operations                                    */
/* ------------------------------------------------------------------ */

/** Collect a node and all its descendants (recursive). */
function collectSubtree(
    nodeId: string,
    nodes: Record<string, MindmapNode>,
): string[] {
    const parentChildrenIndex = new Map<string, string[]>();
    for (const [id, node] of Object.entries(nodes)) {
        if (!node.parentId) continue;
        const siblings = parentChildrenIndex.get(node.parentId) || [];
        siblings.push(id);
        parentChildrenIndex.set(node.parentId, siblings);
    }

    const result: string[] = [];
    const visited = new Set<string>();
    const stack = [nodeId];

    while (stack.length > 0) {
        const currentId = stack.pop()!;
        if (visited.has(currentId)) continue;
        const node = nodes[currentId];
        if (!node) continue;

        visited.add(currentId);
        result.push(currentId);

        // Traverse both semantic child links and reverse parent links to
        // keep subtree deletion resilient to temporary relationship drift.
        for (const childId of node.childrenIds) {
            if (!visited.has(childId)) {
                stack.push(childId);
            }
        }
        const indexedChildren = parentChildrenIndex.get(currentId) || [];
        for (const childId of indexedChildren) {
            if (!visited.has(childId)) {
                stack.push(childId);
            }
        }
    }

    return result;
}

/* ------------------------------------------------------------------ */
/*  Store definition                                                  */
/* ------------------------------------------------------------------ */

export const useMindmapStore = create<MindmapStore>((set, get) => {
    const MAX_HISTORY_ENTRIES = 250;
    const past: HistorySnapshot[] = [];
    const future: HistorySnapshot[] = [];

    const snapshotFromState = (state: HistorySnapshot): HistorySnapshot => ({
        rootIds: state.rootIds,
        nodes: state.nodes,
        deletedNodes: state.deletedNodes,
        selectedNodeId: state.selectedNodeId,
        focusBranchId: state.focusBranchId,
    });

    const applyPatchWithHistory = (updater: (state: MindmapStore) => StatePatch | null): void => {
        set((state) => {
            const patch = updater(state);
            if (!patch) return state;

            past.push(snapshotFromState(state));
            if (past.length > MAX_HISTORY_ENTRIES) {
                past.shift();
            }
            future.length = 0;
            return patch;
        });
    };

    return {
        // --- Initial state ---
        rootIds: [],
        nodes: {},
        deletedNodes: {},
        selectedNodeId: null,
        focusBranchId: null,

        // --- Actions ---

        initRoot(label = 'Central Topic') {
            const root = createNode(label, null);
            applyPatchWithHistory((state) => ({
                rootIds: [...state.rootIds, root.id],
                nodes: { ...state.nodes, [root.id]: root },
                selectedNodeId: root.id,
            }));
        },

        addChild(parentId, label = '') {
            const child = createNode(label, parentId);
            applyPatchWithHistory((state) => {
                const parent = state.nodes[parentId];
                if (!parent) return null;
                return {
                    nodes: {
                        ...state.nodes,
                        [parentId]: {
                            ...parent,
                            childrenIds: [...parent.childrenIds, child.id],
                            collapsed: false, // auto-expand when adding child
                        },
                        [child.id]: child,
                    },
                    selectedNodeId: child.id,
                };
            });
            return child.id;
        },

        addSibling(siblingId, label = '') {
            const { nodes } = get();
            const sibling = nodes[siblingId];
            if (!sibling || !sibling.parentId) return siblingId; // can't add sibling to root

            const newNode = createNode(label, sibling.parentId);
            applyPatchWithHistory((state) => {
                const parent = state.nodes[sibling.parentId!];
                if (!parent) return null;
                const idx = parent.childrenIds.indexOf(siblingId);
                const newChildren = [...parent.childrenIds];
                newChildren.splice(idx + 1, 0, newNode.id);
                return {
                    nodes: {
                        ...state.nodes,
                        [sibling.parentId!]: { ...parent, childrenIds: newChildren },
                        [newNode.id]: newNode,
                    },
                    selectedNodeId: newNode.id,
                };
            });
            return newNode.id;
        },

        updateLabel(nodeId, label) {
            applyPatchWithHistory((state) => {
                const node = state.nodes[nodeId];
                if (!node || node.label === label) return null;
                return {
                    nodes: {
                        ...state.nodes,
                        [nodeId]: {
                            ...node,
                            label,
                            metadata: { ...node.metadata, updatedAt: Date.now() },
                        },
                    },
                };
            });
        },

        deleteNode(nodeId) {
            const { nodes } = get();

            const subtreeIds = collectSubtree(nodeId, nodes);
            const node = nodes[nodeId];
            if (!node) return;

            applyPatchWithHistory((state) => {
                // Remove from parent's children
                const newNodes = { ...state.nodes };
                const newDeleted = { ...state.deletedNodes };

                if (node.parentId && newNodes[node.parentId]) {
                    const parent = newNodes[node.parentId];
                    newNodes[node.parentId] = {
                        ...parent,
                        childrenIds: parent.childrenIds.filter((id) => id !== nodeId),
                    };
                }

                // Move subtree to deleted
                for (const id of subtreeIds) {
                    if (!newNodes[id]) continue;
                    newDeleted[id] = newNodes[id];
                    delete newNodes[id];
                }

                // Adjust selection
                let newSelected = state.selectedNodeId;
                if (newSelected && subtreeIds.includes(newSelected)) {
                    newSelected = node.parentId || null;
                    if (!newSelected) {
                        const remainingRoots = state.rootIds.filter((id) => id !== nodeId);
                        newSelected = remainingRoots[remainingRoots.length - 1] || null;
                    }
                }

                return {
                    rootIds: node.parentId === null
                        ? state.rootIds.filter((id) => id !== nodeId)
                        : state.rootIds,
                    nodes: newNodes,
                    deletedNodes: newDeleted,
                    selectedNodeId: newSelected,
                };
            });
        },

        restoreNode(nodeId) {
            applyPatchWithHistory((state) => {
                const node = state.deletedNodes[nodeId];
                if (!node) return null;

                // Collect subtree from deleted nodes
                const subtreeIds = collectSubtree(nodeId, state.deletedNodes);
                const newNodes = { ...state.nodes };
                const newDeleted = { ...state.deletedNodes };

                for (const id of subtreeIds) {
                    if (newDeleted[id]) {
                        newNodes[id] = newDeleted[id];
                        delete newDeleted[id];
                    }
                }

                // Re-attach to parent if parent exists
                if (node.parentId && newNodes[node.parentId]) {
                    const parent = newNodes[node.parentId];
                    if (!parent.childrenIds.includes(nodeId)) {
                        newNodes[node.parentId] = {
                            ...parent,
                            childrenIds: [...parent.childrenIds, nodeId],
                        };
                    }
                }

                const shouldAddRoot = node.parentId === null && !state.rootIds.includes(nodeId);

                return {
                    rootIds: shouldAddRoot ? [...state.rootIds, nodeId] : state.rootIds,
                    nodes: newNodes,
                    deletedNodes: newDeleted,
                };
            });
        },

        toggleCollapse(nodeId) {
            applyPatchWithHistory((state) => {
                const node = state.nodes[nodeId];
                if (!node || node.childrenIds.length === 0) return null;
                return {
                    nodes: {
                        ...state.nodes,
                        [nodeId]: { ...node, collapsed: !node.collapsed },
                    },
                };
            });
        },

        selectNode(nodeId) {
            set({ selectedNodeId: nodeId });
        },

        setNodeType(nodeId, type) {
            applyPatchWithHistory((state) => {
                const node = state.nodes[nodeId];
                if (!node || node.type === type) return null;
                return {
                    nodes: {
                        ...state.nodes,
                        [nodeId]: { ...node, type },
                    },
                };
            });
        },

        setNodePosition(nodeId, position) {
            applyPatchWithHistory((state) => {
                const node = state.nodes[nodeId];
                if (!node) return null;
                const previous = node.position;
                if (previous && previous.x === position.x && previous.y === position.y) {
                    return null;
                }
                return {
                    nodes: {
                        ...state.nodes,
                        [nodeId]: {
                            ...node,
                            position: { x: position.x, y: position.y },
                            metadata: { ...node.metadata, updatedAt: Date.now() },
                        },
                    },
                };
            });
        },

        undo() {
            const previous = past.pop();
            if (!previous) return;
            future.push(snapshotFromState(get()));
            set(previous);
        },

        redo() {
            const next = future.pop();
            if (!next) return;
            past.push(snapshotFromState(get()));
            if (past.length > MAX_HISTORY_ENTRIES) {
                past.shift();
            }
            set(next);
        },

        clearHistory() {
            past.length = 0;
            future.length = 0;
        },
    };
});
