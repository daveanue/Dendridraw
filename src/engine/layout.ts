/**
 * Simple offset-based layout engine (MVP).
 *
 * Computes { x, y } positions for every visible node in the tree
 * using a right-to-left tree layout with vertical stacking of siblings.
 *
 * This is intentionally simple — no dagre dependency yet.
 * Swap in dagre/elkjs when collapse/expand and large maps require it.
 */
import type { MindmapNode } from '../types/mindmap';

/* ------------------------------------------------------------------ */
/*  Layout constants                                                  */
/* ------------------------------------------------------------------ */

/** Horizontal gap between a parent and its children (px). */
const HORIZONTAL_GAP = 280;
/** Vertical gap between sibling nodes (px). */
const VERTICAL_GAP = 80;
/** Estimated node height for spacing calculations (px). */
const NODE_HEIGHT = 44;

export interface NodePosition {
    x: number;
    y: number;
}

export type LayoutMap = Record<string, NodePosition>;

/* ------------------------------------------------------------------ */
/*  Layout computation                                                */
/* ------------------------------------------------------------------ */

/**
 * Compute positions for all visible (non-collapsed, non-deleted) nodes.
 *
 * Algorithm:
 * 1. Walk the tree depth-first.
 * 2. Each node's x = parent.x + HORIZONTAL_GAP (depth-based).
 * 3. Each node's y is determined by the cumulative vertical space
 *    consumed by preceding subtrees at the same level.
 *
 * Returns a map of nodeId → { x, y }.
 */
export function computeLayout(
    rootId: string | null,
    nodes: Record<string, MindmapNode>,
): LayoutMap {
    if (!rootId || !nodes[rootId]) return {};

    const positions: LayoutMap = {};
    // yOffset tracks the next available vertical position (global cursor)
    let yOffset = 0;

    function layoutNode(nodeId: string, depth: number): void {
        const node = nodes[nodeId];
        if (!node) return;

        const x = depth * HORIZONTAL_GAP;

        const visibleChildren = node.collapsed
            ? []
            : node.childrenIds.filter((id) => nodes[id]);

        if (visibleChildren.length === 0) {
            // Leaf node: place at current yOffset
            positions[nodeId] = { x, y: yOffset };
            yOffset += NODE_HEIGHT + VERTICAL_GAP;
        } else {
            // Branch node: layout children first, then center parent
            const firstChildY = yOffset;
            for (const childId of visibleChildren) {
                layoutNode(childId, depth + 1);
            }
            const lastChildY = positions[visibleChildren[visibleChildren.length - 1]].y;

            // Center parent vertically between first and last child
            positions[nodeId] = {
                x,
                y: (firstChildY + lastChildY) / 2,
            };
        }
    }

    layoutNode(rootId, 0);
    return positions;
}
