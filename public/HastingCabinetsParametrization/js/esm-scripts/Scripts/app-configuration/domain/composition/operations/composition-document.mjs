import { isRecord, cloneData, outcome, reason, isFiniteVec3 } from '../../cabinet-placement/cabinet-contracts.mjs';
import { resolveConnectionGroups } from '../../cabinet-placement/connection-resolver.mjs';

const id = (v)=>typeof v === 'string' && v.trim().length > 0;
const fail = (code, path = '', status = 'invalid')=>{
    throw {
        code,
        path,
        status
    };
};
const exact = (value, fields, path)=>{
    if (!isRecord(value) || Object.keys(value).some((k)=>!fields.includes(k)) || fields.some((k)=>!Object.hasOwn(value, k))) {
        fail('INVALID_DOCUMENT_SHAPE', path);
    }
};
const vec = (value, path)=>{
    exact(value, [
        'x',
        'y',
        'z'
    ], path);
    if (!isFiniteVec3(value)) fail('INVALID_POSITION', path);
};
const dot = (a, b)=>a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b)=>({
        x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x
    });
const near = (a, b)=>Math.abs(a - b) <= 1e-9; // Coordinate-basis arithmetic, not a contact tolerance.
/** Validate source-only documents before allocating a scene.
 * This structural/catalog check does not replace prospective geometric restore validation.
 * Subsystem validators must be synchronous pure functions over JSON payloads.
 */ function createCompositionDocumentCodec({ catalog, catalogVersion, policyVersion, collectionId = 'ULH', allowedLayoutPolicies = [], allowedConnectionRules = [], validateConnection = null, sourceValidators = {}, validateFeatureSettings = (settings)=>Object.keys(settings).length === 0 } = {}) {
    if (!catalog || typeof catalog.resolveChoice !== 'function' || !id(collectionId) || !id(catalogVersion) || !id(policyVersion) || !Array.isArray(allowedLayoutPolicies) || !Array.isArray(allowedConnectionRules) || !isRecord(sourceValidators) || typeof validateFeatureSettings !== 'function') throw new TypeError('Invalid document codec ports');
    const layoutPolicies = new Set(allowedLayoutPolicies), rules = cloneData(allowedConnectionRules);
    const validators = {
        ...sourceValidators
    };
    function validate(input) {
        try {
            const d = cloneData(input);
            if (!isRecord(d)) fail('INVALID_DOCUMENT_SHAPE');
            if (d.schemaVersion !== 1) fail('DOCUMENT_VERSION_UNSUPPORTED', 'schemaVersion', 'unsupported');
            exact(d, [
                'schemaVersion',
                'id',
                'collection',
                'frames',
                'cabinets',
                'connections',
                'localLayouts',
                'primarySources',
                'featureSettings'
            ], '');
            if (!id(d.id)) fail('INVALID_DOCUMENT_ID', 'id');
            exact(d.collection, [
                'id',
                'catalogVersion',
                'policyVersion'
            ], 'collection');
            if (d.collection.id !== collectionId || d.collection.catalogVersion !== catalogVersion || d.collection.policyVersion !== policyVersion) {
                fail('COLLECTION_VERSION_UNSUPPORTED', 'collection', 'unsupported');
            }
            for (const field of [
                'frames',
                'cabinets',
                'connections',
                'localLayouts',
                'primarySources'
            ]){
                if (!Array.isArray(d[field])) fail('INVALID_DOCUMENT_SHAPE', field);
                const ids = new Set();
                for (const item of d[field]){
                    if (!isRecord(item) || !id(item.id) || ids.has(item.id)) fail('DUPLICATE_OR_INVALID_ID', field);
                    ids.add(item.id);
                }
            }
            const frames = new Map(d.frames.map((f)=>[
                    f.id,
                    f
                ]));
            for (const f of d.frames){
                exact(f, [
                    'id',
                    'originM',
                    'xAxis',
                    'yAxis',
                    'zAxis'
                ], 'frames');
                for (const key of [
                    'originM',
                    'xAxis',
                    'yAxis',
                    'zAxis'
                ])vec(f[key], 'frames.' + key);
                const axes = [
                    f.xAxis,
                    f.yAxis,
                    f.zAxis
                ];
                if (!axes.every((a)=>near(dot(a, a), 1)) || !near(dot(f.xAxis, f.yAxis), 0) || !near(dot(f.xAxis, f.zAxis), 0) || !near(dot(f.yAxis, f.zAxis), 0) || !near(dot(cross(f.xAxis, f.yAxis), f.zAxis), 1)) fail('INVALID_FRAME', 'frames');
            }
            const cabinets = new Map(d.cabinets.map((c)=>[
                    c.id,
                    c
                ]));
            for (const c of d.cabinets){
                exact(c, [
                    'id',
                    'definitionId',
                    'selection',
                    'roleId',
                    'placementMode',
                    'frameId',
                    'positionM'
                ], 'cabinets');
                if (!id(c.definitionId) || !isRecord(c.selection) || !frames.has(c.frameId) || ![
                    'standard',
                    'remote'
                ].includes(c.placementMode)) fail('INVALID_CABINET', 'cabinets');
                vec(c.positionM, 'cabinets.positionM');
                const choice = catalog.resolveChoice(c);
                if (choice.status !== 'valid') fail('CATALOG_CONFIGURATION_' + String(choice.status).toUpperCase(), 'cabinets.selection', choice.status === 'invalid' ? 'invalid' : 'unsupported');
                if (choice.roleId !== c.roleId) fail('ROLE_MISMATCH', 'cabinets.roleId');
            }
            const membership = new Set();
            for (const layout of d.localLayouts){
                exact(layout, [
                    'id',
                    'kind',
                    'frameId',
                    'anchorPositionM',
                    'orderedCabinetIds',
                    'policyId'
                ], 'localLayouts');
                if (layout.kind !== 'standard-run' || !frames.has(layout.frameId) || !Array.isArray(layout.orderedCabinetIds) || !layout.orderedCabinetIds.length) fail('INVALID_LAYOUT', 'localLayouts');
                if (!layoutPolicies.has(layout.policyId)) fail('LAYOUT_POLICY_UNSUPPORTED', 'localLayouts.policyId', 'unsupported');
                vec(layout.anchorPositionM, 'localLayouts.anchorPositionM');
                for (const cabinetId of layout.orderedCabinetIds){
                    const c = cabinets.get(cabinetId);
                    if (!c || membership.has(cabinetId) || c.frameId !== layout.frameId || c.placementMode !== 'standard') {
                        fail('INVALID_LAYOUT_MEMBERSHIP', 'localLayouts.orderedCabinetIds');
                    }
                    membership.add(cabinetId);
                }
            }
            if (d.cabinets.some((c)=>c.placementMode === 'standard' && !membership.has(c.id))) fail('MISSING_STANDARD_LAYOUT', 'localLayouts');
            for (const connection of d.connections){
                exact(connection, [
                    'id',
                    'a',
                    'b',
                    'kind',
                    'ruleId'
                ], 'connections');
                for (const ref of [
                    connection.a,
                    connection.b
                ]){
                    exact(ref, [
                        'cabinetId',
                        'surfaceId'
                    ], 'connections.surface');
                    if (!cabinets.has(ref.cabinetId) || !id(ref.surfaceId)) fail('INVALID_CONNECTION_REFERENCE', 'connections');
                }
                if (cabinets.get(connection.a.cabinetId).frameId !== cabinets.get(connection.b.cabinetId).frameId) {
                    fail('CROSS_FRAME_CONTACT_UNSUPPORTED', 'connections', 'unsupported');
                }
            }
            const grouped = resolveConnectionGroups({
                cabinetIds: [
                    ...cabinets.keys()
                ],
                connections: d.connections,
                allowedRules: rules
            });
            if (grouped.status !== 'valid') fail('CONNECTION_RULE_UNSUPPORTED', 'connections', grouped.status);
            if (d.connections.length && (typeof validateConnection !== 'function' || d.connections.some((c)=>validateConnection(c, d) !== true))) fail('CONNECTION_SURFACE_UNSUPPORTED', 'connections', 'unsupported');
            for (const source of d.primarySources){
                exact(source, [
                    'id',
                    'subsystem',
                    'schemaVersion',
                    'cabinetReferences',
                    'payload'
                ], 'primarySources');
                if (cabinets.has(source.id) || !Array.isArray(source.cabinetReferences) || new Set(source.cabinetReferences).size !== source.cabinetReferences.length || source.cabinetReferences.some((ref)=>!cabinets.has(ref)) || !isRecord(source.payload)) {
                    fail('INVALID_PRIMARY_SOURCE', 'primarySources');
                }
                const validator = Object.hasOwn(validators, source.subsystem) ? validators[source.subsystem] : null;
                if (!validator || validator.schemaVersion !== source.schemaVersion || typeof validator.validate !== 'function') {
                    fail('SOURCE_SUBSYSTEM_UNSUPPORTED', 'primarySources', 'unsupported');
                }
                if (validator.validate(source.payload, d) !== true) fail('INVALID_SOURCE_PAYLOAD', 'primarySources.payload');
            }
            if (!isRecord(d.featureSettings)) fail('INVALID_FEATURE_SETTINGS', 'featureSettings');
            if (validateFeatureSettings(d.featureSettings, d) !== true) fail('FEATURE_SETTINGS_UNSUPPORTED', 'featureSettings', 'unsupported');
            return outcome('valid', [], {
                document: d
            });
        } catch (error) {
            return outcome(error?.status ?? 'invalid', [
                reason(error?.code ?? 'INVALID_DOCUMENT', [], {
                    path: error?.path ?? ''
                })
            ]);
        }
    }
    return Object.freeze({
        validate
    });
}

export { createCompositionDocumentCodec };
