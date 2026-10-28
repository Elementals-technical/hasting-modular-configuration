const error = (message)=>Object.assign(new TypeError(message), {
        code: 'CABINET_COVER_INVALID_INPUT'
    });
const optionsOf = (value)=>{
    if (value === undefined) return {};
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw error('options must be an object');
    const unknown = Object.keys(value).filter((key)=>key !== 'compositionId');
    if (unknown.length) throw error(`options: unknown key "${unknown[0]}"`);
    if (value.compositionId !== undefined && (typeof value.compositionId !== 'string' || !value.compositionId.trim())) {
        throw error('options.compositionId must be a nonempty string');
    }
    return value;
};
/** Small public facade for composition-owned derived cabinet covers. */ class CabinetCoverPlugin {
    static create(context) {
        return new CabinetCoverPlugin(context);
    }
    destroy() {
        this._destroyed = true;
        this._app = null;
    }
    _adapter() {
        return this._app?.compositionManager?.cabinetCoverCompositionAdapter ?? null;
    }
    _require() {
        if (this._destroyed) throw error('cabinetCover facade is destroyed');
        const adapter = this._adapter();
        if (!adapter) throw error('cabinetCover is not ready');
        return adapter;
    }
    constructor({ app } = {}){
        this._app = app ?? null;
        this._destroyed = false;
        this.api = Object.freeze({
            configure: (settings, options)=>{
                const adapter = this._require();
                return adapter.configure(settings, optionsOf(options));
            },
            getState: (options)=>{
                const input = optionsOf(options);
                return this._adapter()?.getState(input.compositionId) ?? Object.freeze({
                    compositionId: input.compositionId ?? null,
                    activeCompositionId: null,
                    settings: null,
                    service: null,
                    serviceOwnsRequestedComposition: false
                });
            },
            whenSettled: ()=>this._require().whenSettled()
        });
    }
}

export { CabinetCoverPlugin };
