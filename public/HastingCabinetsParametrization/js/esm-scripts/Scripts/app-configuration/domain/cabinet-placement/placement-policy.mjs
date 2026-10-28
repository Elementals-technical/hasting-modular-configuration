import { isRecord, isFiniteVec3, reason, outcome } from './cabinet-contracts.mjs';

/**
 * Evaluate trusted adapter observations, NOT raw UI assertions.
 * Adapters own applicability, verified rule IDs, measurement and dependency stamps.
 * No geometric tolerance, contact kind or catalog row is invented here.
 */ function validatePlacement(input) {
    const checks = [];
    const add = (status, code, ids = [])=>checks.push({
            status,
            reason: reason(code, ids)
        });
    const finish = (coverPolicy)=>{
        const status = [
            'invalid',
            'unsupported',
            'pending'
        ].find((s)=>checks.some((c)=>c.status === s)) ?? 'valid';
        const reasons = checks.map((c)=>c.reason);
        return outcome(status, reasons, {
            requiredDecisionIds: [
                ...new Set(reasons.flatMap((r)=>r.decisionIds))
            ].sort(),
            coverPolicy
        });
    };
    if (!isRecord(input) || !isRecord(input.placement) || typeof input.compositionEmpty !== 'boolean') {
        add('invalid', 'INVALID_INPUT');
        return finish('unresolved');
    }
    const { catalog, placement: p } = input;
    if (![
        'standard',
        'remote'
    ].includes(p.mode) || ![
        'seed',
        'attached',
        'separate',
        'stacked'
    ].includes(p.classification) || typeof p.frameId !== 'string' || !p.frameId || !isFiniteVec3(p.positionM)) {
        add('invalid', 'INVALID_PLACEMENT');
        return finish('unresolved');
    }
    if (!catalog || ![
        'valid',
        'invalid',
        'pending',
        'unsupported'
    ].includes(catalog.status)) add('pending', 'CATALOG_NOT_READY');
    else if (catalog.status !== 'valid') add(catalog.status, 'CATALOG_NOT_READY', (catalog.reasons ?? []).flatMap((r)=>r.decisionIds ?? []));
    const role = catalog?.roleId;
    if (catalog?.status === 'valid' && ![
        'SB',
        'SC',
        'OS'
    ].includes(role)) add('unsupported', 'ROLE_UNSUPPORTED', [
        'Q-OSS'
    ]);
    if (input.compositionEmpty && ![
        'SB',
        'SC'
    ].includes(role)) add('invalid', 'SEED_ROLE_NOT_ALLOWED');
    if (role === 'SB' && p.mode === 'remote') add('invalid', 'SB_REMOTE_NOT_ALLOWED');
    if (p.classification === 'stacked') add('unsupported', 'STACK_UNRESOLVED', [
        'Q-STACK'
    ]);
    if (p.classification === 'seed' !== input.compositionEmpty || p.classification === 'seed' && p.mode !== 'standard' || p.mode === 'standard' && p.classification === 'separate') add('invalid', 'PLACEMENT_CLASS_MISMATCH');
    function ready(fact, label, { optional = false, gate = [] } = {}) {
        if (!isRecord(fact) || fact.status === 'pending') {
            add('pending', label + '_NOT_READY');
            return false;
        }
        if (fact.status === 'not-applicable' && optional) return false;
        if (fact.status === 'unsupported') {
            add('unsupported', label + '_UNSUPPORTED', fact.decisionIds?.length ? fact.decisionIds : gate);
            return false;
        }
        if (fact.status !== 'ready') {
            add('pending', label + '_NOT_READY');
            return false;
        }
        return true;
    }
    if (ready(input.collision, 'COLLISION')) {
        if (input.collision.basis !== 'prospective') add('pending', 'PROSPECTIVE_COLLISION_NOT_READY');
        else if (input.collision.intersects === true) add('invalid', 'COLLISION');
        else if (input.collision.intersects !== false) add('pending', 'COLLISION_NOT_READY');
    }
    for (const [key, gate] of [
        [
            'zones',
            'Q-ZONES'
        ],
        [
            'trap',
            'Q-TRAP'
        ]
    ]){
        if (ready(input[key], key.toUpperCase(), {
            optional: true,
            gate: [
                gate
            ]
        })) {
            if (input[key].intersects === true) add('invalid', key.toUpperCase() + '_COLLISION');
            else if (input[key].intersects !== false) add('pending', key.toUpperCase() + '_NOT_READY');
        }
    }
    if (ready(input.contact, 'CONTACT', {
        gate: [
            'Q-CONTACT'
        ]
    })) {
        const c = input.contact;
        if (typeof c.connected !== 'boolean') add('pending', 'CONTACT_NOT_READY');
        else if (p.classification === 'attached' && !c.connected) add('invalid', 'REQUIRED_CONTACT_MISSING');
        else if ([
            'seed',
            'separate'
        ].includes(p.classification) && c.connected) add('invalid', 'CONTACT_CLASS_MISMATCH');
        if (c.connected && (!Array.isArray(c.ruleIds) || !c.ruleIds.length || !c.ruleIds.every((id)=>typeof id === 'string' && id))) add('unsupported', 'CONTACT_RULE_UNRESOLVED', [
            'Q-CONTACT'
        ]);
    }
    if (ready(input.depth, 'DEPTH', {
        optional: true,
        gate: [
            'Q-DEPTH'
        ]
    })) {
        const d = input.depth;
        if (![
            'connected',
            'lower-remote'
        ].includes(d.relation) || !d.topId || !d.ruleId || ![
            d.cabinetM,
            d.topM,
            d.toleranceM
        ].every(Number.isFinite) || d.cabinetM <= 0 || d.topM <= 0 || d.toleranceM < 0) add('unsupported', 'DEPTH_ASSOCIATION_UNRESOLVED', [
            'Q-DEPTH'
        ]);
        else if (d.relation === 'connected' && Math.abs(d.cabinetM - d.topM) > d.toleranceM || d.relation === 'lower-remote' && d.cabinetM - d.topM > d.toleranceM) add('invalid', 'DEPTH_MISMATCH');
    }
    const coverPolicy = role === 'OS' && p.mode === 'remote' && p.classification === 'separate' ? 'none' : 'supports-minus-basin-coverage';
    if (role === 'OS' && p.classification === 'attached') add('unsupported', 'ATTACHED_OS_COVER_UNRESOLVED', [
        'Q-COVER-ADJACENCY'
    ]);
    if (coverPolicy !== 'none') ready(input.derived?.covers, 'COVER', {
        gate: [
            'PG-04'
        ]
    });
    ready(input.derived?.panels, 'PANEL', {
        optional: true,
        gate: [
            'Q-PANEL'
        ]
    });
    return finish(coverPolicy);
}

export { validatePlacement };
