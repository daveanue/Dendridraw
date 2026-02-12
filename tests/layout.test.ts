import assert from 'node:assert/strict';
import test from 'node:test';
import { computeLayout } from '../src/engine/layout.ts';
import type { MindmapNode } from '../src/types/mindmap.ts';

function makeNode(
    id: string,
    parentId: string | null,
    childrenIds: string[],
    position?: { x: number; y: number },
): MindmapNode {
    return {
        id,
        label: id,
        parentId,
        childrenIds,
        type: 'topic',
        collapsed: false,
        position,
        metadata: {
            createdAt: 0,
            updatedAt: 0,
        },
    };
}

test('computeLayout prefers stored manual node position overrides', () => {
    const nodes: Record<string, MindmapNode> = {
        root: makeNode('root', null, ['child']),
        child: makeNode('child', 'root', [], { x: 420, y: 180 }),
    };

    const layout = computeLayout(['root'], nodes);

    assert.deepEqual(layout.child, { x: 420, y: 180 });
});

test('computeLayout supports multiple independent roots', () => {
    const nodes: Record<string, MindmapNode> = {
        rootA: makeNode('rootA', null, []),
        rootB: makeNode('rootB', null, []),
    };

    const layout = computeLayout(['rootA', 'rootB'], nodes);

    assert.ok(layout.rootA);
    assert.ok(layout.rootB);
    assert.notEqual(layout.rootA.y, layout.rootB.y);
});
