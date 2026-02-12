import assert from 'node:assert/strict';
import test from 'node:test';
import { useMindmapStore } from '../src/store/mindmapStore.ts';

function resetStore(): void {
    useMindmapStore.getState().clearHistory();
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

test('undo and redo restore semantic tree changes', () => {
    resetStore();
    const store = useMindmapStore.getState();

    store.initRoot('Root');
    const rootId = useMindmapStore.getState().selectedNodeId!;
    const childId = store.addChild(rootId, 'Child');

    assert.ok(useMindmapStore.getState().nodes[childId], 'child should exist after creation');

    store.undo();
    assert.equal(useMindmapStore.getState().nodes[childId], undefined, 'undo should remove child');

    store.redo();
    assert.ok(useMindmapStore.getState().nodes[childId], 'redo should restore child');
});
