import { EXAMPLE_COMPACT_PRESET, UD_TEST_PRESETS } from './urban-duplex-presets.mjs';

const LOADER_PRODUCTS = 'products';
const LOADER_COMPACT = 'compact';
// --- Urban Low Height (ULH) ------------------------------------------------------------------------------
const ULH_SHARED = Object.freeze({
    Height: 38,
    Depth: 46,
    Handle: 'handle_urban_topcut',
    CabinetColor: 'Pulpis Chiaro TKH'
});
const ULH_CABINET_HEIGHT_CM = ULH_SHARED.Height;
// Two shapes of the same cabinets: a full item for presetProducts (carries the shared fields itself),
// and a compact row item (the shared fields come from the preset's `shared`).
function ulhSinkCabinet(Width = 60) {
    return {
        ...ULH_SHARED,
        ...ulhSinkRowItem(Width)
    };
}
function ulhSideCabinet(Width = 35) {
    return {
        ...ULH_SHARED,
        ...ulhSideRowItem(Width)
    };
}
function ulhOpenShelf(Width = 60) {
    return {
        name: 'ULH-Open-Shelf',
        Height: ULH_SHARED.Height,
        Depth: ULH_SHARED.Depth,
        CabinetColor: ULH_SHARED.CabinetColor,
        Width
    };
}
function ulhSinkRowItem(Width) {
    return {
        name: 'ULH-sink-cabinet',
        Width,
        sinkType: 'Top_HPLPrisma'
    };
}
function ulhSideRowItem(Width) {
    return {
        name: 'ULH-side-cabinet',
        Width
    };
}
/**
 * A ULH compact preset; its rows hold compact row items.
 * ulhRows([{ products: [ulhSideRowItem(35)] }]) → { format: 'ulh-compact-v1', collection: 'ULH', shared, rows, top }.
 */ function ulhRows(rows, { withCountertop = true } = {}) {
    const preset = {
        format: 'ulh-compact-v1',
        collection: 'ULH',
        shared: {
            ...ULH_SHARED
        },
        rows
    };
    if (withCountertop) preset.top = {
        productType: 'Top_Solid'
    };
    return preset;
}
/** Rows inside one row are laid with this gap (CABINET_LAYOUT_GAP_METERS = 0.5 mm), so a flush upper row adds it per cabinet. */ const ROW_GAP_CM = 0.05;
const ULH_PRESETS = [
    {
        id: 'ulh-sb',
        title: 'SB 60',
        loader: LOADER_PRODUCTS,
        payload: [
            ulhSinkCabinet(60)
        ]
    },
    {
        id: 'ulh-sb-sc',
        title: 'SB 60 + SC 35',
        loader: LOADER_PRODUCTS,
        payload: [
            ulhSinkCabinet(60),
            ulhSideCabinet(35)
        ]
    },
    {
        id: 'ulh-sc-sb-sc',
        title: 'SC 35 + SB 60 + SC 35',
        loader: LOADER_PRODUCTS,
        payload: [
            ulhSideCabinet(35),
            ulhSinkCabinet(60),
            ulhSideCabinet(35)
        ]
    },
    {
        id: 'ulh-sb-sc-sb',
        title: 'SB 60 + SC 60 + SB 60',
        loader: LOADER_PRODUCTS,
        payload: [
            ulhSinkCabinet(60),
            ulhSideCabinet(60),
            ulhSinkCabinet(60)
        ]
    },
    {
        id: 'ulh-sb-os',
        title: 'SB 60 + OS 60',
        loader: LOADER_PRODUCTS,
        payload: [
            ulhSinkCabinet(60),
            ulhOpenShelf(60)
        ]
    },
    // Two groups on one level with a gap between them: four exposed edges (two face the gap).
    {
        id: 'ulh-two-groups',
        title: '2 rows · gap · [SC SB] … [SC SC] · both → 4 panels',
        loader: LOADER_COMPACT,
        payload: ulhRows([
            {
                products: [
                    ulhSideRowItem(35),
                    ulhSinkRowItem(60)
                ]
            },
            {
                offsetX: 200,
                products: [
                    ulhSideRowItem(50),
                    ulhSideRowItem(35)
                ]
            }
        ])
    },
    // Three groups: the middle one has both of its edges facing a gap.
    {
        id: 'ulh-three-groups',
        title: '3 rows · gaps · [SC] … [SB SC] … [SC] · both → 6 panels',
        loader: LOADER_COMPACT,
        payload: ulhRows([
            {
                products: [
                    ulhSideRowItem(35)
                ]
            },
            {
                offsetX: 100,
                products: [
                    ulhSinkRowItem(60),
                    ulhSideRowItem(35)
                ]
            },
            {
                offsetX: 250,
                products: [
                    ulhSideRowItem(50)
                ]
            }
        ])
    },
    // A stack with flush ends: the upper row stands on the lower one (elevation = lower Height). One panel per row and side.
    {
        id: 'ulh-stack-flush',
        title: 'Stack · 2 over 2 · flush ends · both → 4 panels',
        loader: LOADER_COMPACT,
        payload: ulhRows([
            {
                products: [
                    ulhSideRowItem(50),
                    ulhSideRowItem(50)
                ]
            },
            {
                offsetX: 0,
                elevation: ULH_CABINET_HEIGHT_CM,
                products: [
                    ulhSideRowItem(50),
                    ulhSideRowItem(50)
                ]
            }
        ], {
            withCountertop: false
        })
    },
    // A stack whose lower row sticks out on the left: the upper-left edge is exposed above the lower row.
    {
        id: 'ulh-stack-lower-longer',
        title: 'Stack · lower row longer on the left · both → 4 panels',
        loader: LOADER_COMPACT,
        payload: ulhRows([
            {
                products: [
                    ulhSideRowItem(35),
                    ulhSideRowItem(50),
                    ulhSideRowItem(50)
                ]
            },
            {
                offsetX: 35 + ROW_GAP_CM,
                elevation: ULH_CABINET_HEIGHT_CM,
                products: [
                    ulhSideRowItem(50),
                    ulhSideRowItem(50)
                ]
            }
        ], {
            withCountertop: false
        })
    }
];
// --- Urban Duplex (UD): one tier with columns, compact presets only --------------------------------------
/** A UD manufacturer case by id; a renamed id fails with its name instead of breaking the whole panel import. */ function udCase(id) {
    const entry = UD_TEST_PRESETS.find((candidate)=>candidate.id === id);
    if (!entry) throw new Error(`collection-presets: no UD test preset "${id}"`);
    return entry.preset;
}
const UD_PRESETS = [
    {
        id: 'ud-row-56',
        title: '56 sink · side · sink (one row)',
        loader: LOADER_COMPACT,
        payload: udCase('case4')
    },
    {
        id: 'ud-columns',
        title: '56 · column 28/28 · 56',
        loader: LOADER_COMPACT,
        payload: EXAMPLE_COMPACT_PRESET
    },
    {
        id: 'ud-shifted-column',
        title: 'Shifted column + lone bottom',
        loader: LOADER_COMPACT,
        payload: udCase('case1')
    }
];
// --- Single-row collections (presetProducts only) --------------------------------------------------------
// Every preset carries CabinetColor: without it the materials fall back and the UF cover plan is rejected (missing-ulh-cabinet-color).
const URBAN_STANDARD = Object.freeze({
    Height: 56,
    Depth: 46,
    Drawers: '2D',
    CabinetColor: 'Ardesia TKF'
});
const URBAN_STANDARD_PRESETS = [
    {
        id: 'ush-sb',
        title: 'Sink-Base 60',
        loader: LOADER_PRODUCTS,
        payload: [
            {
                name: 'Sink-Base',
                ...URBAN_STANDARD,
                Width: 60,
                sinkType: 'Top_HPLPrisma'
            }
        ]
    },
    {
        id: 'ush-sc-sb-os',
        title: 'Sink-Cabinet 35 + Sink-Base 60 + Open-Shelf 50',
        loader: LOADER_PRODUCTS,
        payload: [
            {
                name: 'Sink-Cabinet',
                ...URBAN_STANDARD,
                Width: 35
            },
            {
                name: 'Sink-Base',
                ...URBAN_STANDARD,
                Width: 60,
                sinkType: 'Top_HPLPrisma'
            },
            {
                name: 'Open-Shelf',
                Height: URBAN_STANDARD.Height,
                Depth: URBAN_STANDARD.Depth,
                CabinetColor: URBAN_STANDARD.CabinetColor,
                Width: 50
            }
        ]
    }
];
/**
 * Two presets for a collection whose types are `<prefix>-sink-cabinet` / `<prefix>-side-cabinet`.
 * sinkAndSidePresets('Mako', { Height: 52 }) → ids 'mako-sb' and 'mako-sc-sb-sc'.
 */ function sinkAndSidePresets(prefix, shared) {
    const sink = (Width)=>({
            name: `${prefix}-sink-cabinet`,
            ...shared,
            Width,
            sinkType: 'Top_HPLPrisma'
        });
    const side = (Width)=>({
            name: `${prefix}-side-cabinet`,
            ...shared,
            Width
        });
    const idPrefix = prefix.toLowerCase();
    return [
        {
            id: `${idPrefix}-sb`,
            title: 'Sink 60',
            loader: LOADER_PRODUCTS,
            payload: [
                sink(60)
            ]
        },
        {
            id: `${idPrefix}-sc-sb-sc`,
            title: 'Side 40 + Sink 60 + Side 40',
            loader: LOADER_PRODUCTS,
            payload: [
                side(40),
                sink(60),
                side(40)
            ]
        }
    ];
}
const CLASS_PRESETS = sinkAndSidePresets('Class', {
    Height: 52,
    Depth: 52,
    Drawers: '2D',
    CabinetColor: 'Antracite Matte OCF'
});
const MAKO_PRESETS = sinkAndSidePresets('Mako', {
    Height: 52,
    Depth: 52,
    HandleStyle: 'G57',
    CabinetColor: 'Antracite Matte OCF'
});
const URBAN_FREESTANDING = Object.freeze({
    Depth: 50,
    CabinetColor: 'Cemento Cenere 1A1'
});
const ufSink = (Height, Width = 60)=>({
        name: 'UF-sink-cabinet',
        ...URBAN_FREESTANDING,
        Height,
        Width,
        sinkType: 'Top_HPLPrisma'
    });
const ufSide = (Height, Width = 60)=>({
        name: 'UF-side-cabinet',
        ...URBAN_FREESTANDING,
        Height,
        Width
    });
// Side panel joints (NEW sheet A152:J159): the taller cabinet gets a joint strip on the face toward the shorter one.
const URBAN_FREESTANDING_PRESETS = [
    ...sinkAndSidePresets('UF', {
        Height: 91,
        ...URBAN_FREESTANDING
    }),
    {
        id: 'uf-joint-88-53',
        title: 'Sink 88 + Side 53 · joint 88+53 · both → 3 panels',
        loader: LOADER_PRODUCTS,
        payload: [
            ufSink(88),
            ufSide(53)
        ]
    },
    {
        id: 'uf-joint-91-56',
        title: 'Sink 91 + Side 56 · joint 91+56 · both → 3 panels',
        loader: LOADER_PRODUCTS,
        payload: [
            ufSink(91),
            ufSide(56)
        ]
    },
    {
        id: 'uf-joint-unknown',
        title: 'Sink 91 + Side 53 · pair not in the guide · both → 2 panels',
        loader: LOADER_PRODUCTS,
        payload: [
            ufSink(91),
            ufSide(53)
        ]
    }
];
const TRICOT_PRESETS = sinkAndSidePresets('Tricot', {
    Height: 40,
    Depth: 52,
    Drawers: '2D',
    CabinetColor: 'Antracite Matte OCF',
    CabinetPattern: 'Satin'
});
// --- All collections ---------------------------------------------------------------------------------------
const PRESET_COLLECTIONS = Object.freeze([
    {
        id: 'ULH',
        title: 'Urban Low Height',
        presets: ULH_PRESETS
    },
    {
        id: 'UD',
        title: 'Urban Duplex',
        presets: UD_PRESETS
    },
    {
        id: 'URBAN',
        title: 'Urban Standard Height',
        presets: URBAN_STANDARD_PRESETS
    },
    {
        id: 'CLASS',
        title: 'Class',
        presets: CLASS_PRESETS
    },
    {
        id: 'MAKO',
        title: 'Mako',
        presets: MAKO_PRESETS
    },
    {
        id: 'UF',
        title: 'Urban Freestanding',
        presets: URBAN_FREESTANDING_PRESETS
    },
    {
        id: 'TRICOT',
        title: 'Tricot',
        presets: TRICOT_PRESETS
    }
]);
/** Every preset with its collection id, in display order. */ const PRESETS = Object.freeze(PRESET_COLLECTIONS.flatMap((collection)=>collection.presets.map((preset)=>Object.freeze({
            ...preset,
            collection: collection.id
        }))));

export { LOADER_COMPACT, LOADER_PRODUCTS, PRESETS, PRESET_COLLECTIONS };
