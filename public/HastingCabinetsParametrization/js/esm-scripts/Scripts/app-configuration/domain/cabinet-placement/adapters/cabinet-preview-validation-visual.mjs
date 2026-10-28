/** Private presentation port for the isolated draft entity. The existing outline controller
 * owns the GPU resources and reduces owner contributions (invalid is red). Clearing this
 * owner's state never changes selection or any committed product material. */ function createCabinetPreviewValidationVisual({ selectTool } = {}) {
    if (typeof selectTool?.setEntitySemanticState !== 'function') {
        throw new TypeError('Cabinet preview validation requires semantic outline support');
    }
    const owner = 'cabinet-preview-validation';
    return Object.freeze({
        setValidation (entity, validation) {
            if (!entity) return;
            const state = [
                'invalid',
                'unsupported'
            ].includes(validation?.status) ? 'invalid' : null;
            selectTool.setEntitySemanticState(entity, {
                owner,
                state
            });
        }
    });
}

export { createCabinetPreviewValidationVisual };
