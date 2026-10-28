/** Розміри дільників (в см) */ const DIVIDER_WIDTHS = {
    'A': 13.5,
    'B': 17.1,
    'C': 22.1
};
/** Внутрішня ширина шухляди залежно від ширини фасаду (в см) */ const DRAWER_INNER_WIDTHS = {
    25: 15.32,
    35: 25.32,
    50: 40.32,
    60: 50.32,
    70: 60.32,
    80: 70.32,
    90: 80.32,
    105: 95.32,
    120: 110.32
};
/** Глобальні параметри системи */ const SYSTEM_PARAMS = {
    SIPHON_WIDTH: 15.3,
    SPACING: 0.5,
    MIN_SLOT_WIDTH: 13.5 // Мінімальне місце для Ghost-слота
};
/** Стратегії вирівнювання */ const ALIGNMENT_STRATEGIES = {
    PACKED: 'packed',
    EDGES_LEFT: 'edges-left',
    EDGES_RIGHT: 'edges-right'
};
/** Типи конфігурацій тумби */ const CABINET_CONFIG_TYPES = {
    STANDARD_WIDTH_SIPHON: 'STANDARD_WIDTH_SIPHON',
    STANDARD_FULL: 'STANDARD_FULL'
};
const DATA_DRAWER_PARAMS = {
    Top: {
        configType: CABINET_CONFIG_TYPES.STANDARD_WIDTH_SIPHON,
        nodeDrawer: 'TopDrawerDividers',
        point: "TopDrawer_Point",
        scenePrefix: 'Top',
        structureStoreDrawer: {
            zones: {
                siphon_left: {
                    slots: [],
                    alignment: 'edges-left'
                },
                siphon_right: {
                    slots: [],
                    alignment: 'edges-right'
                }
            },
            zonesPolicy: {
                alignment: 'space-between'
            }
        }
    },
    Bot: {
        configType: CABINET_CONFIG_TYPES.STANDARD_FULL,
        nodeDrawer: 'BotDrawerDividers',
        point: "BotDrawer_Point",
        scenePrefix: 'Bot',
        structureStoreDrawer: {
            zones: {
                main: {
                    slots: [],
                    alignment: 'packed'
                }
            },
            zonesPolicy: {
                alignment: 'single-zone'
            }
        }
    },
    TopFull: {
        configType: CABINET_CONFIG_TYPES.STANDARD_FULL,
        nodeDrawer: 'TopDrawerDividers',
        point: "TopDrawer_Point",
        scenePrefix: 'Top',
        structureStoreDrawer: {
            zones: {
                main: {
                    slots: [],
                    alignment: 'packed'
                }
            },
            zonesPolicy: {
                alignment: 'single-zone'
            }
        }
    }
};

export { ALIGNMENT_STRATEGIES, CABINET_CONFIG_TYPES, DATA_DRAWER_PARAMS, DIVIDER_WIDTHS, DRAWER_INNER_WIDTHS, SYSTEM_PARAMS };
