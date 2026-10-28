/**
 * Placement packs of the Urban modular collections — DATA: ULH (Urban Low Height) and UD (Urban Duplex).
 * Both use the same Urban rules (URBAN_RULES below). A pack adds its product types -> roles and, when
 * needed, an override for that collection only. A change in URBAN_RULES changes BOTH collections.
 *
 * Rules reference checks from kernel/placement-checks.mjs by name and select cabinets by role or trait
 * (SB / SC / OS / OSS). Rule ids (HR-PL-NN) follow the rules manifest docs/rules-manifest.md.
 * Sources: Ryan 03.10.2026 (Block 2), given for ULH; UD uses them by analogy (Andriy 13.10).
 * Open questions stay `null` traits / `enabled:false` + decisionIds, never a guess.
 */ const URBAN_RULES = Object.freeze({
    schemaVersion: 1,
    traits: {
        // sink: has a basin; carriesCabinets: may something stand on it; countsAsCabinet: is it a cabinet
        // body for stacking rules. OS/OSS count as cabinets: no open shelf on or above a sink base (HR-PL-03, Andriy 13.10)
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
            countsAsCabinet: true
        },
        OSS: {
            sink: false,
            carriesCabinets: false,
            countsAsCabinet: true
        }
    },
    tolerances: {
        levelM: 0.005,
        contactM: 0.002,
        collisionM: 1e-4
    },
    // heightKey: cabinet height in cm on the product config; trap: sink trap keep-out, 6″ left/right and 8″ below the top
    geometry: {
        heightKey: 'Height',
        trap: {
            sideM: 0.1524,
            belowM: 0.2032
        }
    },
    rules: [
        {
            id: 'HR-PL-01',
            code: 'CABINET_COLLISION',
            check: 'collision',
            params: {
                counterpartType: 'cabinet'
            },
            source: 'Product rule 2026-09-29'
        },
        {
            id: 'HR-PL-10',
            code: 'COUNTERTOP_COLLISION',
            check: 'collision',
            params: {
                counterpartType: 'countertop'
            },
            source: 'Cabinet Placement Blocking; separate reason requested 2026-10-23'
        },
        {
            id: 'HR-PL-02',
            code: 'MAX_TIERS_EXCEEDED',
            check: 'maxStackDepth',
            params: {
                max: 2
            },
            source: 'Ryan 03.10: max 2 rows in all modes; CT is not a row',
            decisionIds: [
                'Q-HR-PL-02-SCOPE'
            ]
        },
        {
            id: 'HR-PL-03',
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
            source: 'Ryan 03.10: SB not on SB, SC not on/above SB (over any part of SB); OS/OSS too (Andriy 13.10)'
        },
        // The sink base is always on the highest level: no other cabinet or shelf, wherever it stands,
        // has its top above the SB's top (maxGapM null = whole composition). With HR-PL-03 an SB is only in the upper row.
        {
            id: 'HR-PL-04',
            code: 'SC_HIGHER_THAN_SB',
            check: 'higherThan',
            params: {
                subject: {
                    role: [
                        'SC',
                        'OS',
                        'OSS'
                    ]
                },
                reference: {
                    role: [
                        'SB'
                    ]
                },
                maxGapM: null
            },
            source: 'Ryan 03.10 Block 2 Q2: SC cannot be positioned higher than an SB; compare tops (Andriy 07.10); whole composition, SC/OS/OSS (Andriy 13.10)'
        },
        {
            id: 'HR-PL-05',
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
        // A sink base set apart from the others: a thin top is cloned onto it, a thick top is extended over it, so a
        // thick top needs every SB top at one level (Ryan 23.10 tandem vanities; Andriy 23.10).
        {
            id: 'HR-PL-11',
            code: 'SINK_BASE_TOPS_SPLIT',
            check: 'sameTopUnderThickTop',
            params: {
                select: {
                    trait: 'sink',
                    eq: true
                }
            },
            source: 'Ryan 23.10: remote tandem vanities; Andriy 23.10: a thick top extends over SBs at its level, another level is an error'
        },
        {
            id: 'HR-PL-06',
            code: 'TRAP_KEEPOUT',
            check: 'trapKeepOut',
            source: 'Ryan 03.10: 6″ L/R, 8″ V min under the trap'
        },
        // A second basin cut into a top by a sink base draft keeps the HR-CT-06 basin margins (Andriy 27.10).
        {
            id: 'HR-PL-12',
            code: 'BASIN_EDGE_TOO_CLOSE',
            check: 'basinClearance',
            params: {
                kind: 'edge'
            },
            source: 'R15.5 / Q0322: basin edge >= 10 cm from the top end (HR-CT-06); applied to a dropped SB (Andriy 27.10)'
        },
        {
            id: 'HR-PL-13',
            code: 'BASINS_TOO_CLOSE',
            check: 'basinClearance',
            params: {
                kind: 'gap'
            },
            source: 'Andriy 27.10: two basins in one top keep the sum of their HR-CT-06 margins between them'
        }
    ],
    messages: {
        CABINET_COLLISION: 'The cabinet overlaps another cabinet.',
        COUNTERTOP_COLLISION: 'The cabinet overlaps the countertop.',
        MAX_TIERS_EXCEEDED: 'Maximum {max} rows of cabinets.',
        NOTHING_ON_SINK_BASE: 'A {upperRole} cannot be placed on or above a {lowerRole}.',
        SINK_BASES_SPLIT: 'All sink bases must be in one row.',
        SC_HIGHER_THAN_SB: 'A {upperRole} cannot be positioned higher than a {lowerRole}.',
        SINK_BASE_TOPS_SPLIT: 'Sink bases under one countertop must be at the same height: their tops level with the countertop.',
        TRAP_KEEPOUT: 'A {role} cannot be placed in the trap clearance zone (6″ sides, 8″ below the countertop).',
        BASIN_EDGE_TOO_CLOSE: 'This {role}\'s basin would be too close to the end of the countertop: a basin needs at least {margin} from the end. Slide it about {distance} to the {direction}.',
        BASINS_TOO_CLOSE: 'This {role}\'s basin would be too close to the other basin in the countertop: they need at least {required} between them. Slide it about {distance} to the {direction}.',
        // A sink base in the zone (P210): the problem, then the fix. An SB may stand right under a sink and hold it.
        'TRAP_KEEPOUT.SB_BESIDE': 'This SB is in the sink trap clearance zone but not under the sink. To place it under the sink, slide it about {distance} to the {direction}. Otherwise keep it at least 6″ away from the trap.',
        'TRAP_KEEPOUT.SB_LEVEL': 'This SB is under the sink, but its top is {height} {above} the countertop, so the sink cannot sit in it. Place the SB so its top meets the underside of the countertop.',
        'TRAP_KEEPOUT.SB_BESIDE_LEVEL': 'This SB is in the sink trap clearance zone. To place it under the sink, slide it about {distance} to the {direction} and set its top level with the underside of the countertop. Otherwise keep it at least 6″ away from the trap.',
        'TRAP_KEEPOUT.SB_NEAR_HOSTED_SINK': 'This SB is too close to the sink of another SB. Keep it at least 6″ away from that sink\'s trap.'
    }
});
/** ULH: the Urban rules as they are. */ const ULH_PACK = Object.freeze({
    id: 'ULH',
    roles: {
        'ULH-sink-cabinet': 'SB',
        'ULH-side-cabinet': 'SC',
        'ULH-Open-Shelf': 'OS',
        'ULH-Side-Shelf': 'OSS'
    },
    ...URBAN_RULES
});
/**
 * UD: the Urban rules with ONE tier — no cabinet on another (Block 2 Q1; Andriy 13.10). Cabinets of
 * different heights (56 and 28) side by side in that tier are fine. UD has open shelves like ULH (OS / OSS), so it
 * keeps the traits of all four roles (a pack may declare traits only for its own roles, kernel/pack-schema.mjs).
 */ const ONE_TIER = (rule)=>rule.id === 'HR-PL-02' ? {
        ...rule,
        params: {
            max: 1
        },
        source: 'Block 2 Q1: UD does not stack; Andriy 13.10'
    } : rule;
const UD_PACK = Object.freeze({
    id: 'UD',
    roles: {
        'UD-sink-cabinet': 'SB',
        'UD-side-cabinet': 'SC',
        'UD-open-shelves': 'OS',
        'UD-open-shelves-side': 'OSS'
    },
    ...URBAN_RULES,
    traits: {
        SB: URBAN_RULES.traits.SB,
        SC: URBAN_RULES.traits.SC,
        OS: URBAN_RULES.traits.OS,
        OSS: URBAN_RULES.traits.OSS
    },
    // tierHeightM: height of the one UD tier, m (the tall 56 cm cabinet). Two cabinets one on another that touch
    // and together fit in it are a column — one place in the tier, not a second tier: [56][28 on 28][56] (Andriy 13.10).
    // Here it only makes the validator (maxStackDepth, HR-PL-02, kernel/placement-checks.mjs) count such a column as one
    // tier; without it (ULH) every cabinet on a cabinet starts a new tier. Columns themselves are switched on by
    // `columns: true` on the collection (modular-collections.mjs), which also reads this height as the row plane.
    geometry: {
        ...URBAN_RULES.geometry,
        tierHeightM: 0.56
    },
    rules: URBAN_RULES.rules.map(ONE_TIER),
    messages: {
        ...URBAN_RULES.messages,
        MAX_TIERS_EXCEEDED: 'Urban Duplex cabinets cannot be stacked.'
    }
});

export { UD_PACK, ULH_PACK };
