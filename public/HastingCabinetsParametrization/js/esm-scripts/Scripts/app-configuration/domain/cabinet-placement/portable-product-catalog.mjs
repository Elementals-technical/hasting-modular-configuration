import { cloneData, isRecord, canonicalKey } from './cabinet-contracts.mjs';

const PORTABLE_DEFINITION = 'PORTABLE-RUNTIME-PRODUCT';
const volatileConfigFields = [
    'entityName',
    'productId',
    'positionX',
    'positionY',
    'positionZ',
    'SpatialOffsetM'
];
const fail = (code)=>{
    const error = new Error(code);
    error.code = code;
    throw error;
};
const snapshotKey = (runtime, roleId)=>canonicalKey({
        runtime,
        roleId
    });
/** Wrap the active catalog BEFORE constructing the document codec and scene
 * adapter. A saved preset carries the exact applied runtime config; the target
 * authorizes buildability with its own ProductFactory/rule pack. UI selection
 * policy remains outside this 3D replay catalog. */ function createPortableProductCatalogOverlay({ baseCatalog, canBuildRuntime } = {}) {
    if (!baseCatalog || typeof baseCatalog.resolveChoice !== 'function' || typeof canBuildRuntime !== 'function') throw new TypeError('Invalid portable catalog ports');
    const installed = new Map();
    const validRuntime = (runtime)=>isRecord(runtime) && typeof runtime.productType === 'string' && !!runtime.productType.trim() && isRecord(runtime.config);
    function authorize(runtime) {
        if (!validRuntime(runtime) || volatileConfigFields.some((field)=>Object.hasOwn(runtime.config, field)) || canBuildRuntime(cloneData(runtime)) !== true) fail('PRESET_PRODUCT_UNBUILDABLE');
    }
    const catalog = {
        resolveChoice (choice) {
            if (choice?.definitionId !== PORTABLE_DEFINITION) return baseCatalog.resolveChoice(choice);
            const selection = choice?.selection;
            if (!isRecord(selection) || Object.keys(selection).length !== 1 || typeof selection.snapshotKey !== 'string') return {
                status: 'invalid',
                reasons: []
            };
            const row = installed.get(selection.snapshotKey);
            return row ? {
                status: 'valid',
                roleId: row.roleId,
                runtime: cloneData(row.runtime),
                selection: cloneData(selection),
                rowId: selection.snapshotKey
            } : {
                status: 'unsupported',
                reasons: []
            };
        },
        getCatalog: (...args)=>baseCatalog.getCatalog(...args),
        getDefinition (id) {
            return id === PORTABLE_DEFINITION ? {
                definitionId: id,
                roleId: null,
                fields: [
                    'snapshotKey'
                ]
            } : baseCatalog.getDefinition(id);
        },
        getConfigurationOptions (request) {
            return request?.definitionId === PORTABLE_DEFINITION ? {
                definitionId: PORTABLE_DEFINITION,
                selection: {},
                completeness: 'invalid',
                fields: [],
                reasons: []
            } : baseCatalog.getConfigurationOptions(request);
        }
    };
    const ports = {
        isPortableChoice: (choice)=>choice?.definitionId === PORTABLE_DEFINITION && isRecord(choice.selection) && typeof choice.selection.snapshotKey === 'string',
        serializeChoice (cabinet, resolved) {
            const runtime = cloneData(resolved?.runtime);
            if (validRuntime(runtime)) for (const field of volatileConfigFields)delete runtime.config[field];
            authorize(runtime);
            const roleId = cabinet?.roleId;
            if (typeof roleId !== 'string' || !roleId) fail('PRESET_PRODUCT_UNBUILDABLE');
            return {
                definitionId: PORTABLE_DEFINITION,
                selection: {
                    snapshotKey: snapshotKey(runtime, roleId)
                },
                runtimeSnapshot: runtime
            };
        },
        installChoices (preset) {
            if (!Array.isArray(preset?.presetProducts)) fail('PRESET_INVALID_DOCUMENT');
            const candidates = new Map();
            for (const product of preset.presetProducts){
                if (product?.definitionId !== PORTABLE_DEFINITION || typeof product.roleId !== 'string' || !product.roleId || !validRuntime(product.runtimeSnapshot)) fail('PRESET_PRODUCT_UNBUILDABLE');
                const runtime = cloneData(product.runtimeSnapshot);
                authorize(runtime);
                const key = snapshotKey(runtime, product.roleId);
                if (product.selection?.snapshotKey !== key) fail('PRESET_PRODUCT_SNAPSHOT_MISMATCH');
                candidates.set(key, {
                    roleId: product.roleId,
                    runtime
                });
            }
            const added = [];
            for (const [key, row] of candidates)if (!installed.has(key)) {
                installed.set(key, row);
                added.push(key);
            }
            return ()=>{
                for (const key of added)installed.delete(key);
            };
        }
    };
    return Object.freeze({
        catalog: Object.freeze(catalog),
        ports: Object.freeze(ports)
    });
}

export { createPortableProductCatalogOverlay };
