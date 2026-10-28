import { OUTLINE_SEMANTIC_STATE } from '../../scene/tools/outline-configuration.mjs';

const EDITING_INTERACTIONS = Object.freeze(new Set([
    'editing',
    'dragging'
]));
const SELECTED_INTERACTIONS = Object.freeze(new Set([
    'selected',
    'editing',
    'dragging'
]));
/**
 * Resolve only semantic overrides. Normal selected/unknown interaction keeps
 * the SelectTool's existing yellow selection style.
 */ function resolveCountertopOutlineState(state = {}) {
    const validationState = state?.validation?.state || 'unknown';
    const interactionState = state?.interactionState || 'idle';
    if (validationState === 'invalid') {
        return OUTLINE_SEMANTIC_STATE.INVALID;
    }
    if (validationState === 'valid' && EDITING_INTERACTIONS.has(interactionState)) {
        return OUTLINE_SEMANTIC_STATE.EDITING;
    }
    if (SELECTED_INTERACTIONS.has(interactionState)) {
        return OUTLINE_SEMANTIC_STATE.SELECTED;
    }
    return null;
}
/**
 * Maps the active countertop state into CT-14's existing scoped outline
 * controller. It never creates a renderer and never outlines assembly helpers.
 */ class CountertopOutlineAdapter {
    bind({ service = this._service, target = this._target } = {}) {
        if (this._destroyed) return;
        if (target !== this._target) {
            this._clearTarget(this._target);
            this._target = target || null;
        }
        if (service !== this._service) {
            this._unsubscribeService?.();
            this._unsubscribeService = null;
            this._service = service || null;
            if (this._service?.on) {
                this._unsubscribeService = this._service.on('change', (state)=>{
                    this.sync(state);
                });
            }
        }
        this._state = this._service?.getStateM?.() || this._state;
        this.sync();
    }
    sync(state = this._state) {
        if (this._destroyed) return null;
        if (state) this._state = state;
        const target = this._target;
        const selectTool = this._app?.selectTool;
        if (!target || !selectTool?.setEntitySemanticState) return null;
        const semanticState = resolveCountertopOutlineState(this._state);
        if (semanticState) {
            selectTool.setEntitySemanticState(target, semanticState);
        } else {
            selectTool.clearEntitySemanticState?.(target);
        }
        return this.getStatus();
    }
    refresh() {
        if (this._destroyed) return null;
        const status = this.sync();
        this._app?.selectTool?.refreshOutline?.();
        return status;
    }
    getStatus() {
        const selected = Boolean(this._target && this._app?.selectTool?.getSelected?.().includes(this._target));
        return Object.freeze({
            validationState: this._state?.validation?.state || 'unknown',
            interactionState: this._state?.interactionState || 'idle',
            semanticState: resolveCountertopOutlineState(this._state),
            selected
        });
    }
    destroy() {
        if (this._destroyed) return;
        this._destroyed = true;
        this._unsubscribeService?.();
        this._unsubscribeService = null;
        this._clearTarget(this._target);
        this._app?.off?.('select-tool:ready', this._onSelectToolReady, this);
        this._app?.off?.('selection:outline-cleared', this._onOutlineCleared, this);
        this._target = null;
        this._service = null;
        this._state = null;
        this._app = null;
    }
    _clearTarget(target) {
        if (target) this._app?.selectTool?.clearEntitySemanticState?.(target);
    }
    constructor(app, options = {}){
        this._app = app || null;
        this._service = null;
        this._target = null;
        this._state = null;
        this._unsubscribeService = null;
        this._destroyed = false;
        this._onSelectToolReady = ()=>this.sync();
        this._onOutlineCleared = ()=>this.sync();
        this._app?.on?.('select-tool:ready', this._onSelectToolReady, this);
        this._app?.on?.('selection:outline-cleared', this._onOutlineCleared, this);
        this.bind(options);
    }
}
function createCountertopOutlineAdapter(app, options) {
    return new CountertopOutlineAdapter(app, options);
}

export { CountertopOutlineAdapter, createCountertopOutlineAdapter, resolveCountertopOutlineState };
