import { cloneData, canonicalKey, isRecord, freezeData } from '../cabinet-contracts.mjs';

const fields = [
    'widthCm',
    'heightCm',
    'depthCm',
    'handle',
    'finish'
];
const definitions = [
    {
        definitionId: 'ULH-sink-cabinet',
        roleId: 'SB',
        allowedSeed: true,
        widths: [
            60,
            70,
            80,
            90,
            105,
            120
        ]
    },
    {
        definitionId: 'ULH-side-cabinet',
        roleId: 'SC',
        allowedSeed: true,
        widths: [
            25,
            35,
            50,
            60,
            70,
            80,
            90,
            105,
            120
        ]
    },
    {
        definitionId: 'ULH-Open-Shelf',
        roleId: 'OS',
        allowedSeed: false,
        widths: [
            25,
            35,
            50,
            60,
            70,
            80,
            90,
            105,
            120
        ]
    },
    // A catalog identity only: no generic Side-Shelf runtime fallback.
    {
        definitionId: 'ULH-Side-Shelf',
        roleId: 'OSS',
        allowedSeed: false,
        widths: [
            15
        ],
        gate: 'Q-OSS'
    }
];
function isULHSelectionAllowed(definition, selection, { partial = false } = {}) {
    if (!isRecord(selection) || Object.keys(selection).some((k)=>!definition.fields.includes(k))) return false;
    if (!partial && definition.fields.some((k)=>!Object.hasOwn(selection, k))) return false;
    if (Object.values(selection).some((v)=>![
            'string',
            'number',
            'boolean'
        ].includes(typeof v) || typeof v === 'number' && !Number.isFinite(v))) return false;
    const { widthCm: w, heightCm: h, depthCm: d, handle } = selection;
    if (w !== undefined && !definition.widths.includes(w)) return false;
    if (h !== undefined && ![
        25,
        28,
        35,
        38
    ].includes(h)) return false;
    if (d !== undefined && ![
        46,
        50
    ].includes(d)) return false;
    if (selection.finish !== undefined && (typeof selection.finish !== 'string' || !selection.finish.trim())) return false;
    if (definition.roleId === 'OS') {
        if (handle !== undefined && handle !== 'none') return false;
        if ([
            35,
            38
        ].includes(h) && w > 70) return false;
    } else if (definition.roleId !== 'OSS') {
        if (handle !== undefined && ![
            'UG',
            'PTO'
        ].includes(handle)) return false;
        if (h !== undefined && handle !== undefined && !(handle === 'UG' ? [
            28,
            38
        ] : [
            25,
            35
        ]).includes(h)) return false;
    }
    return true;
}
/**
 * A trusted bootstrap input, never exposed as a UI setter.
 * Empty rows deliberately keep every known definition unsupported.
 * Optional extraFields allow full finish/facade dependencies without inventing SKUs.
 */ function createULHProfile({ rows = [], extraFields = [], catalogVersion = 'unverified', policyVersion = 'ulh-add-v1' } = {}) {
    if (!Array.isArray(rows) || !Array.isArray(extraFields) || extraFields.some((k)=>typeof k !== 'string' || !k || [
            '__proto__',
            'prototype',
            'constructor'
        ].includes(k)) || typeof catalogVersion !== 'string' || !catalogVersion || typeof policyVersion !== 'string' || !policyVersion) {
        throw new TypeError('Invalid ULH profile input');
    }
    const defs = definitions.map((def)=>({
            ...def,
            fields: [
                ...new Set([
                    ...fields,
                    ...extraFields
                ])
            ]
        }));
    const ids = new Set(), choices = new Set();
    const copied = cloneData(rows);
    for (const row of copied){
        const def = defs.find((d)=>d.definitionId === row.definitionId);
        if (!def || !isULHSelectionAllowed(def, row.selection)) throw new TypeError('Invalid catalog configuration');
        const key = canonicalKey({
            definitionId: row.definitionId,
            selection: row.selection
        });
        if (ids.has(row.id) || choices.has(key)) throw new TypeError('Duplicate catalog row');
        if (typeof row.id !== 'string' || !row.id) throw new TypeError('Missing catalog row identity');
        if (row.verified !== true && row.verified !== false) throw new TypeError('Explicit catalog verification required');
        if (row.verified && (typeof row.provenance !== 'string' || !row.provenance.trim())) throw new TypeError('Missing catalog provenance');
        if (row.runtime !== null && row.runtime !== undefined && (!isRecord(row.runtime) || row.runtime.productType !== def.definitionId || !isRecord(row.runtime.config))) {
            throw new TypeError('Invalid catalog runtime mapping');
        }
        ids.add(row.id);
        choices.add(key);
    }
    return freezeData({
        collectionId: 'ULH',
        catalogVersion,
        policyVersion,
        layoutStrategy: 'ulh-spatial',
        definitions: cloneData(defs),
        rows: copied
    });
}

export { createULHProfile, isULHSelectionAllowed };
