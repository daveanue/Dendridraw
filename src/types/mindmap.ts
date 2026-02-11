/**
 * Core semantic types for the Dendridraw mindmap model.
 *
 * Design: The semantic tree is the source of truth.
 * Excalidraw elements are derived (projected) from this model.
 * Excalidraw never "knows" about mindmap nodes — it only sees
 * rectangles, text, and arrows tagged via customData.
 */

/** Semantic intent of a node — drives visual styling and behavior. */
export type NodeType = 'topic' | 'task' | 'reference';

/** A single node in the semantic mindmap tree. */
export interface MindmapNode {
  id: string;
  label: string;
  parentId: string | null;
  childrenIds: string[];
  type: NodeType;
  collapsed: boolean;
  metadata: {
    notes?: string;
    links?: string[];
    createdAt: number;
    updatedAt: number;
  };
}

/** Full application state for one mindmap. */
export interface MindmapState {
  /** ID of the root node (null if map is empty). */
  rootId: string | null;
  /** All live nodes, keyed by ID. */
  nodes: Record<string, MindmapNode>;
  /** Soft-deleted nodes for restore capability. */
  deletedNodes: Record<string, MindmapNode>;
  /** Currently selected node ID. */
  selectedNodeId: string | null;
  /** Node ID whose branch is focused (progressive disclosure). */
  focusBranchId: string | null;
}

/**
 * Custom data attached to Excalidraw elements to link them
 * back to their semantic mindmap node.
 */
export interface DendridrawCustomData {
  /** Which mindmap node this element belongs to. */
  mindmapNodeId: string;
  /** Element role within the node's visual representation. */
  role: 'shape' | 'label' | 'connector';
}
