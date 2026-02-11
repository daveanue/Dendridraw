/**
 * Renderer: converts the semantic tree + layout positions into
 * Excalidraw-compatible element descriptors.
 *
 * Uses Excalidraw's `convertToExcalidrawElements` to create properly
 * formed elements from simplified descriptors, avoiding the need to
 * manually construct the full internal element schema.
 */
import type { MindmapNode, DendridrawCustomData } from '../types/mindmap';
import type { LayoutMap } from './layout';

/* ------------------------------------------------------------------ */
/*  Style constants for node types                                    */
/* ------------------------------------------------------------------ */

const NODE_STYLES: Record<string, { bg: string; stroke: string }> = {
    topic: { bg: '#a5d8ff', stroke: '#1c7ed6' },
    task: { bg: '#d3f9d8', stroke: '#2f9e44' },
    reference: { bg: '#ffec99', stroke: '#f08c00' },
};

const ROOT_STYLE = { bg: '#e7f5ff', stroke: '#1971c2' };

const NODE_MIN_WIDTH = 160;
const NODE_HEIGHT = 44;
const FONT_SIZE = 18;

/* ------------------------------------------------------------------ */
/*  Text width estimation                                             */
/* ------------------------------------------------------------------ */

function estimateTextWidth(text: string, fontSize: number): number {
    const AVG_CHAR_WIDTH_RATIO = 0.6;
    return Math.max(NODE_MIN_WIDTH, text.length * fontSize * AVG_CHAR_WIDTH_RATIO + 32);
}

/* ------------------------------------------------------------------ */
/*  Custom data helper                                                */
/* ------------------------------------------------------------------ */

function makeCustomData(
    nodeId: string,
    role: DendridrawCustomData['role'],
): DendridrawCustomData {
    return { mindmapNodeId: nodeId, role };
}

/* ------------------------------------------------------------------ */
/*  Element descriptor types (simplified for convertToExcalidrawElements) */
/* ------------------------------------------------------------------ */

// Using `any` for the element descriptors because we pass them to
// convertToExcalidrawElements which handles the full schema construction.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ElementDescriptor = any;

/* ------------------------------------------------------------------ */
/*  Element factories                                                 */
/* ------------------------------------------------------------------ */

function createRectDescriptor(
    node: MindmapNode,
    x: number,
    y: number,
    isRoot: boolean,
): ElementDescriptor {
    const width = estimateTextWidth(node.label, FONT_SIZE);
    const style = isRoot ? ROOT_STYLE : (NODE_STYLES[node.type] || NODE_STYLES.topic);

    return {
        id: `shape-${node.id}`,
        type: 'rectangle',
        x,
        y,
        width,
        height: NODE_HEIGHT,
        strokeColor: style.stroke,
        backgroundColor: style.bg,
        fillStyle: 'solid',
        strokeWidth: 2,
        roughness: 1,
        roundness: { type: 3 },
        label: {
            text: node.label || ' ',
            fontSize: FONT_SIZE,
            fontFamily: 1,
            textAlign: 'center' as const,
            verticalAlign: 'middle' as const,
        },
        customData: makeCustomData(node.id, 'shape'),
    };
}

function createArrowDescriptor(
    parentNode: MindmapNode,
    childNode: MindmapNode,
    parentPos: { x: number; y: number },
    childPos: { x: number; y: number },
): ElementDescriptor {
    const parentWidth = estimateTextWidth(parentNode.label, FONT_SIZE);
    const startX = parentPos.x + parentWidth;
    const startY = parentPos.y + NODE_HEIGHT / 2;
    const endX = childPos.x;
    const endY = childPos.y + NODE_HEIGHT / 2;

    return {
        id: `arrow-${parentNode.id}-${childNode.id}`,
        type: 'arrow',
        x: startX,
        y: startY,
        width: endX - startX,
        height: endY - startY,
        strokeColor: '#868e96',
        strokeWidth: 2,
        roughness: 1,
        startBinding: {
            elementId: `shape-${parentNode.id}`,
            focus: 0,
            gap: 4,
        },
        endBinding: {
            elementId: `shape-${childNode.id}`,
            focus: 0,
            gap: 4,
        },
        endArrowhead: 'arrow',
        points: [
            [0, 0],
            [endX - startX, endY - startY],
        ],
        customData: makeCustomData(childNode.id, 'connector'),
    };
}

/* ------------------------------------------------------------------ */
/*  Main render function                                              */
/* ------------------------------------------------------------------ */

/**
 * Build an array of simplified element descriptors from the tree.
 *
 * These descriptors should be passed through Excalidraw's
 * `convertToExcalidrawElements()` to produce valid scene elements.
 */
export function buildElementDescriptors(
    rootId: string | null,
    nodes: Record<string, MindmapNode>,
    layout: LayoutMap,
): ElementDescriptor[] {
    if (!rootId || !nodes[rootId]) return [];

    const descriptors: ElementDescriptor[] = [];
    const visited = new Set<string>();

    function walk(nodeId: string): void {
        if (visited.has(nodeId)) return;
        visited.add(nodeId);

        const node = nodes[nodeId];
        const pos = layout[nodeId];
        if (!node || !pos) return;

        const isRoot = nodeId === rootId;

        // Shape with embedded label
        descriptors.push(createRectDescriptor(node, pos.x, pos.y, isRoot));

        // Arrow from parent → this node
        if (node.parentId && nodes[node.parentId] && layout[node.parentId]) {
            descriptors.push(
                createArrowDescriptor(
                    nodes[node.parentId],
                    node,
                    layout[node.parentId],
                    pos,
                ),
            );
        }

        // Recurse visible children
        if (!node.collapsed) {
            for (const childId of node.childrenIds) {
                walk(childId);
            }
        }
    }

    walk(rootId);
    return descriptors;
}
