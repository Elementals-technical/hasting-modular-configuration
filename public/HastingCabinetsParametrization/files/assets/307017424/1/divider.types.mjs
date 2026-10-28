// @ts-check
import { DIVIDER_WIDTHS, ALIGNMENT_STRATEGIES } from './divider.constants.mjs';

/**
 * 1. Отримуємо ключі об'єкта DIVIDER_WIDTHS ('A' | 'B' | 'C')
 * @typedef {keyof typeof DIVIDER_WIDTHS} DividerType
 */

/**
 * 2. Отримуємо значення об'єкта ALIGNMENT_STRATEGIES ('packed' | 'spread' | ...)
 * В JS це робиться трохи хитро: беремо ключі, і дістаємо по них значення
 */
// AlignmentType defined as union below

/**
 * @typedef {Object} ZoneDefinition
 * @property {string} name - Назва зони (напр. 'siphon_left')
 * @property {number} start - Початок в см
 * @property {number} end - Кінець в см
 * @property {AlignmentType} strategy - Стратегія розміщення
 */

/**
 * @typedef {Object} SlotData
 * @property {string} key - Унікальний ID
 * @property {number} width - Ширина см
 * @property {Object} position - { start, center, end } в метрах
 * @property {DividerType | 'empty'} value
 * @property {Object} other - Метадані
 * @property {'occupied' | 'ghost'} other.type
 * @property {string} other.zone
 * @property {AlignmentType} [other.strategy]
 * @property {DividerType[]} [other.availableTypes]
 */


/**
 * Keep string literals as-is because these values are serialized to JSON
 * and likely consumed by other parts of the app.
 * @typedef {'packed' | 'spread' | 'edges-left' | 'edges-right' | 'space-between' | 'single-zone'} AlignmentType
 */

/**
 * Zone key naming convention:
 * - single zone: "main"
 * - constructive semantic zones: "<construct>_<side>", e.g. "siphon_left", "siphon_right"
 * - scalable: "<construct>_zone_01", "<construct>_zone_02", ...
 * @typedef {string} ZoneKey
 */


/**
 * @typedef {Object} ZoneState
 * @property {DividerType[]} slots
 * @property {AlignmentType} alignment
 */

/**
 * @typedef {Object.<ZoneKey, ZoneState>} ZonesMap
 */

/**
* @typedef {Object} DrawerConfig
* @property {ZonesMap} zones
* @property {{ alignment: AlignmentType }} zonesPolicy
*/

/**
 * Стан сітки слотів (використовується SlotEngine).
 *
 * @typedef {Object} SlotState
 * @property {(DividerType|null)[]} type - Тип дівайдера для кожного слота (null = порожній)
 * @property {number[]} slotWidth - Ширина кожного слота в см
 * @property {number[]} slotX - Ліва координата кожного слота в см (відносно початку зони)
 * @property {number} N - Кількість слотів у сітці
 * @property {string} [alignment] - Стратегія вирівнювання ('packed' | 'edges-left' | 'edges-right')
 * @property {Object.<number, string>} [stateIds] - stateId для кожного occupied слота (ключ = zoneIndex)
 */

// Цей експорт потрібен, щоб файл вважався модулем, 
// і VS Code міг підтягувати ці типи в інші файли через import.
export { };