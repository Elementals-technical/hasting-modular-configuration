import {
    DATA_DRAWER_PARAMS,
    DIVIDER_WIDTHS,
    SYSTEM_PARAMS,
    DRAWER_INNER_WIDTHS
} from './divider.constants.mjs';

/**
 * DividerDefinitions
 * * Архітектурний шар (Abstraction Layer) для доступу до статичних конфігурацій.
 * Цей клас слугує єдиним джерелом правди про параметри системи.
 * * Всі запити на отримання розмірів, налаштувань зон або типів конфігурацій
 * повинні проходити через цей файл, а не звертатися до constants напряму.
 */


export class DividerDefinitions {
    static getDividers() {

        return DIVIDER_WIDTHS;
    }

    /**
     * Повертає ширину дільника за його типом ('A', 'B', 'C').
     * @param {string} type 
     * @returns {number} Ширина в см
     */
    static getDividerWidth(type) {
        // Якщо передали невідомий тип, повертаємо дефолтну ширину слота або кидаємо warning
        const width = DIVIDER_WIDTHS[type];
        if (!width) {
            console.warn(`[DividerDefinitions] Unknown divider type: "${type}". Using default MIN_SLOT_WIDTH.`);
            return SYSTEM_PARAMS.MIN_SLOT_WIDTH;
        }
        return width;
    }

    /**
     * Повертає внутрішню ширину шухляди на основі ширини фасаду.
     * Містить логіку "найближчого відповідника" (Fallback logic).
     * @param {number} cabinetWidth - Ширина фасаду (напр. 50, 60, 80)
     * @returns {number} Внутрішня ширина
     */
    static getInnerWidth(cabinetWidth) {
        // 1. Спробуємо знайти точне співпадіння
        if (DRAWER_INNER_WIDTHS[cabinetWidth]) {
            return DRAWER_INNER_WIDTHS[cabinetWidth];
        }

        // 2. Якщо точного немає, шукаємо найближчий (Smart Fallback)
        const definedWidths = Object.keys(DRAWER_INNER_WIDTHS).map(Number);

        if (definedWidths.length === 0) return 0;

        const closest = definedWidths.reduce((prev, curr) =>
            Math.abs(curr - cabinetWidth) < Math.abs(prev - cabinetWidth) ? curr : prev
        );

        return DRAWER_INNER_WIDTHS[closest];
    }

    /**
     * Отримує базовий об'єкт конфігурації для шухляди (Top/Bot).
     * @private Внутрішній метод, щоб не дублювати перевірки
     */
    static _getDrawerParams(drawerKey) {
        const params = DATA_DRAWER_PARAMS[drawerKey];
        return params;
    }

    /**
     * Повертає тип конфігурації для вказаної шухляди.
     * @param {'Top' | 'Bot' | 'TopFull'} drawerKey 
     * @returns {string} (напр. 'STANDARD_WIDTH_SIPHON')
     */
    static getConfigType(drawerKey) {
        return this._getDrawerParams(drawerKey).configType;
    }

    /**
     * Повертає node Drawer для вказаної шухляди.
     * @param {'Top' | 'Bot' | 'TopFull'} drawerKey 
     * @returns {Object} 
     */
    static getNodeDrawerDefinition(drawerKey) {
        return this._getDrawerParams(drawerKey).nodeDrawer;

    }

    /**
     * Повертає ім'я точки прив'язки для 3D сцени.
     * @param {'Top' | 'Bot' | 'TopFull'} drawerKey 
     */
    static getScenePointName(drawerKey) {
        return this._getDrawerParams(drawerKey).point;
    }

    static getDepthGroup(depth) {
        return depth <= 46 ? '46' : '50';
    }




    /**
     * Повертає ім'я floor-ноди: 'TopDrawerFloor' | 'BotDrawerFloor'
     */
    static getSceneFloorName(drawerKey) {
        return `${this._getDrawerParams(drawerKey).scenePrefix}DrawerFloor`;
    }

}