import assert from 'node:assert/strict';
import test from 'node:test';
import { useMindmapStore } from '../src/store/mindmapStore.ts';

function resetStore(): void {
    useMindmapStore.setState({
        rootIds: [],
        nodes: {},
        deletedNodes: {},
        selectedNodeId: null,
        focusBranchId: null,
    });
}

test('deleteNode removes selected parent and all descendants from active nodes', () => {
    resetStore();
    const store = useMindmapStore.getState();

    store.initRoot('Root');
    const rootId = useMindmapStore.getState().selectedNodeId!;
    const childId = store.addChild(rootId, 'Child');
    const grandchildId = store.addChild(childId, 'Grandchild');

    store.deleteNode(childId);

    const state = useMindmapStore.getState();
    assert.ok(state.nodes[rootId], 'root should remain');
    assert.equal(state.nodes[rootId].childrenIds.includes(childId), false);
    assert.equal(state.nodes[childId], undefined);
    assert.equal(state.nodes[grandchildId], undefined);
    assert.ok(state.deletedNodes[childId], 'child should be tracked as deleted');
    assert.ok(state.deletedNodes[grandchildId], 'grandchild should be tracked as deleted');
});

test('deleteNode removes descendants even when childrenIds relation is stale', () => {
    resetStore();
    const store = useMindmapStore.getState();

    store.initRoot('Root');
    const rootId = useMindmapStore.getState().selectedNodeId!;
    const childId = store.addChild(rootId, 'Child');

    // Simulate temporary model drift where parent reference exists but
    // parent's childrenIds does not include the child.
    useMindmapStore.setState((state) => ({
        nodes: {
            ...state.nodes,
            [rootId]: {
                ...state.nodes[rootId],
                childrenIds: [],
            },
        },
    }));

    store.deleteNode(rootId);

    const state = useMindmapStore.getState();
    assert.equal(state.nodes[rootId], undefined);
    assert.equal(state.nodes[childId], undefined);
    assert.ok(state.deletedNodes[rootId], 'root should be tracked as deleted');
    assert.ok(state.deletedNodes[childId], 'child should be tracked as deleted');
});

test('restoreNode moves a deleted subtree back into active nodes', () => {
    resetStore();
    const store = useMindmapStore.getState();

    store.initRoot('Root');
    const rootId = useMindmapStore.getState().selectedNodeId!;
    const childId = store.addChild(rootId, 'Child');
    const grandchildId = store.addChild(childId, 'Grandchild');

    store.deleteNode(childId);
    assert.equal(useMindmapStore.getState().nodes[childId], undefined, 'child should be deleted first');

    store.restoreNode(childId);
    const state = useMindmapStore.getState();

    assert.ok(state.nodes[childId], 'child should be restored');
    assert.ok(state.nodes[grandchildId], 'grandchild should be restored');
    assert.ok(state.nodes[rootId].childrenIds.includes(childId), 'parent should reference restored child');
});
