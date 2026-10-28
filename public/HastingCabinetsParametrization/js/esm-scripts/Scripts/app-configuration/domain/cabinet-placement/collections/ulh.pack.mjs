/**
 * ULH placement pack — DATA. Rules reference checks from kernel/placement-checks.mjs by name and
 * select cabinets by role or trait. Rule ids follow the backlog (plans/backlog-block2-2026-10-05).
 * Sources: Ryan 03.10.2026 (Block 2). Open questions stay `null` traits / `enabled:false` + decisionIds,
 * never a guess.
 */ const ULH_PACK = Object.freeze({
    id: 'ULH',
    schemaVersion: 1,
    roles: {
        'ULH-sink-cabinet': 'SB',
        'ULH-side-cabinet': 'SC',
        'ULH-Open-Shelf': 'OS',
        'ULH-Side-Shelf': 'OSS'
    },
    traits: {
        // sink: has a basin; carriesCabinets: may something stand on it; countsAsCabinet: is it a cabinet
        // body for stacking rules (null = open question Q-V-11: may an open shelf sit on a sink base?)
        SB: {
            sink: true,
            carriesCabinets: false,
            countsAsCabinet: true
        },
        SC: {
            sink: false,
            carriesCabinets: true,
            countsAsCabinet: true
        },
        OS: {
            sink: false,
            carriesCabinets: true,
            countsAsCabinet: null
        },
        OSS: {
            sink: false,
            carriesCabinets: false,
            countsAsCabinet: null
        }
    },
    tolerances: {
        levelM: 0.005,
        contactM: 0.002,
        collisionM: 1e-4
    },
    // heightKey: body height in cm on the product config; trap: sink trap keep-out, 6″ left/right and 8″ below the top
    geometry: {
        heightKey: 'Height',
        trap: {
            sideM: 0.1524,
            belowM: 0.2032
        }
    },
    rules: [
        {
            id: 'V-01',
            code: 'CABINET_COLLISION',
            check: 'collision',
            source: 'Product rule 2026-09-29'
        },
        {
            id: 'V-10',
            code: 'MAX_TIERS_EXCEEDED',
            check: 'maxStackDepth',
            params: {
                max: 2
            },
            source: 'Ryan 03.10: max 2 rows in all modes; CT is not a row',
            decisionIds: [
                'Q-V10-SCOPE'
            ]
        },
        {
            id: 'V-11',
            code: 'NOTHING_ON_SINK_BASE',
            check: 'stackRelation',
            phase: 'veto',
            params: {
                upper: {
                    trait: 'countsAsCabinet',
                    eq: true
                },
                lower: {
                    trait: 'carriesCabinets',
                    eq: false
                },
                contact: 'any'
            },
            source: 'Ryan 03.10: SB not on SB, SC not on/above SB (V-11/12/13 over any part of SB)'
        },
        {
            id: 'V-13b',
            code: 'SC_HIGHER_THAN_SB',
            check: 'higherThan',
            params: {
                subject: {
                    role: [
                        'SC'
                    ]
                },
                reference: {
                    role: [
                        'SB'
                    ]
                },
                maxGapM: 0.01
            },
            source: 'Ryan 03.10 Block 2 Q2: SC cannot be positioned higher than an SB; compare tops (Andriy 07.10)'
        },
        {
            id: 'V-14',
            code: 'SINK_BASES_SPLIT',
            check: 'sameLevel',
            params: {
                select: {
                    trait: 'sink',
                    eq: true
                }
            },
            source: 'Ryan 03.10: all SB in one row'
        },
        {
            id: 'V-31a',
            code: 'TRAP_KEEPOUT',
            check: 'trapKeepOut',
            source: 'Ryan 03.10: 6″ L/R, 8″ V min under the trap'
        }
    ],
    messages: {
        CABINET_COLLISION: 'The cabinet overlaps another cabinet.',
        MAX_TIERS_EXCEEDED: 'Maximum {max} rows of cabinets.',
        NOTHING_ON_SINK_BASE: 'A {upperRole} cannot be placed on or above a {lowerRole}.',
        SINK_BASES_SPLIT: 'All sink bases must be in one row.',
        SC_HIGHER_THAN_SB: 'A {upperRole} cannot be positioned higher than a {lowerRole}.',
        TRAP_KEEPOUT: 'A {role} cannot be placed in the trap clearance zone (6″ sides, 8″ below the countertop).'
    }
});

export { ULH_PACK };
