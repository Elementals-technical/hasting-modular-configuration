import { cloneData, freezeData, isFiniteVec3 } from '../cabinet-contracts.mjs';

const metadata = new WeakMap();
const vector = (value)=>{
    const plain = {
        x: value?.x,
        y: value?.y,
        z: value?.z
    };
    if (!isFiniteVec3(plain)) throw Object.assign(new Error('Invalid authored stretch settings'), {
        code: 'INVALID_TEMPLATE_GEOMETRY'
    });
    return plain;
};
/** Capture only authored geometry settings before removing template script components.
 * Weak ownership: no app, entity reference, listener or mutable material enters the snapshot.
 */ function captureTemplateGeometry(root) {
    const visit = (node)=>{
        const stretch = node.script?.smartStretch;
        metadata.set(node, freezeData({
            stretch: stretch ? {
                margin: vector(stretch.margin),
                stretchAmount: vector(stretch.stretchAmount)
            } : null,
            boolean: !!node.script?.meshBoolean
        }));
        for (const child of node.children ?? [])visit(child);
    };
    visit(root);
}
function readTemplateGeometry(node) {
    const value = metadata.get(node);
    return value ? cloneData(value) : null;
}

export { captureTemplateGeometry, readTemplateGeometry };
