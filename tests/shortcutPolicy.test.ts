import assert from 'node:assert/strict';
import test from 'node:test';
import { getMindmapShortcutAction } from '../src/hooks/shortcutPolicy.ts';

const baseInput = {
    hasSelection: true,
    isEditing: false,
    hasModifier: false,
    isEditableTarget: false,
};

test('maps expected keys to mindmap actions', () => {
    assert.equal(getMindmapShortcutAction({ ...baseInput, key: 'Tab' }), 'addChild');
    assert.equal(getMindmapShortcutAction({ ...baseInput, key: 'Enter' }), 'addSibling');
    assert.equal(getMindmapShortcutAction({ ...baseInput, key: 'Delete' }), 'deleteNode');
    assert.equal(getMindmapShortcutAction({ ...baseInput, key: 'Backspace' }), 'deleteNode');
    assert.equal(getMindmapShortcutAction({ ...baseInput, key: ' ' }), 'toggleCollapse');
    assert.equal(getMindmapShortcutAction({ ...baseInput, key: 'Escape' }), 'deselect');
    assert.equal(getMindmapShortcutAction({ ...baseInput, key: 'F2' }), 'startEdit');
});

test('returns null for unsupported keys', () => {
    assert.equal(getMindmapShortcutAction({ ...baseInput, key: 'a' }), null);
});

test('returns null while editing', () => {
    assert.equal(getMindmapShortcutAction({ ...baseInput, key: 'Tab', isEditing: true }), null);
});

test('returns null without a selected node', () => {
    assert.equal(getMindmapShortcutAction({ ...baseInput, key: 'Tab', hasSelection: false }), null);
});

test('returns null for modifier-based key combinations', () => {
    assert.equal(getMindmapShortcutAction({ ...baseInput, key: 'Tab', hasModifier: true }), null);
});

test('returns null when event target is editable/interactive', () => {
    assert.equal(getMindmapShortcutAction({ ...baseInput, key: 'Tab', isEditableTarget: true }), null);
});
