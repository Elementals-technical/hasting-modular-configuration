/** Namespace mapping only. Readiness, identity and listener ownership live in the shared boundary. */
export function createCabinetPlacementNamespace(boundary) {
    return boundary.namespace({
        beginAdd: ['beginAdd', 'command'],
        beginMove: ['beginMove', 'command'],
        updateDraft: ['updateDraft', 'operation'],
        getState: ['getPlacementState', 'query'],
        ...(boundary.inputEnabled?{settleInput: ['settleInput', 'operation']}:{}),
        apply: ['apply', 'command'],
        cancel: ['cancel', 'operation']
    }, { change: 'placementChange', action: 'placementAction' });
}
