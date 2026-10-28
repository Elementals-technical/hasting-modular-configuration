// @ts-check

import {
    DIVIDER_WIDTHS,
    DRAWER_INNER_WIDTHS,
    SYSTEM_PARAMS,
    ALIGNMENT_STRATEGIES,
    CABINET_CONFIG_TYPES
} from './divider.constants.mjs';
import { packZone, packStrategy, occupiedFromCompact } from './DividerPacking.mjs';
import { DividerDebugLogger } from '../diagnostics/DividerDebugLogger.mjs';

/**
 * @typedef {import('./divider.types.mjs').SlotData} SlotData
 * @typedef {import('./divider.types.mjs').DividerType} DividerType
 */

/**
 * Калькулятор слотів дивайдерів (V2 — через packZone).
 *
 * Occupied дивайдери стоять на фактичних позиціях (start, см); ghost-слоти —
 * кандидати під базовий тип A у кожному вільному сегменті. Позиції від
 * фактичних ширин, без A-ґратки. Render читає `position.center` occupied-слотів.
 */
export class DividerCalculator {
    constructor() {
        this.DIVIDERS = DIVIDER_WIDTHS;
        this.DRAWER_MAP = DRAWER_INNER_WIDTHS;
        this.SIPHON_WIDTH = SYSTEM_PARAMS.SIPHON_WIDTH;
        this.SPACING = SYSTEM_PARAMS.SPACING;
        this.MIN_WIDTH = SYSTEM_PARAMS.MIN_SLOT_WIDTH;
        this.STRATEGIES = ALIGNMENT_STRATEGIES;
    }

    /**
     * Усі слоти (occupied + ghost) для зон шухляди.
     *
     * @param {number} cabinetWidth - Ширина тумби в см
     * @param {string} configType - 'STANDARD_WIDTH_SIPHON' | 'STANDARD_FULL'
     * @param {Object} currentZonesDrawer - Поточний стан (slots з value + start)
     * @returns {Object}
     */
    getAllPotentialSlots(cabinetWidth, configType, currentZonesDrawer = {}) {
        const traceId = DividerDebugLogger.nextTraceId('divider-calc');
        const innerWidth = this._getInnerWidth(cabinetWidth);
        const zones = this._getZones(innerWidth, configType);
        const currentZones = /** @type {any} */(currentZonesDrawer)?.zones;
        const spacing = this.SPACING;

        const result = { zones: {} };
        /** @type {Array<any>} */
        const conflicts = [];

        zones.forEach((zone) => {
            const zoneWidth = zone.end - zone.start;
            const occupiedRaw = occupiedFromCompact(currentZones?.[zone.name]?.slots, this.DIVIDERS, spacing);

            // Дивайдери, що вийшли за межі зони (напр. після зменшення ширини) — конфлікти
            /** @type {Array<any>} */
            const valid = [];
            for (const o of occupiedRaw) {
                if (o.start < -0.01 || o.start + o.width > zoneWidth + 0.01) {
                    conflicts.push({
                        zone: zone.name,
                        dividerType: o.value,
                        dividerWidth: o.width,
                        stateId: o.stateId || '',
                        start: Number(o.start.toFixed(2)),
                        available: Number(zoneWidth.toFixed(2)),
                        reason: `Divider "${o.value}" at ${o.start.toFixed(2)}cm exceeds zone ${zoneWidth.toFixed(2)}cm`
                    });
                } else {
                    valid.push(o);
                }
            }

            const pack = packZone(zoneWidth, valid, this.DIVIDERS.A, spacing, packStrategy(zone.strategy));

            /** @type {Array<any>} */
            const slots = [];

            for (const p of pack.placed) {
                slots.push(this._createSlot(
                    `occ:${zone.name}:${p.start.toFixed(2)}`,
                    /** @type {any} */(p.value),
                    p.end - p.start,
                    zone.start + p.start,
                    innerWidth,
                    { type: 'occupied', zone: zone.name, strategy: zone.strategy, stateId: p.stateId, start: p.start }
                ));
            }

            for (const c of pack.candidates) {
                const availableTypes = Object.keys(this.DIVIDERS).filter(t => this.DIVIDERS[t] <= c.segment.width + 0.01);
                const maxType = availableTypes.length ? availableTypes[availableTypes.length - 1] : null;
                slots.push(this._createSlot(
                    `ghost:${zone.name}:${c.anchor}:${c.start.toFixed(2)}`,
                    'empty',
                    c.width,
                    zone.start + c.start,
                    innerWidth,
                    {
                        type: 'ghost',
                        zone: zone.name,
                        strategy: zone.strategy,
                        anchor: c.anchor,
                        start: c.start,
                        availableTypes,
                        maxSpaceHere: maxType ? this.DIVIDERS[maxType] : 0
                    }
                ));
            }

            /** @type {any} */(result.zones)[zone.name] = {
                slots: slots.sort((a, b) => /** @type {any} */(a).position.start - /** @type {any} */(b).position.start)
            };
        });

        if (conflicts.length > 0) {
            /** @type {any} */(result)._conflicts = conflicts;
            DividerDebugLogger.warn('Calculator.getAllPotentialSlots', 'Potential slot calculation completed with conflicts', {
                traceId,
                conflicts,
                result: DividerDebugLogger.summarizeDrawerConfig(result)
            });
        }

        return result;
    }

    /**
     * Створює об'єкт слота з координатами в метрах (відносно центру inner width).
     * @private
     * @param {string} key
     * @param {DividerType | 'empty'} value
     * @param {number} widthCm
     * @param {number} startCm - абсолютний старт у inner width (см)
     * @param {number} totalInnerWidthCm
     * @param {any} otherProps
     * @returns {SlotData}
     */
    _createSlot(key, value, widthCm, startCm, totalInnerWidthCm, otherProps = {}) {
        const offset = totalInnerWidthCm / 2;
        const centerLocalCm = startCm + (widthCm / 2);

        const startMeters = (startCm - offset) / 100;
        const centerMeters = (centerLocalCm - offset) / 100;
        const endMeters = ((startCm + widthCm) - offset) / 100;

        return {
            key,
            value,
            width: widthCm,
            position: {
                start: Number(startMeters.toFixed(4)),
                center: Number(centerMeters.toFixed(4)),
                end: Number(endMeters.toFixed(4))
            },
            other: otherProps
        };
    }

    /**
     * Внутрішня ширина за шириною тумби (найближчий відповідник).
     * @private
     * @param {number} cabinetWidth
     * @returns {number}
     */
    _getInnerWidth(cabinetWidth) {
        const widths = Object.keys(this.DRAWER_MAP).map(Number);
        const closest = widths.reduce((prev, curr) =>
            Math.abs(curr - cabinetWidth) < Math.abs(prev - cabinetWidth) ? curr : prev
        );
        return this.DRAWER_MAP[/** @type {keyof typeof this.DRAWER_MAP} */(closest)];
    }

    /**
     * Зони та стратегії за типом конфігурації.
     * @private
     * @param {number} innerWidth
     * @param {string} configType
     * @returns {Array<{name: string, start: number, end: number, strategy: string}>}
     */
    _getZones(innerWidth, configType) {
        if (configType === CABINET_CONFIG_TYPES.STANDARD_WIDTH_SIPHON) {
            const center = innerWidth / 2;
            const halfSiphon = this.SIPHON_WIDTH / 2;
            return [
                { name: 'siphon_left', start: 0, end: center - halfSiphon, strategy: this.STRATEGIES.EDGES_LEFT },
                { name: 'siphon_right', start: center + halfSiphon, end: innerWidth, strategy: this.STRATEGIES.EDGES_RIGHT }
            ];
        }
        return [{ name: 'main', start: 0, end: innerWidth, strategy: this.STRATEGIES.PACKED }];
    }
}
