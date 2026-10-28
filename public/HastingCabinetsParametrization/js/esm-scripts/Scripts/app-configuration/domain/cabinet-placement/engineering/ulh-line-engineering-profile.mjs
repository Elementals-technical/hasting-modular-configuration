import { createCatalogResolver } from '../catalog-resolver.mjs';
import { createCompositionDocumentCodec } from '../../composition/operations/composition-document.mjs';
import { canonicalKey, reason, isFiniteVec3, cloneData } from '../cabinet-contracts.mjs';
import { translateEngineeringBox, engineeringBoxesOverlap } from './ulh-engineering-profile.mjs';
import { isCabinetCoverProduct, resolveBasinTopProduct } from '../../countertop/countertop-role.mjs';

const LINE_ENGINEERING_COLLECTION = 'ULH-LINE-ENGINEERING';
const LINE_ENGINEERING_CHOICE = {
    definitionId: 'TEST-SC',
    selection: {
        widthCm: 60
    }
};
const version = 'line-engineering-v1', layoutPolicy = 'line-engineering-horizontal-v1';
const marker = {
    engineeringOnly: true,
    productionEligible: false
};
const frame = {
    id: 'world',
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
const record = (value)=>value !== null && typeof value === 'object' && !Array.isArray(value);
const plainConfig = (snapshot)=>{
    const config = cloneData(snapshot);
    // Legacy position fields represent pre-offset layout state. The adopted document
    // uses the actual entity world pose; the scene projection writes that pose afresh.
    for (const field of [
        'positionX',
        'positionY',
        'positionZ',
        'SpatialOffsetM'
    ])delete config[field];
    return config;
};
const exactSC = (config)=>config?.productType === 'ULH-side-cabinet' && config?.category === 'cabinets' && [
        60,
        80
    ].includes(config.Width) && config.Height === 28 && config.Depth === 46 && config.Handle === 'handle_urban_topcut' && config.Drawers === '1DW';
const coverSettingKeys = new Set([
    'enabled',
    'profileId',
    'eligibilityMode',
    'materialId',
    'thicknessM',
    'tolerances'
]);
const knownCoverSettings = (settings)=>record(settings) && typeof settings.enabled === 'boolean' && Object.keys(settings).every((key)=>coverSettingKeys.has(key)) && (!Object.hasOwn(settings, 'tolerances') || record(settings.tolerances) && Object.keys(settings.tolerances).every((key)=>[
            'contactM',
            'adjacencyM',
            'numericalM'
        ].includes(key) && Number.isFinite(settings.tolerances[key]) && settings.tolerances[key] >= 0));
/** Pure, deliberately narrow migration of the approved SC engineering sample.
 * Existing IDs are catalog definition IDs, so each choice retains its original
 * functional configuration instead of relying on a lossy width-only mapping.
 */ function createSCLineEngineeringProfile({ source, readCurrentDocument = null } = {}) {
    const saved = source?.serialized, products = source?.products, entities = source?.entities;
    const primaryProducts = record(products) ? Object.entries(products).filter(([, snapshot])=>!isCabinetCoverProduct(snapshot)) : [];
    const basin = resolveBasinTopProduct(products);
    if (typeof source?.compositionId !== 'string' || !source.compositionId || saved?.compositionId !== source.compositionId || !record(products) || !record(saved.products) || !Array.isArray(entities) || !entities.length || !record(saved.features) || Object.keys(saved.features).some((key)=>key !== 'cabinetCover') || Object.hasOwn(saved.features, 'cabinetCover') && !knownCoverSettings(saved.features.cabinetCover) || !record(saved.sceneEntities) || Object.keys(saved.sceneEntities).length || saved.cabinetDocument || !record(saved.orderProductIds) || Object.keys(saved.orderProductIds).some((id)=>!Object.hasOwn(products, id)) || Object.keys(products).length !== entities.length || primaryProducts.length !== Object.keys(saved.products).length || primaryProducts.some(([id])=>!Object.hasOwn(saved.products, id)) || basin.status === 'ambiguous') throw fail('LINE_CASE_UNSUPPORTED');
    const seen = new Set(), legacy = [];
    let legacyTop = null;
    for (const item of entities){
        if (!item || typeof item.id !== 'string' || !item.id || seen.has(item.id) || !Object.hasOwn(products, item.id) || !record(products[item.id]) || !isFiniteVec3(item.positionM) || item.enabled !== true || !record(item.rotation) || ![
            'x',
            'y',
            'z',
            'w'
        ].every((k)=>Number.isFinite(item.rotation[k])) || !isFiniteVec3(item.localScale) || Math.abs(item.rotation.x) > 1e-8 || Math.abs(item.rotation.y) > 1e-8 || Math.abs(item.rotation.z) > 1e-8 || Math.abs(item.rotation.w - 1) > 1e-8 || [
            'x',
            'y',
            'z'
        ].some((k)=>Math.abs(item.localScale[k] - 1) > 1e-8)) throw fail('LINE_CASE_UNSUPPORTED');
        seen.add(item.id);
        if (isCabinetCoverProduct(products[item.id])) {
            if (Object.hasOwn(products[item.id], 'CountertopRole') && products[item.id].CountertopRole !== 'cabinetCover' || Object.hasOwn(saved.products, item.id) || Object.hasOwn(saved.orderProductIds, item.id)) throw fail('LINE_CASE_UNSUPPORTED');
            continue;
        }
        if (!Object.hasOwn(saved.products, item.id) || !record(saved.products[item.id]) || canonicalKey(products[item.id]) !== canonicalKey(saved.products[item.id])) throw fail('LINE_CASE_UNSUPPORTED');
        if (item.id === basin.productId) {
            if (products[item.id].productType !== 'Top_Solid' || products[item.id].category !== 'countertops' || products[item.id].generatedBy !== undefined) throw fail('LINE_CASE_UNSUPPORTED');
            legacyTop = {
                id: item.id,
                config: cloneData(products[item.id]),
                positionM: cloneData(item.positionM)
            };
            continue;
        }
        if (!exactSC(products[item.id])) throw fail('LINE_CASE_UNSUPPORTED');
        legacy.push({
            id: item.id,
            definitionId: `LEGACY-SC:${item.id}`,
            selection: {},
            config: plainConfig(products[item.id]),
            positionM: cloneData(item.positionM)
        });
    }
    if (seen.size !== Object.keys(products).length || !legacy.length || Boolean(legacyTop) !== (basin.status === 'found') || (legacyTop ? !Array.isArray(source.topSupportCabinetIds) || new Set(source.topSupportCabinetIds).size !== source.topSupportCabinetIds.length || source.topSupportCabinetIds.some((id)=>!legacy.some((item)=>item.id === id)) : source.topSupportCabinetIds !== undefined)) throw fail('LINE_CASE_UNSUPPORTED');
    const primarySourceTemplate = legacyTop ? {
        id: legacyTop.id,
        subsystem: 'basinTop',
        schemaVersion: '1',
        cabinetReferences: cloneData(source.topSupportCabinetIds),
        payload: {
            productType: 'Top_Solid',
            config: cloneData(legacyTop.config),
            positionM: cloneData(legacyTop.positionM)
        }
    } : null;
    const attachedTop = Boolean(primarySourceTemplate?.cabinetReferences.length);
    const featureSettings = {
        ...marker,
        ...Object.hasOwn(saved.features, 'cabinetCover') ? {
            cabinetCover: cloneData(saved.features.cabinetCover)
        } : {}
    };
    const definitions = [
        {
            definitionId: 'TEST-SC',
            roleId: 'SC',
            fields: [
                'widthCm'
            ]
        },
        ...legacy.map(({ definitionId })=>({
                definitionId,
                roleId: 'SC',
                fields: []
            }))
    ];
    const rows = [
        60,
        80
    ].map((widthCm)=>({
            id: `LINE-ENGINEERING-SC-${widthCm}`,
            definitionId: 'TEST-SC',
            verified: true,
            selection: {
                widthCm
            },
            runtime: {
                productType: 'ULH-side-cabinet',
                config: {
                    Width: widthCm,
                    Height: 28,
                    Depth: 46,
                    Handle: 'handle_urban_topcut',
                    Drawers: '1DW'
                }
            }
        }));
    for (const item of legacy)rows.push({
        id: `LINE-ENGINEERING-${item.definitionId}`,
        definitionId: item.definitionId,
        verified: true,
        selection: {},
        runtime: {
            productType: 'ULH-side-cabinet',
            config: item.config
        }
    });
    const resolver = createCatalogResolver({
        collectionId: LINE_ENGINEERING_COLLECTION,
        definitions,
        rows
    }, {
        isSelectionAllowed: ()=>true
    });
    const catalog = {
        ...resolver,
        getCatalog: ()=>resolver.getCatalog().filter((d)=>d.definitionId === 'TEST-SC').map((d)=>({
                    ...d,
                    label: 'TEST SC — engineering geometry'
                })),
        getDefinition: (id)=>id === 'TEST-SC' ? resolver.getDefinition(id) : null,
        getConfigurationOptions: (request)=>request?.definitionId === 'TEST-SC' ? resolver.getConfigurationOptions(request) : {
                definitionId: request?.definitionId ?? '',
                selection: {},
                completeness: 'invalid',
                fields: [],
                reasons: [
                    reason('LINE_LEGACY_CHOICE_NOT_ADDABLE')
                ]
            }
    };
    let trustedMovePayload = null, trustedPresetReset = false;
    const structuralCodec = createCompositionDocumentCodec({
        catalog,
        collectionId: LINE_ENGINEERING_COLLECTION,
        catalogVersion: version,
        policyVersion: version,
        allowedLayoutPolicies: [
            layoutPolicy
        ],
        sourceValidators: primarySourceTemplate ? {
            basinTop: {
                schemaVersion: '1',
                validate: (payload)=>{
                    const current = readCurrentDocument?.()?.primarySources?.find((item)=>item.id === primarySourceTemplate.id);
                    return canonicalKey(payload) === canonicalKey(primarySourceTemplate.payload) && (!current?.payload?.stationarySurface || trustedPresetReset) || trustedMovePayload && canonicalKey(payload) === canonicalKey(trustedMovePayload) || current?.payload?.stationarySurface && canonicalKey(payload) === canonicalKey(current.payload);
                }
            }
        } : {},
        validateFeatureSettings: (s)=>canonicalKey(s) === canonicalKey(featureSettings)
    });
    const validateBorrowed = (input, { allowRetirement = false } = {})=>{
        const checked = structuralCodec.validate(input);
        if (checked.status !== 'valid') return checked;
        const cabinets = new Map(checked.document.cabinets.map((c)=>[
                c.id,
                c
            ]));
        const current = readCurrentDocument?.();
        const activeIds = new Set(current?.cabinets?.filter((c)=>c.definitionId.startsWith('LEGACY-SC:')).map((c)=>c.id) ?? legacy.map((c)=>c.id));
        if (!allowRetirement && legacy.some(({ id, definitionId, positionM })=>activeIds.has(id) && (cabinets.get(id)?.definitionId !== definitionId || Object.keys(cabinets.get(id)?.selection ?? {}).length || canonicalKey(cabinets.get(id)?.positionM ?? null) !== canonicalKey(current?.cabinets?.find((item)=>item.id === id)?.positionM ?? positionM))) || checked.document.cabinets.some((c)=>c.definitionId.startsWith('LEGACY-SC:') && (!activeIds.has(c.id) || !legacy.some((item)=>item.id === c.id && item.definitionId === c.definitionId)))) return {
            status: 'unsupported',
            reasons: [
                reason('LINE_LEGACY_RESTORE_UNSUPPORTED')
            ]
        };
        const sources = checked.document.primarySources;
        const stationary = Boolean(current?.primarySources?.find((s)=>s.id === primarySourceTemplate?.id)?.payload?.stationarySurface);
        const mustKeepTop = primarySourceTemplate && checked.document.cabinets.length && (allowRetirement || attachedTop || current == null || current?.primarySources?.some((s)=>s.id === primarySourceTemplate.id));
        if (primarySourceTemplate ? sources.length !== (mustKeepTop ? 1 : 0) || sources.length && (sources[0].id !== primarySourceTemplate.id || !stationary && Boolean(sources[0].cabinetReferences.length) !== attachedTop || !stationary && sources[0].cabinetReferences.some((id)=>{
            const cabinet = cabinets.get(id);
            return cabinet.definitionId === 'TEST-SC' && cabinet.placementMode !== 'standard';
        })) : sources.length) return {
            status: 'unsupported',
            reasons: [
                reason('LINE_PRIMARY_SOURCE_UNSUPPORTED')
            ]
        };
        return checked;
    };
    const codec = {
        validate: (input)=>validateBorrowed(input),
        validateMove: (input, { before, productId, expected } = {})=>{
            if (!before || typeof productId !== 'string' || !expected || canonicalKey(input) !== canonicalKey(expected) || canonicalKey(readCurrentDocument?.() ?? initialDocument) !== canonicalKey(before)) return {
                status: 'unsupported',
                reasons: [
                    reason('LINE_MOVE_DOCUMENT_UNTRUSTED')
                ]
            };
            const prior = before.cabinets.find((item)=>item.id === productId);
            const next = input.cabinets?.find((item)=>item.id === productId);
            if (!prior || !next || canonicalKey({
                ...prior,
                positionM: null,
                placementMode: null
            }) !== canonicalKey({
                ...next,
                positionM: null,
                placementMode: null
            }) || before.cabinets.length !== input.cabinets.length || before.cabinets.some((item)=>item.id !== productId && canonicalKey(item) !== canonicalKey(input.cabinets.find((nextItem)=>nextItem.id === item.id))) || !isFiniteVec3(next.positionM)) return {
                status: 'unsupported',
                reasons: [
                    reason('LINE_MOVE_DOCUMENT_UNTRUSTED')
                ]
            };
            trustedMovePayload = input.primarySources?.find((item)=>item.id === primarySourceTemplate?.id)?.payload ?? null;
            try {
                return structuralCodec.validate(input);
            } finally{
                trustedMovePayload = null;
            }
        },
        validatePreset: (input)=>{
            let checked;
            trustedPresetReset = true;
            try {
                checked = validateBorrowed(input, {
                    allowRetirement: true
                });
            } finally{
                trustedPresetReset = false;
            }
            if (checked.status !== 'valid') return checked;
            return checked.document.cabinets.some((c)=>c.definitionId !== 'TEST-SC') ? {
                status: 'unsupported',
                reasons: [
                    reason('LINE_PRESET_UNSUPPORTED')
                ]
            } : checked;
        }
    };
    const initialDocument = {
        schemaVersion: 1,
        id: source.compositionId,
        collection: {
            id: LINE_ENGINEERING_COLLECTION,
            catalogVersion: version,
            policyVersion: version
        },
        frames: [
            cloneData(frame)
        ],
        cabinets: legacy.map(({ id, definitionId, selection, positionM })=>({
                id,
                definitionId,
                selection,
                roleId: 'SC',
                placementMode: 'remote',
                frameId: 'world',
                positionM
            })),
        connections: [],
        localLayouts: [],
        primarySources: primarySourceTemplate ? [
            cloneData(primarySourceTemplate)
        ] : [],
        featureSettings: cloneData(featureSettings)
    };
    if (codec.validate(initialDocument).status !== 'valid') throw fail('LINE_CASE_UNSUPPORTED');
    let presetId = 0;
    const configKeys = [
        'Width',
        'Height',
        'Depth',
        'Handle',
        'Drawers'
    ];
    const mapChoice = (type, config)=>{
        if (type !== 'ULH-side-cabinet' || !record(config) || Object.keys(config).length !== configKeys.length || Object.keys(config).some((key)=>!configKeys.includes(key)) || ![
            60,
            80
        ].includes(config.Width) || config.Height !== 28 || config.Depth !== 46 || config.Handle !== 'handle_urban_topcut' || config.Drawers !== '1DW') throw fail('LINE_CONFIGURATION_UNSUPPORTED');
        return {
            definitionId: 'TEST-SC',
            selection: {
                widthCm: config.Width
            }
        };
    };
    const buildPresetDocument = async (items, globalConfig, current, measureChoice)=>{
        if (!Array.isArray(items) || !record(current) || typeof measureChoice !== 'function' || globalConfig != null && !record(globalConfig)) throw fail('LINE_CONFIGURATION_UNSUPPORTED');
        // Validate the complete batch before measuring or allocating a scene root.
        const choices = items.map((item)=>{
            if (!record(item) || item.name !== 'ULH-side-cabinet') throw fail('LINE_CONFIGURATION_UNSUPPORTED');
            const { name, ...config } = item;
            return mapChoice(name, {
                ...globalConfig ?? {},
                ...config
            });
        });
        const boxes = [];
        for (const choice of choices){
            const box = await measureChoice(choice);
            if (!box || ![
                'x',
                'y',
                'z'
            ].every((axis)=>Number.isFinite(box.min?.[axis]) && Number.isFinite(box.max?.[axis]) && box.max[axis] > box.min[axis])) throw fail('GEOMETRY_PENDING');
            boxes.push(box);
        }
        const document = cloneData(current);
        document.cabinets = [];
        document.connections = [];
        document.localLayouts = [];
        document.primarySources = [];
        document.featureSettings = cloneData(featureSettings);
        let x = 0;
        for(let index = 0; index < choices.length; index++){
            if (index) x += boxes[index - 1].max.x - boxes[index].min.x;
            let id;
            do {
                id = `line-engineering-preset-${++presetId}`;
            }while (current.cabinets?.some((c)=>c.id === id))
            document.cabinets.push({
                ...choices[index],
                id,
                roleId: 'SC',
                placementMode: 'standard',
                frameId: 'world',
                positionM: {
                    x,
                    y: legacy[0].positionM.y,
                    z: 0
                }
            });
        }
        if (document.cabinets.length) document.localLayouts.push({
            id: `layout-${document.cabinets[0].id}`,
            kind: 'standard-run',
            frameId: 'world',
            anchorPositionM: cloneData(document.cabinets[0].positionM),
            orderedCabinetIds: document.cabinets.map((c)=>c.id),
            policyId: layoutPolicy
        });
        if (primarySourceTemplate && document.cabinets.length) document.primarySources.push({
            ...cloneData(primarySourceTemplate),
            cabinetReferences: attachedTop ? document.cabinets.map((c)=>c.id) : []
        });
        const checked = codec.validatePreset(document);
        if (checked.status !== 'valid') throw fail('LINE_PRESET_UNSUPPORTED');
        return {
            document: checked.document
        };
    };
    const resolvePrimarySource = (sourceRecord, document)=>{
        const payload = sourceRecord?.payload;
        const fixed = payload?.stationarySurface;
        const { stationarySurface: _stationary, ...basePayload } = record(payload) ? payload : {};
        const fixedPayload = record(payload) && canonicalKey(basePayload) === canonicalKey(primarySourceTemplate?.payload ?? null) && record(fixed?.basinTop) && isFiniteVec3(fixed?.rootPositionM) && [
            'xMinM',
            'xMaxM',
            'yBottomM',
            'zMinM',
            'zMaxM'
        ].every((key)=>Number.isFinite(fixed.basinTop[key]));
        if (!primarySourceTemplate || sourceRecord?.id !== primarySourceTemplate.id || sourceRecord?.subsystem !== 'basinTop' || sourceRecord?.schemaVersion !== '1' || canonicalKey(sourceRecord.payload) !== canonicalKey(primarySourceTemplate.payload) && canonicalKey(sourceRecord.payload) !== canonicalKey(readCurrentDocument?.()?.primarySources?.find((item)=>item.id === sourceRecord.id)?.payload) && !fixedPayload) throw fail('LINE_PRIMARY_SOURCE_UNSUPPORTED');
        return {
            id: sourceRecord.id,
            productType: 'Top_Solid',
            config: cloneData(sourceRecord.payload.config),
            positionM: cloneData(sourceRecord.payload.stationarySurface?.rootPositionM ?? sourceRecord.payload.positionM),
            frame: cloneData(document.frames[0])
        };
    };
    return Object.freeze({
        collectionId: LINE_ENGINEERING_COLLECTION,
        catalog,
        codec,
        initialDocument,
        primarySourceTemplate: cloneData(primarySourceTemplate),
        resolvePrimarySource,
        compatibility: {
            mapChoice,
            buildPresetDocument
        },
        legacyConfigs: new Map([
            ...legacy,
            ...legacyTop ? [
                legacyTop
            ] : []
        ].map(({ id, config })=>[
                id,
                cloneData(config)
            ]))
    });
}
const impact = ()=>({
        added: [],
        updatedProductIds: [],
        removedProductIds: [],
        derivedChanges: [],
        requiresAcknowledgement: false,
        token: null
    });
/** Placement uses the same AABB arithmetic as the private engineering fixture, but
 * the baseline and bounds are measured from the adopted roots in their real scene.
 */ function createSCLineEngineeringPlacement({ catalog, getBounds, measureChoice, baselineY, primarySourceTemplate = null }) {
    let nextId = 0;
    const choiceOf = (c)=>({
            definitionId: c.definitionId,
            selection: cloneData(c.selection)
        });
    const check = (choice, positionM, document, excludeId = null)=>{
        if (!isFiniteVec3(positionM)) return {
            status: 'invalid',
            reasons: [
                reason('INVALID_POSITION')
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
            if (cabinet.id === excludeId) continue;
            const other = getBounds(cabinet);
            if (!other) return {
                status: 'pending',
                reasons: [
                    reason('GEOMETRY_PENDING')
                ]
            };
            if (engineeringBoxesOverlap(target, translateEngineeringBox(other, cabinet.positionM))) return {
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
        if (resolved.status !== 'valid' || choice.definitionId !== 'TEST-SC') throw fail('LINE_LEGACY_CHOICE_NOT_ADDABLE');
        let id;
        do {
            id = `line-engineering-sc-${++nextId}`;
        }while (d.cabinets.some((c)=>c.id === id))
        d.cabinets.push({
            ...choiceOf(choice),
            id,
            roleId: 'SC',
            placementMode: placement.mode,
            frameId: 'world',
            positionM: cloneData(placement.positionM)
        });
        if (placement.mode === 'standard') {
            if (primarySourceTemplate?.cabinetReferences.length && !d.primarySources.length && !model.document.cabinets.length) d.primarySources.push({
                ...cloneData(primarySourceTemplate),
                cabinetReferences: [
                    id
                ]
            });
            else for (const source of d.primarySources){
                if (source.subsystem === 'basinTop' && source.cabinetReferences.includes(option?.anchorCabinetId)) source.cabinetReferences.push(id);
            }
            const run = d.localLayouts.find((l)=>option?.anchorCabinetId && l.orderedCabinetIds.includes(option.anchorCabinetId));
            if (run && option.kind === 'left' && run.orderedCabinetIds[0] === option.anchorCabinetId) run.orderedCabinetIds.unshift(id);
            else if (run && option.kind === 'right' && run.orderedCabinetIds.at(-1) === option.anchorCabinetId) run.orderedCabinetIds.push(id);
            else d.localLayouts.push({
                id: `layout-${id}`,
                kind: 'standard-run',
                frameId: 'world',
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
    const buildMoveDocument = (candidate, model)=>{
        const d = cloneData(model.document), index = d.cabinets.findIndex((item)=>item.id === candidate.productId);
        if (index < 0 || !isFiniteVec3(candidate.effectivePlacement?.positionM)) throw fail('UNKNOWN_CABINET');
        const existing = d.cabinets[index];
        if (existing.definitionId !== candidate.definitionId || canonicalKey(existing.selection) !== canonicalKey(candidate.selection)) throw fail('LINE_MOVE_CHOICE_MISMATCH');
        const positionM = candidate.effectivePlacement.positionM;
        if (canonicalKey(positionM) === canonicalKey(existing.positionM)) return {
            document: d,
            selectedCabinetId: existing.id
        };
        d.cabinets[index] = {
            ...existing,
            placementMode: 'remote',
            positionM: cloneData(positionM)
        };
        d.connections = d.connections.filter((item)=>!item.cabinetIds?.includes(existing.id) && item.leftCabinetId !== existing.id && item.rightCabinetId !== existing.id);
        d.localLayouts = d.localLayouts.flatMap((layout)=>{
            const at = layout.orderedCabinetIds.indexOf(existing.id);
            if (at < 0) return [
                layout
            ];
            const pieces = [
                layout.orderedCabinetIds.slice(0, at),
                layout.orderedCabinetIds.slice(at + 1)
            ].filter((ids)=>ids.length);
            return pieces.map((ids, i)=>({
                    ...layout,
                    id: i ? `${layout.id}-after-${existing.id}` : layout.id,
                    orderedCabinetIds: ids,
                    anchorPositionM: cloneData(d.cabinets.find((item)=>item.id === ids[0]).positionM)
                }));
        });
        return {
            document: d,
            selectedCabinetId: existing.id
        };
    };
    return {
        async enumerate (request, { model }) {
            const choice = choiceOf(request), resolved = catalog.resolveChoice(choice);
            if (choice.definitionId !== 'TEST-SC' || resolved.status !== 'valid') return [];
            const candidate = await measureChoice(choice), result = [];
            if (!model.document.cabinets.length) {
                const p = {
                    x: 0,
                    y: baselineY,
                    z: 0
                }, status = check(choice, p, model.document);
                result.push({
                    kind: 'seed',
                    mode: 'standard',
                    frameId: 'world',
                    positionM: p,
                    anchorCabinetId: null,
                    surfaceId: null,
                    availability: status.status === 'valid' ? 'available' : 'unsupported',
                    reasons: status.reasons,
                    impact: impact()
                });
            }
            for (const cabinet of model.document.cabinets){
                if (request.anchorCabinetId && cabinet.id !== request.anchorCabinetId) continue;
                const bounds = getBounds(cabinet);
                if (!bounds) continue;
                for (const [kind, x] of [
                    [
                        'left',
                        cabinet.positionM.x + bounds.min.x - candidate.max.x
                    ],
                    [
                        'right',
                        cabinet.positionM.x + bounds.max.x - candidate.min.x
                    ]
                ]){
                    const p = {
                        x,
                        y: cabinet.positionM.y,
                        z: cabinet.positionM.z
                    }, status = check(choice, p, model.document);
                    result.push({
                        kind,
                        mode: 'standard',
                        frameId: 'world',
                        positionM: p,
                        anchorCabinetId: cabinet.id,
                        surfaceId: null,
                        availability: status.status === 'valid' ? 'available' : 'unsupported',
                        reasons: status.reasons,
                        impact: impact()
                    });
                }
            }
            return result;
        },
        async evaluate (candidate, { model, resolveOption, kind }) {
            const moving = kind === 'move';
            if (moving) {
                const existing = model.document.cabinets.find((item)=>item.id === candidate.productId);
                if (!existing || existing.definitionId !== candidate.definitionId || canonicalKey(existing.selection) !== canonicalKey(candidate.selection)) return {
                    status: 'unsupported',
                    reasons: [
                        reason('LINE_MOVE_CHOICE_MISMATCH')
                    ]
                };
            } else if (candidate.definitionId !== 'TEST-SC') return {
                status: 'unsupported',
                reasons: [
                    reason('LINE_LEGACY_CHOICE_NOT_ADDABLE')
                ]
            };
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
            if (effective.frameId !== 'world') return {
                status: 'unsupported',
                reasons: [
                    reason('FRAME_UNSUPPORTED')
                ]
            };
            await measureChoice(choiceOf(candidate));
            return {
                ...check(candidate, effective.positionM, model.document, moving ? candidate.productId : null),
                effectivePlacement: effective,
                impact: impact()
            };
        },
        buildStandardDocument: (context, model)=>append(context.request, {
                mode: 'standard',
                positionM: context.option.positionM
            }, model, context.option),
        buildDraftDocument: (candidate, model)=>append(candidate, candidate.effectivePlacement, model),
        buildMoveDocument
    };
}

export { LINE_ENGINEERING_CHOICE, LINE_ENGINEERING_COLLECTION, createSCLineEngineeringPlacement, createSCLineEngineeringProfile };
