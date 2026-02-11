import type { DendridrawCustomData } from '../types/mindmap';

export type SyncElement = {
    id: string;
    type: string;
    containerId?: string | null;
    customData?: unknown;
};

export function isManagedElement<T extends { customData?: unknown }>(
    element: T | undefined,
): element is T & { customData: DendridrawCustomData } {
    if (!element?.customData || typeof element.customData !== 'object') return false;
    const customData = element.customData as Partial<DendridrawCustomData>;
    return (
        typeof customData.mindmapNodeId === 'string' &&
        (customData.role === 'shape' || customData.role === 'label' || customData.role === 'connector')
    );
}

export function resolveSelectedManagedNodeId(
    selectedIds: readonly string[],
    byId: ReadonlyMap<string, SyncElement>,
): string | null {
    for (const selectedId of selectedIds) {
        let selectedEl = byId.get(selectedId);
        if (selectedEl?.type === 'text' && selectedEl.containerId) {
            selectedEl = byId.get(selectedEl.containerId) || selectedEl;
        }
        if (isManagedElement(selectedEl)) {
            return selectedEl.customData.mindmapNodeId;
        }
    }
    return null;
}

export function resolveLabelNodeId(
    element: SyncElement,
    byId: ReadonlyMap<string, SyncElement>,
): string | null {
    if (element.type !== 'text') return null;

    if (isManagedElement(element) && element.customData.role === 'label') {
        return element.customData.mindmapNodeId;
    }

    if (!element.containerId) return null;
    const container = byId.get(element.containerId);
    if (!isManagedElement(container)) return null;
    return container.customData.mindmapNodeId;
}
