
/** Розміри дільників (в см) */
export const DIVIDER_WIDTHS = {
    'A': 13.5,
    'B': 17.1,
    'C': 22.1
};

/** Внутрішня ширина шухляди залежно від ширини фасаду (в см) */
export const DRAWER_INNER_WIDTHS = {
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

/** Глобальні параметри системи */
export const SYSTEM_PARAMS = {
    SIPHON_WIDTH: 15.3,      // Ширина вирізу під сифон
    SPACING: 0.5,            // Відступ між елементами
    MIN_SLOT_WIDTH: 13.5     // Мінімальне місце для Ghost-слота
};

/** Стратегії вирівнювання */
export const ALIGNMENT_STRATEGIES = {
    PACKED: 'packed',           // Зліва направо
    EDGES_LEFT: 'edges-left',   // Притиснути вліво (для лівої зони сифона)
    EDGES_RIGHT: 'edges-right', // Притиснути вправо (для правої зони сифона)
};

/** Типи конфігурацій тумби */
export const CABINET_CONFIG_TYPES = {
    STANDARD_WIDTH_SIPHON: 'STANDARD_WIDTH_SIPHON',
    STANDARD_FULL: 'STANDARD_FULL',

};


export const DATA_DRAWER_PARAMS = {
    Top: {
        configType: CABINET_CONFIG_TYPES.STANDARD_WIDTH_SIPHON,
        nodeDrawer: 'TopDrawerDividers',
        point: "TopDrawer_Point",
        scenePrefix: 'Top',

        structureStoreDrawer: {
            zones: {
                siphon_left: {
                    slots: [],
                    alignment: 'edges-left',
                },
                siphon_right: {
                    slots: [],
                    alignment: 'edges-right',
                },
            },
            zonesPolicy: {
                alignment: 'space-between',
            },
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
                    alignment: 'packed',
                },
            },
            zonesPolicy: {
                alignment: 'single-zone',
            },
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
                    alignment: 'packed',
                },
            },
            zonesPolicy: {
                alignment: 'single-zone',
            },
        }
    },
}

