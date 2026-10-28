// @ts-check

import { DividerCalculator } from '../core/DividerCalculator.mjs';
import { DividerValidationService } from './DividerValidationService.mjs';
import * as CONSTANTS from '../core/divider.constants.mjs';

/**
 * @typedef {import('../core/divider.types.mjs').SlotData} SlotData
 * @typedef {import('../core/divider.types.mjs').ZoneDefinition} ZoneDefinition
 * @typedef {import('../core/divider.types.mjs').DividerType} DividerType
 */

export class DividerStateService {
    constructor() {
        // 1. Збираємо конфіг (Dependency Injection)
        // Ми передаємо константи в сервіси, щоб вони не залежали від глобальних змінних
        const config = {
            dividerWidths: CONSTANTS.DIVIDER_WIDTHS,
            systemParams: CONSTANTS.SYSTEM_PARAMS,
            alignmentStrategies: CONSTANTS.ALIGNMENT_STRATEGIES
        };

        // 2. Ініціалізуємо помічників
        this.calculator = new DividerCalculator(config);
        this.validator = new DividerValidationService(config);

        // 3. Початковий стан (State)
        // Це єдине місце, де зберігаються дані про поточну сесію користувача
        this.state = {
            cabinetWidth: 0,        // напр. 60
            innerWidth: 0,          // напр. 50.32
            configType: '',         // напр. STANDARD_WIDTH_SIPHON
            /** @type {ZoneDefinition[]} */
            zonesDefinition: [],    // Опис зон (початок, кінець, стратегія)
            /** @type {Object.<string, string[]>} */
            items: {}               // Наповнення: { 'siphon_left': ['A', 'B'] }
        };
    }

    /**
    * Розбиває простір на зони
    * @private
    * @param {number} innerWidth 
    * @param {string} type 
    * @returns {ZoneDefinition[]}
    */
    _generateZones(innerWidth, type) {
        const { ALIGNMENT_STRATEGIES, CABINET_CONFIG_TYPES, SYSTEM_PARAMS } = CONSTANTS;

        // Логіка для тумби з сифоном
        if (type === CABINET_CONFIG_TYPES.STANDARD_WIDTH_SIPHON) {
            const center = innerWidth / 2;
            const halfSiphon = SYSTEM_PARAMS.SIPHON_WIDTH / 2;

            return [
                {
                    name: 'siphon_left',
                    start: 0,
                    end: center - halfSiphon,
                    strategy: ALIGNMENT_STRATEGIES.EDGES_LEFT // Притискаємо вліво
                },
                {
                    name: 'siphon_right',
                    start: center + halfSiphon,
                    end: innerWidth,
                    strategy: ALIGNMENT_STRATEGIES.EDGES_RIGHT // Притискаємо вправо
                }
            ];
        }

        // Логіка для стандартної повної тумби
        // За замовчуванням - PACKED (зліва направо)
        return [{
            name: 'main',
            start: 0,
            end: innerWidth,
            strategy: ALIGNMENT_STRATEGIES.PACKED
        }];
    }




    // /**
    //  * Ініціалізація тумби. Викликається при старті або зміні ширини/типу тумби.
    //  * @param {number} cabinetWidth - Зовнішня ширина (напр. 60, 80)
    //  * @param {string} configType - Тип конфігурації (STANDARD_FULL, STANDARD_WIDTH_SIPHON)
    //  * @returns {SlotData[]} Початковий розрахунок візуалізації
    //  */
    // initialize(cabinetWidth, configType) {
    //     // 1. Знаходимо внутрішню ширину (lookup в константах)
    //     const innerWidth = this._findInnerWidth(cabinetWidth);

    //     // 2. Генеруємо зони на основі типу тумби (бізнес-логіка розбиття простору)
    //     const zones = this._generateZones(innerWidth, configType);

    //     // 3. Формуємо чистий стейт
    //     this.state = {
    //         cabinetWidth,
    //         innerWidth,
    //         configType,
    //         zonesDefinition: zones,
    //         items: {}
    //     };

    //     // Створюємо пусті масиви для кожної зони
    //     zones.forEach(z => {
    //         this.state.items[z.name] = [];
    //     });

    //     // 4. Повертаємо першу візуалізацію (там будуть тільки Ghost слоти)
    //     return this.getVisualization();
    // }


    // /**
    //  * Спроба додати дільник у зону.
    //  * @param {string} zoneName - Назва зони (напр. 'siphon_left')
    //  * @param {string} itemType - Тип дільника ('A', 'B', 'C')
    //  * @returns {SlotData[] | false} Повертає оновлені слоти або false, якщо не влізло
    //  */
    // addItem(zoneName, itemType) {
    //     // Знаходимо опис зони
    //     const zoneDef = this.state.zonesDefinition.find(z => z.name === zoneName);
    //     if (!zoneDef) {
    //         console.error(`Zone ${zoneName} not found in current state`);
    //         return false;
    //     }

    //     const currentItems = this.state.items[zoneName];

    //     // 1. ВАЛІДАЦІЯ: Запитуємо у ValidatorService, чи можна це зробити
    //     const canFit = this.validator.canAddItem(zoneDef, currentItems, itemType);

    //     if (!canFit) {
    //         // Тут можна додати логіку сповіщення про помилку
    //         return false;
    //     }

    //     // 2. МУТАЦІЯ: Оновлюємо стейт
    //     // Створюємо новий масив (immutability), щоб React/Vue детектили зміни
    //     this.state.items[zoneName] = [...currentItems, itemType];

    //     // 3. РЕАКЦІЯ: Перераховуємо координати
    //     return this.getVisualization();
    // }

    // /**
    //  * Видалення дільника
    //  * @param {string} zoneName 
    //  * @param {number} index - Індекс елемента в масиві цієї зони
    //  * @returns {SlotData[]}
    //  */
    // removeItem(zoneName, index) {
    //     if (!this.state.items[zoneName]) return this.getVisualization();

    //     const newItems = [...this.state.items[zoneName]];
    //     newItems.splice(index, 1);

    //     this.state.items[zoneName] = newItems;

    //     return this.getVisualization();
    // }

    /**
     * Отримати поточну картину для рендеру.
     * Цей метод зв'язує Стейт (дані) і Калькулятор (математику).
     * @returns {SlotData[]}
     */
    getVisualization() {
        return this.calculator.calculateSlots(
            this.state.innerWidth,
            this.state.zonesDefinition,
            this.state.items
        );
    }



    /**
     * Перетворює повний UI стейт у компактний формат для збереження/передачі.
     * Залишає тільки слоти з вибраними значеннями (не 'empty').
     * * @param {Object} fullState - Повний об'єкт з зонами (вхідний формат)
     * @returns {Object} Компактний об'єкт (вихідний формат)
     */
    getCompactState(fullState) {
        const compactState = {};

        // 1. Проходимо по всіх зонах (siphon_left, siphon_right і т.д.)
        Object.keys(fullState).forEach(zoneName => {
            const zoneData = fullState[zoneName];

            // Якщо в зоні немає слотів, пропускаємо
            if (!zoneData || !Array.isArray(zoneData.slots)) return;

            // 2. Фільтруємо та мапимо слоти
            const activeSlots = zoneData.slots
                // Крок А: Відкидаємо пусті (value: "empty")
                // Навіть якщо type: "ghost", але value вже "A", ми це вважаємо активним вибором
                .filter(slot => slot.value !== 'empty')
                // Крок Б: Створюємо спрощений об'єкт
                .map(slot => ({
                    key: slot.key,
                    value: slot.value
                }));

            // 3. Додаємо в результат тільки якщо є активні слоти
            if (activeSlots.length > 0) {
                compactState[zoneName] = {
                    // Важливо: повертаємо масив, бо в одній зоні може бути декілька дільників
                    slots: activeSlots
                };
            }
        });

        return compactState;
    }

    getSlotConvertList(currentZonesDrawer) {

        const currentZones = currentZonesDrawer?.zones;
        const hasActiveDividers = currentZones && Object.keys(currentZones).length > 0;

        let resultSlots = []

        if (!hasActiveDividers) {
            return resultSlots;
        }

        const allSlots = Object.values(currentZones).flatMap(zone => zone.slots || []);
        resultSlots = allSlots.sort((a, b) => a.position.start - b.position.start);

        return resultSlots;

    }
}