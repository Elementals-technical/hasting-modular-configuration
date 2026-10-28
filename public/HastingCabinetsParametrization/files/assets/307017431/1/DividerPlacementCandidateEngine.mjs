// @ts-check

import { DIVIDER_WIDTHS, SYSTEM_PARAMS } from './divider.constants.mjs';
import { DividerCalculator } from './DividerCalculator.mjs';
import { DividerDefinitions } from './DividerDefinitions.mjs';
import { DividerDebugLogger } from '../diagnostics/DividerDebugLogger.mjs';
import { packZone, packStrategy, occupiedFromCompact } from './DividerPacking.mjs';

/**
 * Будує кандидатів «+» для divider-overlay (V2 — через packZone).
 *
 * Кандидат у КОЖНОМУ вільному сегменті ≥ ширини вибраного типу; позиції від
 * фактичних ширин (без A-ґратки), тож overlap НЕМОЖЛИВИЙ за конструкцією.
 * Placement-позиція кандидата передається в `other.start` (зона-локальна см)
 * та `position` (метри) — write-сторона зберігає `start` у store.
 */
export class DividerPlacementCandidateEngine {
    constructor() {
        this.calculator = new DividerCalculator();
        this.DIVIDERS = DIVIDER_WIDTHS;
    }

    /**
     * @param {number} cabinetWidth
     * @param {'Top'|'TopFull'|'Bot'} drawerType
     * @param {Object} currentZonesDrawer
     * @param {string|null|undefined} selectedDividerType
     * @param {string|null|undefined} debugRequestId
     * @returns {Object}
     */
    getPlacementSlots(cabinetWidth, drawerType, currentZonesDrawer = {}, selectedDividerType = null, debugRequestId = null) {
        const traceId = debugRequestId || DividerDebugLogger.nextTraceId('divider-candidates');
        const selectedType = this._normalizeDividerType(selectedDividerType);
        const selectedWidth = selectedType ? this.DIVIDERS[selectedType] : 0;
        const configType = DividerDefinitions.getConfigType(drawerType);
        const innerWidth = this.calculator._getInnerWidth(cabinetWidth);
        const zones = this.calculator._getZones(innerWidth, configType);
        const currentZones = /** @type {any} */(currentZonesDrawer)?.zones;
        const spacing = SYSTEM_PARAMS.SPACING;
        const result = { zones: {} };

        DividerDebugLogger.log('CandidateEngine.buildCandidates', 'Placement candidate calculation started (packZone V2)', {
            traceId,
            cabinetWidth,
            drawerType,
            configType,
            selectedType,
            innerWidth,
            zones: zones.map(z => ({ name: z.name, width: DividerDebugLogger._round(z.end - z.start), strategy: z.strategy })),
            compactState: DividerDebugLogger.summarizeCompactState(currentZonesDrawer)
        });

        for (const zone of zones) {
            const zoneWidth = zone.end - zone.start;
            const occupied = occupiedFromCompact(currentZones?.[zone.name]?.slots, this.DIVIDERS, spacing);
            const pack = packZone(zoneWidth, occupied, selectedWidth, spacing, packStrategy(zone.strategy));

            const zoneSlots = [];

            for (const p of pack.placed) {
                zoneSlots.push(this._toSlot(
                    `slot:${zone.name}:${DividerDebugLogger._round(p.start)}`,
                    'occupied', zone, p.value, p.start, p.end - p.start, innerWidth,
                    { stateId: p.stateId, start: p.start }
                ));
            }

            for (const c of pack.candidates) {
                const availableTypes = this._availableTypesForSegment(c.segment.width);
                zoneSlots.push(this._toSlot(
                    `candidate:${drawerType}:${zone.name}:${c.anchor}:${DividerDebugLogger._round(c.start)}:${selectedType || 'none'}`,
                    'candidate', zone, 'empty', c.start, c.width, innerWidth,
                    {
                        anchor: c.anchor,
                        placementType: selectedType,
                        canPlace: Boolean(selectedType),
                        disabledReason: selectedType ? null : 'select-divider',
                        availableTypes,
                        start: c.start
                    }
                ));
            }

            /** @type {any} */(result.zones)[zone.name] = {
                slots: zoneSlots.sort((a, b) => /** @type {any} */(a).position.start - /** @type {any} */(b).position.start)
            };

            DividerDebugLogger.log('CandidateEngine.candidate', 'Zone placement candidates resolved (packZone V2)', {
                traceId,
                zone: zone.name,
                strategy: zone.strategy,
                zoneWidth: DividerDebugLogger._round(zoneWidth),
                selectedType,
                segments: pack.segments.map(s => DividerDebugLogger._round(s.width)),
                activeCandidates: pack.candidates.length,
                candidates: pack.candidates.map(c => ({
                    anchor: c.anchor,
                    start: DividerDebugLogger._round(c.start),
                    end: DividerDebugLogger._round(c.end)
                }))
            });
        }

        DividerDebugLogger.log('CandidateEngine.buildCandidates', 'Placement candidate calculation completed', {
            traceId,
            selectedType,
            result: DividerDebugLogger.summarizeDrawerConfig(result)
        });

        return result;
    }

    /**
     * Типи, що влазять у сегмент заданої ширини.
     * @private
     * @param {number} segmentWidth
     * @returns {string[]}
     */
    _availableTypesForSegment(segmentWidth) {
        return Object.keys(this.DIVIDERS).filter(t => this.DIVIDERS[t] <= segmentWidth + 0.01);
    }

    /**
     * Конвертує zone-local позицію (см) у slot для overlay (метри через _createSlot).
     * @private
     */
    _toSlot(key, type, zone, value, localStartCm, widthCm, innerWidth, extraOther) {
        const otherProps = {
            type,
            zone: zone.name,
            strategy: zone.strategy,
            ...extraOther
        };
        return this.calculator._createSlot(
            key,
            value,
            widthCm,
            zone.start + localStartCm,
            innerWidth,
            otherProps
        );
    }

    /**
     * @private
     * @param {string|null|undefined} value
     * @returns {string|null}
     */
    _normalizeDividerType(value) {
        if (typeof value !== 'string') return null;
        return Object.prototype.hasOwnProperty.call(this.DIVIDERS, value) ? value : null;
    }
}
