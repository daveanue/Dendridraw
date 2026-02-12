/**
 * Toolbar — minimal top bar with map actions and node info.
 */
import { useMindmapStore } from '../store/mindmapStore';
import type { NodeType } from '../types/mindmap';
import './Toolbar.css';

const NODE_TYPE_LABELS: Record<NodeType, string> = {
    topic: '💡 Topic',
    task: '✅ Task',
    reference: '📎 Reference',
};

export default function Toolbar() {
    const selectedNodeId = useMindmapStore((s) => s.selectedNodeId);
    const nodes = useMindmapStore((s) => s.nodes);
    const setNodeType = useMindmapStore((s) => s.setNodeType);
    const toggleCollapse = useMindmapStore((s) => s.toggleCollapse);
    const deleteNode = useMindmapStore((s) => s.deleteNode);

    const selectedNode = selectedNodeId ? nodes[selectedNodeId] : null;
    const isRoot = selectedNode?.parentId === null;

    return (
        <div className="toolbar">
            <div className="toolbar-brand">
                <span className="toolbar-logo">🌿</span>
                <span className="toolbar-title">Dendridraw</span>
            </div>

            {selectedNode && (
                <div className="toolbar-node-actions">
                    <span className="toolbar-node-label">
                        {selectedNode.label || '(empty)'}
                    </span>

                    <div className="toolbar-divider" />

                    {/* Node type selector */}
                    <select
                        className="toolbar-select"
                        value={selectedNode.type}
                        onChange={(e) =>
                            setNodeType(selectedNodeId!, e.target.value as NodeType)
                        }
                    >
                        {Object.entries(NODE_TYPE_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>

                    {/* Collapse toggle */}
                    {selectedNode.childrenIds.length > 0 && (
                        <button
                            className="toolbar-btn"
                            onClick={() => toggleCollapse(selectedNodeId!)}
                            title={selectedNode.collapsed ? 'Expand' : 'Collapse'}
                        >
                            {selectedNode.collapsed ? '⊕ Expand' : '⊖ Collapse'}
                        </button>
                    )}

                    {/* Delete */}
                    {!isRoot && (
                        <button
                            className="toolbar-btn toolbar-btn-danger"
                            onClick={() => deleteNode(selectedNodeId!)}
                            title="Delete node"
                        >
                            🗑 Delete
                        </button>
                    )}
                </div>
            )}

            {!selectedNode && (
                <div className="toolbar-hint">
                    Select a node or press <kbd>Tab</kbd> / <kbd>Enter</kbd> to create
                </div>
            )}

            <div className="toolbar-shortcuts">
                <kbd>Tab</kbd> child
                <kbd>Enter</kbd> sibling
                <kbd>Space</kbd> collapse
                <kbd>Del</kbd> delete
            </div>
        </div>
    );
}
