export type MindmapShortcutAction =
    | 'addChild'
    | 'addSibling'
    | 'deleteNode'
    | 'toggleCollapse'
    | 'deselect'
    | 'startEdit'
    | null;

export interface ShortcutPolicyInput {
    key: string;
    hasSelection: boolean;
    isEditing: boolean;
    hasModifier: boolean;
    isEditableTarget: boolean;
}

export function getMindmapShortcutAction(input: ShortcutPolicyInput): MindmapShortcutAction {
    const { key, hasSelection, isEditing, hasModifier, isEditableTarget } = input;
    if (isEditing || hasModifier || isEditableTarget || !hasSelection) return null;

    switch (key) {
        case 'Tab':
            return 'addChild';
        case 'Enter':
            return 'addSibling';
        case 'Delete':
        case 'Backspace':
            return 'deleteNode';
        case ' ':
            return 'toggleCollapse';
        case 'Escape':
            return 'deselect';
        case 'F2':
            return 'startEdit';
        default:
            return null;
    }
}
