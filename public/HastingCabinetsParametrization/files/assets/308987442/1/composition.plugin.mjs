/** Restore is exposed only when its validated transactional service implementation exists. */
export function createCompositionNamespace(boundary) {
    return boundary.namespace({
        getState: ['getCompositionState', 'query'],
        exportSnapshot: ['exportSnapshot', 'query'],
        exportPreset: ['exportPreset', 'query'],
        exportCompactPreset: ['exportCompactPreset', 'query'],
        restoreSnapshot: ['restoreSnapshot', 'command'],
        importPreset: ['importPreset', 'command'],
        importCompactPreset: ['importCompactPreset', 'command'],
        getCommandResult: ['getCommandResult', 'query']
    }, { change: 'compositionChange' });
}
