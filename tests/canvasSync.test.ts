import assert from 'node:assert/strict';
import test from 'node:test';
import {
    isManagedElement,
    resolveLabelNodeId,
    resolveSelectedManagedNodeId,
    type SyncElement,
} from '../src/components/canvasSync.ts';

function buildMap(elements: SyncElement[]): Map<string, SyncElement> {
    return new Map(elements.map((element) => [element.id, element]));
}

test('isManagedElement detects valid managed customData', () => {
    const element: SyncElement = {
        id: 'shape-a',
        type: 'rectangle',
        customData: { mindmapNodeId: 'node-a', role: 'shape' },
    };
    assert.equal(isManagedElement(element), true);
});

test('resolveSelectedManagedNodeId maps bound text selection to its managed container', () => {
    const elements: SyncElement[] = [
        {
            id: 'shape-a',
            type: 'rectangle',
            customData: { mindmapNodeId: 'node-a', role: 'shape' },
        },
        {
            id: 'label-a',
            type: 'text',
            containerId: 'shape-a',
        },
    ];
    const byId = buildMap(elements);
    assert.equal(resolveSelectedManagedNodeId(['label-a'], byId), 'node-a');
});

test('resolveSelectedManagedNodeId returns null for unmanaged selection', () => {
    const elements: SyncElement[] = [
        {
            id: 'free-text',
            type: 'text',
            customData: { foo: 'bar' },
        },
    ];
    const byId = buildMap(elements);
    assert.equal(resolveSelectedManagedNodeId(['free-text'], byId), null);
});

test('resolveLabelNodeId returns managed node id for managed label text', () => {
    const element: SyncElement = {
        id: 'label-a',
        type: 'text',
        customData: { mindmapNodeId: 'node-a', role: 'label' },
    };
    const byId = buildMap([element]);
    assert.equal(resolveLabelNodeId(element, byId), 'node-a');
});

test('resolveLabelNodeId maps container-bound text to managed node', () => {
    const shape: SyncElement = {
        id: 'shape-a',
        type: 'rectangle',
        customData: { mindmapNodeId: 'node-a', role: 'shape' },
    };
    const label: SyncElement = {
        id: 'label-a',
        type: 'text',
        containerId: 'shape-a',
    };
    const byId = buildMap([shape, label]);
    assert.equal(resolveLabelNodeId(label, byId), 'node-a');
});

test('resolveLabelNodeId returns null for non-text elements', () => {
    const shape: SyncElement = {
        id: 'shape-a',
        type: 'rectangle',
        customData: { mindmapNodeId: 'node-a', role: 'shape' },
    };
    const byId = buildMap([shape]);
    assert.equal(resolveLabelNodeId(shape, byId), null);
});
