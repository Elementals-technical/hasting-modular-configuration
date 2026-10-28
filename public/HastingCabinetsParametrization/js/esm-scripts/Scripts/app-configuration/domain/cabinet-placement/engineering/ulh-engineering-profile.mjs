import { createCatalogResolver } from '../catalog-resolver.mjs';
import { createCompositionDocumentCodec } from '../../composition/operations/composition-document.mjs';
import { reason, cloneData, isFiniteVec3 } from '../cabinet-contracts.mjs';

const ENGINEERING_COLLECTION = 'ULH-ENGINEERING';
const ENGINEERING_NOTICE = 'ENGINEERING ONLY · SC/OS · template materials · no SB/cuts/covers/panels · NOT FOR ORDER';
const version = 'engineering-v1', layoutPolicy = 'engineering-horizontal-v1';
const marker = {
    engineeringOnly: true,
    productionEligible: false
};
const frame = {
    id: 'wall',
    originM: {
        x: 0,
        y: 0,
        z: 0
    },
    xAxis: {
        x: 1,
        y: 0,
        z: 0
    },
    yAxis: {
        x: 0,
        y: 1,
        z: 0
    },
    zAxis: {
        x: 0,
        y: 0,
        z: 1
    }
};
const fail = (code)=>Object.assign(new Error(code), {
        code
    });
const impact = ()=>({
        added: [],
        updatedProductIds: [],
        removedProductIds: [],
        derivedChanges: [],
        requiresAcknowledgement: false,
        token: null
    });
/** Synthetic geometry fixtures, NOT commercial rows. All identities and versions are
 * deliberately incompatible with production ULH. verified applies only to the local
 * fixture mapping; no SKU, finish, cover or manufacturing approval is implied.
 */ function createULHEngineeringProfile() {
    const definitions = [
        'SC',
        'OS'
    ].map((roleId)=>({
            definitionId: `TEST-${roleId}`,
            roleId,
            fields: [
                'widthCm',
                'heightCm'
            ]
        }));
    const rows = definitions.flatMap((d)=>(d.roleId === 'SC' ? [
            60,
            80
        ] : [
            35,
            60
        ]).flatMap((widthCm)=>[
                25,
                28,
                35,
                38
            ].map((heightCm)=>({
                    id: `ENGINEERING-${d.roleId}-${widthCm}-${heightCm}`,
                    definitionId: d.definitionId,
                    verified: true,
                    selection: {
                        widthCm,
                        heightCm
                    },
                    runtime: {
                        productType: d.roleId === 'SC' ? 'ULH-side-cabinet' : 'ULH-Open-Shelf',
                        config: {
                            Width: widthCm,
                            Height: heightCm,
                            Depth: 46,
                            ...d.roleId === 'SC' ? {
                                Handle: [
                                    28,
                                    38
                                ].includes(heightCm) ? 'handle_urban_topcut' : 'handle_pto',
                                Drawers: '1DW'
                            } : {}
                        }
                    }
                }))));
    const resolver = createCatalogResolver({
        collectionId: ENGINEERING_COLLECTION,
        definitions,
        rows
    }, {
        isSelectionAllowed: (_d, s)=>!Object.hasOwn(s, 'heightCm') || [
                25,
                28,
                35,
                38
            ].includes(s.heightCm)
    });
    const catalog = {
        ...resolver,
        getCatalog: ()=>resolver.getCatalog().map((d)=>({
                    ...d,
                    label: `TEST ${d.roleId} — geometry only`
                }))
    };
    const codec = createCompositionDocumentCodec({
        catalog,
        collectionId: ENGINEERING_COLLECTION,
        catalogVersion: version,
        policyVersion: version,
        allowedLayoutPolicies: [
            layoutPolicy
        ],
        validateFeatureSettings: (s)=>Object.keys(s).length === 2 && s.engineeringOnly === true && s.productionEligible === false
    });
    const initialDocument = {
        schemaVersion: 1,
        id: 'ulh-engineering',
        collection: {
            id: ENGINEERING_COLLECTION,
            catalogVersion: version,
            policyVersion: version
        },
        frames: [
            cloneData(frame)
        ],
        cabinets: [],
        connections: [],
        localLayouts: [],
        primarySources: [],
        featureSettings: {
            ...marker
        }
    };
    return {
        collectionId: ENGINEERING_COLLECTION,
        catalog,
        codec,
        initialDocument
    };
}
function translateEngineeringBox(box, p) {
    return {
        min: {
            x: box.min.x + p.x,
            y: box.min.y + p.y,
            z: box.min.z + p.z
        },
        max: {
            x: box.max.x + p.x,
            y: box.max.y + p.y,
            z: box.max.z + p.z
        }
    };
}
function engineeringBoxesOverlap(a, b) {
    // Numerical mesh arithmetic only, not an approved production contact tolerance.
    return [
        'x',
        'y',
        'z'
    ].every((k)=>Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k]) > 1e-6);
}
function createEngineeringPlacement({ catalog, measureChoice, getBounds }) {
    let nextId = 0;
    const choiceOf = (c)=>({
            definitionId: c.definitionId,
            selection: cloneData(c.selection)
        });
    const check = (choice, positionM, document)=>{
        if (!isFiniteVec3(positionM)) return {
            status: 'invalid',
            reasons: [
                reason('INVALID_POSITION')
            ]
        };
        if (!document.cabinets.length && catalog.resolveChoice(choice).roleId !== 'SC') return {
            status: 'invalid',
            reasons: [
                reason('SC_SEED_REQUIRED')
            ]
        };
        const bounds = getBounds(choice);
        if (!bounds) return {
            status: 'pending',
            reasons: [
                reason('GEOMETRY_PENDING')
            ]
        };
        const target = translateEngineeringBox(bounds, positionM);
        for (const cabinet of document.cabinets){
            const box = getBounds(cabinet);
            if (!box) return {
                status: 'pending',
                reasons: [
                    reason('GEOMETRY_PENDING')
                ]
            };
            if (engineeringBoxesOverlap(target, translateEngineeringBox(box, cabinet.positionM))) return {
                status: 'invalid',
                reasons: [
                    reason('CABINET_OVERLAP')
                ]
            };
        }
        return {
            status: 'valid',
            reasons: []
        };
    };
    const append = (choice, placement, model, option = null)=>{
        const d = cloneData(model.document), resolved = catalog.resolveChoice(choice);
        if (resolved.status !== 'valid') throw fail('INVALID_CONFIGURATION');
        let id;
        do {
            id = `engineering-cabinet-${++nextId}`;
        }while (d.cabinets.some((c)=>c.id === id))
        d.cabinets.push({
            ...choiceOf(choice),
            id,
            roleId: resolved.roleId,
            placementMode: placement.mode,
            frameId: 'wall',
            positionM: cloneData(placement.positionM)
        });
        if (placement.mode === 'standard') {
            const run = d.localLayouts.find((l)=>option?.anchorCabinetId && l.orderedCabinetIds.includes(option.anchorCabinetId));
            if (run && option.kind === 'left' && run.orderedCabinetIds[0] === option.anchorCabinetId) run.orderedCabinetIds.unshift(id);
            else if (run && option.kind === 'right' && run.orderedCabinetIds.at(-1) === option.anchorCabinetId) run.orderedCabinetIds.push(id);
            else d.localLayouts.push({
                id: `layout-${id}`,
                kind: 'standard-run',
                frameId: 'wall',
                anchorPositionM: cloneData(placement.positionM),
                orderedCabinetIds: [
                    id
                ],
                policyId: layoutPolicy
            });
        }
        return {
            document: d,
            selectedCabinetId: id
        };
    };
    return {
        async enumerate (request, { model }) {
            const choice = choiceOf(request), r = catalog.resolveChoice(choice);
            if (r.status !== 'valid') return [];
            if (!model.document.cabinets.length && r.roleId !== 'SC') return [];
            const b = await measureChoice(choice), result = [];
            const add = (kind, p, anchorCabinetId = null)=>{
                const status = check(choice, p, model.document);
                result.push({
                    kind,
                    mode: 'standard',
                    frameId: 'wall',
                    positionM: p,
                    anchorCabinetId,
                    surfaceId: null,
                    availability: status.status === 'valid' ? 'available' : 'unsupported',
                    reasons: status.reasons,
                    impact: impact()
                });
            };
            if (!model.document.cabinets.length) add('seed', {
                x: 0,
                y: 0,
                z: 0
            });
            for (const c of model.document.cabinets){
                if (request.anchorCabinetId && c.id !== request.anchorCabinetId) continue;
                const bounds = getBounds(c);
                if (!bounds) continue;
                add('left', {
                    ...c.positionM,
                    x: c.positionM.x + bounds.min.x - b.max.x
                }, c.id);
                add('right', {
                    ...c.positionM,
                    x: c.positionM.x + bounds.max.x - b.min.x
                }, c.id);
            }
            return result;
        },
        async evaluate (candidate, { model, resolveOption }) {
            if (!candidate.placement) return {
                status: 'pending',
                reasons: [
                    reason('POSITION_REQUIRED')
                ]
            };
            let effective, option = null;
            if (candidate.placement.kind === 'option') {
                option = resolveOption(candidate.placement.optionId, choiceOf(candidate)).option;
                effective = {
                    mode: 'standard',
                    frameId: option.frameId,
                    positionM: option.positionM
                };
            } else effective = {
                mode: 'remote',
                frameId: candidate.placement.frameId,
                positionM: candidate.placement.positionM
            };
            if (effective.frameId !== 'wall') return {
                status: 'unsupported',
                reasons: [
                    reason('FRAME_UNSUPPORTED')
                ]
            };
            await measureChoice(choiceOf(candidate));
            return {
                ...check(candidate, effective.positionM, model.document),
                effectivePlacement: effective,
                impact: impact()
            };
        },
        buildStandardDocument: (context, model)=>append(context.request, {
                mode: 'standard',
                positionM: context.option.positionM
            }, model, context.option),
        buildDraftDocument: (candidate, model)=>append(candidate, candidate.effectivePlacement, model)
    };
}

export { ENGINEERING_COLLECTION, ENGINEERING_NOTICE, createEngineeringPlacement, createULHEngineeringProfile, engineeringBoxesOverlap, translateEngineeringBox };
