const LAME_UNDERTOP_PROFILE = Object.freeze({
    templateName: 'Lame_Undertop',
    meshName: 'Lame_Undertop',
    baseWidthM: 0.6,
    sidePanelsStretchM: 0.09,
    heightM: 0.02
});
const isLameCabinet = (config)=>[
        'Lame-sink-cabinet',
        'Lame-side-cabinet'
    ].includes(config?.productType);
const undertopEnabled = (value)=>value === 'Enable' || value === true;
/** One continuous slab for a row at a common height, measured in metres. */ function calculateLameUndertopLayout(items, hasSidePanels = false) {
    if (!items.length) return {
        status: 'empty'
    };
    const owner = items.find((item)=>undertopEnabled(item.ShowUndertop));
    if (!owner) return {
        status: 'empty'
    };
    if (items.some((item)=>![
            40,
            60,
            80,
            100,
            120
        ].includes(Number(item.Width)))) return {
        status: 'unsupported',
        reason: 'unsupported-width'
    };
    const height = Number(items[0].Height);
    if (![
        26,
        52
    ].includes(height) || items.some((item)=>Number(item.Height) !== height)) return {
        status: 'unsupported',
        reason: 'mixed-or-unsupported-heights'
    };
    if (items.some((item)=>Number(item.Depth) !== 52)) return {
        status: 'unsupported',
        reason: 'unsupported-depth'
    };
    const widthM = items.reduce((sum, item)=>sum + Number(item.Width) / 100, 0);
    return {
        status: 'ready',
        widthM,
        stretchX: widthM - 0.6 + (hasSidePanels ? 0.09 : 0),
        moveY: 0,
        owner
    };
}

export { LAME_UNDERTOP_PROFILE, calculateLameUndertopLayout, isLameCabinet, undertopEnabled };
