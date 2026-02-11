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
}

export type MindmapStore = MindmapState & MindmapActions;

/* ------------------------------------------------------------------ */
/*  Helpers for subtree operations                                    */
/* ------------------------------------------------------------------ */

/** Collect a node and all its descendants (recursive). */
function collectSubtree(
    nodeId: string,
    nodes: Record<string, MindmapNode>,
): string[] {
    const result: string[] = [nodeId];
    const node = nodes[nodeId];
    if (!node) return result;
    for (const childId of node.childrenIds) {
        result.push(...collectSubtree(childId, nodes));
    }
    return result;
}

/* ------------------------------------------------------------------ */
/*  Store definition                                                  */
/* ------------------------------------------------------------------ */

export const useMindmapStore = create<MindmapStore>((set, get) => ({
    // --- Initial state ---
    rootId: null,
    nodes: {},
    deletedNodes: {},
    selectedNodeId: null,
    focusBranchId: null,

    // --- Actions ---

    initRoot(label = 'Central Topic') {
        const root = createNode(label, null);
        set({
            rootId: root.id,
            nodes: { [root.id]: root },
            selectedNodeId: root.id,
            deletedNodes: {},
            focusBranchId: null,
        });
    },

    addChild(parentId, label = '') {
        const child = createNode(label, parentId);
        set((state) => {
            const parent = state.nodes[parentId];
            if (!parent) return state;
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
        set((state) => {
            const parent = state.nodes[sibling.parentId!];
            if (!parent) return state;
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
        set((state) => {
            const node = state.nodes[nodeId];
            if (!node) return state;
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
        const { rootId, nodes } = get();
        if (nodeId === rootId) return; // never delete the root

        const subtreeIds = collectSubtree(nodeId, nodes);
        const node = nodes[nodeId];
        if (!node) return;

        set((state) => {
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
                newDeleted[id] = newNodes[id];
                delete newNodes[id];
            }

            // Adjust selection
            let newSelected = state.selectedNodeId;
            if (newSelected && subtreeIds.includes(newSelected)) {
                newSelected = node.parentId;
            }

            return {
                nodes: newNodes,
                deletedNodes: newDeleted,
                selectedNodeId: newSelected,
            };
        });
    },

    restoreNode(nodeId) {
        set((state) => {
            const node = state.deletedNodes[nodeId];
            if (!node) return state;

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

            return { nodes: newNodes, deletedNodes: newDeleted };
        });
    },

    toggleCollapse(nodeId) {
        set((state) => {
            const node = state.nodes[nodeId];
            if (!node || node.childrenIds.length === 0) return state;
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
        set((state) => {
            const node = state.nodes[nodeId];
            if (!node) return state;
            return {
                nodes: {
                    ...state.nodes,
                    [nodeId]: { ...node, type },
                },
            };
        });
    },
}));
