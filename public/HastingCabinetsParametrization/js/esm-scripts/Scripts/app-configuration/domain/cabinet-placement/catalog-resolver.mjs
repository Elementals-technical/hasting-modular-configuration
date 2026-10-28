import { cloneData, reason, isRecord, outcome } from './cabinet-contracts.mjs';
import { isULHSelectionAllowed } from './profiles/ulh-profile.mjs';

/** Resolve exact normalized rows. Dimension baselines alone never authorize a SKU. */ function createCatalogResolver(profile, { isSelectionAllowed = profile?.collectionId === 'ULH' ? isULHSelectionAllowed : null } = {}) {
    if (typeof profile?.collectionId !== 'string' || !profile.collectionId.trim() || !Array.isArray(profile.definitions) || !Array.isArray(profile.rows) || typeof isSelectionAllowed !== 'function') {
        throw new TypeError('Catalog profile and explicit selection policy required');
    }
    const pack = cloneData(profile);
    const find = (id)=>pack.definitions.find((d)=>d.definitionId === id);
    const rowsFor = (id)=>pack.rows.filter((row)=>row.definitionId === id);
    const matching = (row, selection, except = null)=>Object.entries(selection).every(([k, v])=>k === except || row.selection[k] === v);
    const ready = (row)=>row.verified === true && !!row.runtime;
    const rowReasons = (row)=>!row.verified ? [
            reason('CATALOG_UNVERIFIED', [
                'Q-CATALOG'
            ])
        ] : !row.runtime ? [
            reason('RUNTIME_MAPPING_UNRESOLVED', [
                'Q-DEPTH'
            ])
        ] : [];
    function inspect(request) {
        if (!isRecord(request)) return {
            result: outcome('invalid', [
                reason('INVALID_INPUT')
            ])
        };
        const { definitionId, selection } = request;
        const def = find(definitionId);
        if (!def || !isRecord(selection)) return {
            result: outcome('invalid', [
                reason('INVALID_INPUT')
            ])
        };
        if (Object.keys(selection).some((key)=>!def.fields.includes(key) || [
                '__proto__',
                'prototype',
                'constructor'
            ].includes(key)) || Object.values(selection).some((value)=>![
                'string',
                'number',
                'boolean'
            ].includes(typeof value) || typeof value === 'number' && !Number.isFinite(value)) || !isSelectionAllowed(def, selection, {
            partial: true
        })) {
            return {
                def,
                result: outcome('invalid', [
                    reason('CONFIGURATION_NOT_ALLOWED')
                ])
            };
        }
        if (def.gate) return {
            def,
            result: outcome('unsupported', [
                reason('ROLE_UNSUPPORTED', [
                    def.gate
                ])
            ])
        };
        const matches = rowsFor(definitionId).filter((row)=>matching(row, selection));
        const complete = def.fields.every((k)=>Object.hasOwn(selection, k));
        if (!complete) return {
            def,
            matches,
            result: outcome('pending', [
                reason('INCOMPLETE_CONFIGURATION')
            ])
        };
        const exact = matches[0];
        if (!exact) return {
            def,
            matches,
            result: outcome('unsupported', [
                reason('CATALOG_ROW_UNVERIFIED', [
                    'Q-CATALOG'
                ])
            ])
        };
        const reasons = rowReasons(exact);
        return {
            def,
            matches,
            result: reasons.length ? outcome('unsupported', reasons) : outcome('valid', [], {
                rowId: exact.id,
                roleId: def.roleId,
                selection: cloneData(selection),
                runtime: cloneData(exact.runtime)
            })
        };
    }
    return {
        getDefinition (id) {
            const def = find(id);
            return def ? cloneData(def) : null;
        },
        getCatalog () {
            return pack.definitions.map((def)=>({
                    definitionId: def.definitionId,
                    collectionId: pack.collectionId,
                    roleId: def.roleId,
                    label: def.roleId,
                    availability: !def.gate && rowsFor(def.definitionId).some(ready) ? 'available' : 'unsupported',
                    reasons: def.gate ? [
                        reason('ROLE_UNSUPPORTED', [
                            def.gate
                        ])
                    ] : rowsFor(def.definitionId).some(ready) ? [] : [
                        reason('CATALOG_UNVERIFIED', [
                            'Q-CATALOG'
                        ])
                    ]
                }));
        },
        resolveChoice (request) {
            return inspect(request).result;
        },
        getConfigurationOptions (request) {
            const { def, result } = inspect(request);
            if (!def || result.status === 'invalid') return {
                definitionId: typeof request?.definitionId === 'string' ? request.definitionId : '',
                selection: {},
                completeness: 'invalid',
                fields: [],
                reasons: result.reasons
            };
            const rows = rowsFor(def.definitionId);
            const options = def.fields.map((key)=>{
                const possible = rows.filter((row)=>matching(row, request.selection, key));
                const values = [
                    ...new Set(possible.map((row)=>row.selection[key]))
                ];
                return {
                    key,
                    label: key,
                    unit: key.endsWith('Cm') ? 'cm' : null,
                    required: true,
                    values: values.map((value)=>{
                        const variants = possible.filter((row)=>row.selection[key] === value);
                        const available = !def.gate && variants.some(ready);
                        return {
                            value,
                            availability: available ? 'available' : 'unsupported',
                            reasons: available ? [] : def.gate ? [
                                reason('ROLE_UNSUPPORTED', [
                                    def.gate
                                ])
                            ] : rowReasons(variants[0])
                        };
                    })
                };
            });
            return {
                definitionId: def.definitionId,
                selection: cloneData(request.selection),
                completeness: result.status === 'valid' ? 'complete' : result.status === 'invalid' ? 'invalid' : def.fields.every((k)=>Object.hasOwn(request.selection, k)) ? 'complete' : 'partial',
                fields: options,
                reasons: result.reasons
            };
        }
    };
}

export { createCatalogResolver };
