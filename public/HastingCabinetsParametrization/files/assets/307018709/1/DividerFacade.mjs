import { DividerController } from './services/DividerController.mjs';
import { DividerCompositionAdapter } from './adapters/DividerCompositionAdapter.mjs';
import { DividerDefinitions } from './core/DividerDefinitions.mjs';
import { LoggerService } from '../../services/logger/logger-service.mjs';
import { DividerDebugLogger } from './diagnostics/DividerDebugLogger.mjs';

/**
 * DividerFacade — єдина точка входу для всіх операцій з дівайдерами.
 * 
 * Інкапсулює: DividerController, DividerCompositionAdapter, DividerCalculator.
 * Consumer-код (bridge, overlay, scene-manager) працює ТІЛЬКИ через цей фасад.
 */
export class DividerFacade {
    /** @type {DividerFacade|null} */
    static _instance = null;

    constructor(compositionManager) {
        this._compositionManager = compositionManager;
        this._controller = new DividerController();
        this._adapter = new DividerCompositionAdapter(compositionManager);
    }

    /** @returns {DividerFacade} */
    static init(compositionManager) {
        DividerFacade._instance = new DividerFacade(compositionManager);
        return DividerFacade._instance;
    }

    /** @returns {DividerFacade} */
    static get instance() {
        return DividerFacade._instance;
    }

    // ===== PUBLIC API =====

    /**
     * Згенерувати дефолтні слоти для нового продукту
     * @param {number} width — ширина кабінету
     * @param {string} drawerType — 'Top' | 'Bot' | 'TopFull'
     * @param {Object} currentState
     */
    generateSlots(width, drawerType, currentState = {}) {
        const traceId = DividerDebugLogger.nextTraceId('divider-generate');
        DividerDebugLogger.log('Facade.generateSlots', 'Generating divider slots', {
            traceId,
            width,
            drawerType,
            currentState: DividerDebugLogger.summarizeCompactState(currentState)
        });

        const result = this._controller.getAllSlots(width, drawerType, currentState);

        DividerDebugLogger.log('Facade.generateSlots', 'Generated divider slots', {
            traceId,
            width,
            drawerType,
            result: DividerDebugLogger.summarizeDrawerConfig(result)
        });

        return result;
    }

    /**
     * Отримати значення дівайдера в слоті
     */
    getDividerValue(cabinetId, drawerType, zone, key) {
        const value = this._adapter.getDividerValue(cabinetId, drawerType, zone, key);
        DividerDebugLogger.log('Facade.getDividerValue', 'Read divider slot', {
            cabinetId,
            drawerType,
            zone,
            key,
            slot: DividerDebugLogger.summarizeSlots(value ? [value] : [])
        });
        return value;
    }

    /**
     * Отримати compact state (для update flow)
     */
    getCompareState(cabinetId, drawerType) {
        const state = this._adapter.getDividersCompareState(cabinetId, drawerType);
        DividerDebugLogger.log('Facade.getCompareState', 'Read compact divider state', {
            cabinetId,
            drawerType,
            compactState: DividerDebugLogger.summarizeCompactState(state)
        });
        return state;
    }

    /**
     * Отримати слоти для рендеру іконок в overlay
     */
    getIconSlots(cabinetId, drawerType, app) {
        const slots = this._adapter.showIconDividerSlots(cabinetId, drawerType, app);
        DividerDebugLogger.log('Facade.getIconSlots', 'Resolved overlay icon slots', {
            cabinetId,
            drawerType,
            slots: DividerDebugLogger.summarizeSlots(slots)
        });
        return slots;
    }

    /**
     * Отримати слоти overlay, перераховані під поточний вибраний divider type.
     */
    getPlacementCandidates(cabinetId, drawerType, app, selectedDividerType = null, debugRequestId = null) {
        const slots = this._adapter.showPlacementCandidateSlots(
            cabinetId,
            drawerType,
            app,
            selectedDividerType,
            debugRequestId
        );
        DividerDebugLogger.log('Facade.getPlacementCandidates', 'Resolved selected-type placement candidates', {
            traceId: debugRequestId,
            cabinetId,
            drawerType,
            selectedDividerType,
            slots: DividerDebugLogger.summarizeSlots(slots)
        });
        return slots;
    }

    /**
     * Отримати configKey для збереження в composition store
     * @example getConfigKey('Top') → 'TopDrawerDividers'
     * @example getConfigKey('Bot') → 'BotDrawerDividers'
     * @example getConfigKey('TopFull') → 'TopDrawerDividers' (спільний з Top)
     */
    getConfigKey(drawerType) {
        return DividerDefinitions.getNodeDrawerDefinition(drawerType);
    }

    /**
     * Перерахувати дівайдери при зміні ширини тумби.
     * 
     * НЕ зберігає в store — повертає розраховані зміни та конфлікти.
     * Caller (setConfig) відповідає за збереження.
     * 
     * Сценарії:
     *  - Збільшення ширини → позиції перераховуються, можуть з'явитися нові ghost-слоти
     *  - Зменшення ширини → деякі дівайдери можуть не вміститися (conflicts)
     * 
     * @param {string} cabinetId — ID тумби
     * @param {number} newWidth — нова ширина тумби
     * @returns {{
     *   changes: Object,
     *   conflicts: Array<{cabinetId: string, drawerType: string, zone: string, dividerType: string, dividerWidth: number, stateId: string, zoneIndex: number, reason: string}>,
     *   summary: {previousWidth: number, newWidth: number, totalPreserved: number, totalDropped: number}
     * } | null}
     * 
     * @example
     * const report = facade.recalculateOnResize('Sink-Cabinet_0', 90);
     * // report.summary → { previousWidth: 60, newWidth: 90, totalPreserved: 1, totalDropped: 0 }
     * // report.conflicts → []
     * 
     * const report2 = facade.recalculateOnResize('Sink-Cabinet_0', 35);
     * // report2.summary → { previousWidth: 90, newWidth: 35, totalPreserved: 0, totalDropped: 1 }
     * // report2.conflicts → [{ cabinetId, drawerType, zone, dividerType, reason, ... }]
     */
    recalculateOnResize(cabinetId, newWidth) {
        const traceId = DividerDebugLogger.nextTraceId('divider-resize');
        const composition = this._compositionManager.getActiveComposition();
        const productConfig = composition?.getProduct(cabinetId);
        if (!productConfig) {
            DividerDebugLogger.warn('Facade.recalculateOnResize', 'Product config not found', {
                traceId,
                cabinetId,
                newWidth
            });
            return null;
        }

        const previousWidth = productConfig.Width;
        const topDrawerType = productConfig.topDrawerType || 'Top';
        const drawerTypes = [topDrawerType, 'Bot'];

        const report = { changes: {}, conflicts: [], summary: {} };
        let totalPreserved = 0;

        DividerDebugLogger.log('Facade.recalculateOnResize', 'Resize recalculation started', {
            traceId,
            cabinetId,
            previousWidth,
            newWidth,
            drawerTypes,
            before: DividerDebugLogger.summarizeProduct(cabinetId, productConfig)
        });

        for (const drawerType of drawerTypes) {
            const configKey = this.getConfigKey(drawerType);

            // Отримуємо поточний compact state (тільки occupied дівайдери)
            const compactState = this.getCompareState(cabinetId, drawerType);

            // Перераховуємо слоти для нової ширини
            const newSlots = this._controller.getAllSlots(newWidth, drawerType, compactState);

            DividerDebugLogger.log('Facade.recalculateOnResize', 'Drawer recalculated', {
                traceId,
                cabinetId,
                drawerType,
                configKey,
                compactState: DividerDebugLogger.summarizeCompactState(compactState),
                recalculated: DividerDebugLogger.summarizeDrawerConfig(newSlots)
            });

            // Відокремлюємо _conflicts від даних, щоб вони не потрапили в store
            const { _conflicts, ...cleanSlots } = newSlots;
            report.changes[configKey] = cleanSlots;

            // Рахуємо збережені occupied дівайдери
            const zones = cleanSlots.zones || {};
            for (const zone of Object.values(zones)) {
                totalPreserved += (zone.slots || []).filter(
                    s => s.other?.type === 'occupied'
                ).length;
            }

            // Збираємо конфлікти (дівайдери, що не вмістились)
            if (_conflicts?.length > 0) {
                for (const c of _conflicts) {
                    report.conflicts.push({
                        cabinetId,
                        drawerType,
                        zone: c.zone,
                        dividerType: c.dividerType,
                        dividerWidth: c.dividerWidth,
                        stateId: c.stateId,
                        zoneIndex: c.zoneIndex,
                        reason: c.reason
                    });
                }
            }
        }

        // Summary
        report.summary = {
            previousWidth,
            newWidth,
            totalPreserved,
            totalDropped: report.conflicts.length
        };

        // Логування результату
        if (report.conflicts.length > 0) {
            LoggerService.warn(this,
                `⚠️ [DividerFacade] Resize ${cabinetId} (${previousWidth}→${newWidth}cm): ${report.conflicts.length} dropped, ${totalPreserved} preserved`,
                report.conflicts
            );
            DividerDebugLogger.warn('Facade.recalculateOnResize', 'Resize completed with conflicts', {
                traceId,
                report
            });
        } else {
            LoggerService.log(this,
                `✅ [DividerFacade] Resize ${cabinetId} (${previousWidth}→${newWidth}cm): ${totalPreserved} preserved`
            );
            DividerDebugLogger.log('Facade.recalculateOnResize', 'Resize completed', {
                traceId,
                report
            });
        }

        return report;
    }

    /**
     * Оновити слот та виконати правила.
     * Підтримує два сценарії:
     *  - Ghost → Occupied: додавання нового дівайдера (слот не існує в compact state)
     *  - Occupied → Occupied: зміна типу дівайдера (A→B, B→C тощо)
     *
     * Ключова зміна: використовує ФІКСОВАНИЙ zoneIndex (engine slot index).
     * НЕ робить REPACK — зберігає індекс слота як є.
     * Це дозволяє зберігати gaps між дівайдерами.
     */
    async updateSlot(cabinetId, drawerType, key, zone, newValue, options = {}) {
        const traceId = DividerDebugLogger.nextTraceId('divider-update');
        // 1. Compact state (occupied дивайдери з позиціями start — V2)
        const slotData = this.getCompareState(cabinetId, drawerType);
        const isRemove = newValue === 'empty' || newValue === 'none' || newValue == null;
        const requestedStateId = typeof options?.stateId === 'string' && options.stateId
            ? options.stateId
            : null;
        let requestedStart = typeof options?.start === 'number' ? options.start : null;
        let requestedAnchor = typeof options?.anchor === 'string' ? options.anchor : null;

        if (requestedStart === null || requestedAnchor === null) {
            const requestedSlot = this._adapter.getDividerValue(cabinetId, drawerType, zone, key);
            const slotStart = requestedSlot?.other?.start ?? requestedSlot?.start;
            const slotAnchor = requestedSlot?.other?.anchor ?? requestedSlot?.anchor;

            if (requestedStart === null && typeof slotStart === 'number') {
                requestedStart = slotStart;
            }
            if (requestedAnchor === null && typeof slotAnchor === 'string') {
                requestedAnchor = slotAnchor;
            }
        }

        DividerDebugLogger.log('Facade.updateSlot', 'Slot update started (V2 packZone)', {
            traceId,
            cabinetId,
            drawerType,
            key,
            zone,
            stateId: requestedStateId,
            start: requestedStart,
            anchor: requestedAnchor,
            placementType: options?.placementType,
            newValue,
            isRemove,
            compactBefore: DividerDebugLogger.summarizeCompactState(slotData)
        });

        const composition = this._compositionManager.getActiveComposition();
        const productConfig = composition?.getProduct(cabinetId);
        if (!productConfig) {
            DividerDebugLogger.warn('Facade.updateSlot', 'Product config not found before slot resolution', {
                traceId,
                cabinetId,
                drawerType
            });
            return false;
        }

        // 2-3. V2 мутація compact state за позицією (start), без zoneIndex/guards.
        // Валідність розміщення тримають packZone (через getAllSlots) + conflict-check нижче.
        if (!slotData.zones) slotData.zones = {};
        if (!slotData.zones[zone]) slotData.zones[zone] = { slots: [] };
        const zoneSlots = slotData.zones[zone].slots;

        const slotSid = (slot) => slot.stateId || slot.other?.stateId;
        const slotStart = (slot) => (typeof slot.start === 'number' ? slot.start : slot.other?.start);

        if (isRemove) {
            slotData.zones[zone].slots = zoneSlots.filter(s => {
                const matchStateId = requestedStateId && slotSid(s) === requestedStateId;
                const sStart = slotStart(s);
                const matchStart = requestedStart !== null && typeof sStart === 'number'
                    && Math.abs(sStart - requestedStart) < 0.01;
                return !(matchStateId || matchStart);
            });
            DividerDebugLogger.log('Facade.updateSlot', 'Removed divider from compact state', {
                traceId,
                requestedStateId,
                requestedStart,
                compactAfterMutation: DividerDebugLogger.summarizeCompactState(slotData)
            });
        } else {
            const dividerTypes = DividerDefinitions.getDividers();
            if (!Object.prototype.hasOwnProperty.call(dividerTypes, newValue)) {
                DividerDebugLogger.warn('Facade.updateSlot', 'Unknown divider type rejected', { traceId, newValue });
                return false;
            }

            const existingByState = requestedStateId
                ? zoneSlots.find(s => slotSid(s) === requestedStateId)
                : null;

            if (existingByState) {
                // Зміна типу наявного дивайдера (за stateId)
                existingByState.value = newValue;
                DividerDebugLogger.log('Facade.updateSlot', 'Updated existing divider value', {
                    traceId,
                    requestedStateId,
                    newValue,
                    compactAfterMutation: DividerDebugLogger.summarizeCompactState(slotData)
                });
            } else {
                if (requestedStart === null) {
                    DividerDebugLogger.warn('Facade.updateSlot', 'Add rejected: no start position in options', {
                        traceId,
                        cabinetId,
                        drawerType,
                        zone,
                        key
                    });
                    return false;
                }
                const newSlot = {
                    value: newValue,
                    stateId: requestedStateId || `divider_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    start: requestedStart
                };
                if (requestedAnchor) {
                    newSlot.anchor = requestedAnchor;
                }
                zoneSlots.push(newSlot);
                DividerDebugLogger.log('Facade.updateSlot', 'Added divider to compact state at position', {
                    traceId,
                    newSlot,
                    compactAfterMutation: DividerDebugLogger.summarizeCompactState(slotData)
                });
            }
        }

        // 4. Перерахувати слоти
        const dataDividers = this._controller.getAllSlots(
            productConfig.Width, drawerType, slotData
        );

        DividerDebugLogger.log('Facade.updateSlot', 'Recalculated slot state after update', {
            traceId,
            width: productConfig.Width,
            recalculated: DividerDebugLogger.summarizeDrawerConfig(dataDividers)
        });

        // Видаляємо _conflicts перед збереженням в store
        const { _conflicts, ...cleanDividers } = dataDividers;

        if (_conflicts?.length > 0) {
            LoggerService.warn(this,
                `[DividerFacade] Divider update rejected because it creates conflicts`,
                _conflicts
            );
            DividerDebugLogger.warn('Facade.updateSlot', 'Slot update rejected after recalculation conflicts', {
                traceId,
                conflicts: _conflicts,
                compactState: DividerDebugLogger.summarizeCompactState(slotData)
            });
            return false;
        }

        // 5. Зберегти в composition
        const configKey = this.getConfigKey(drawerType);
        this._compositionManager.updateProductInComposition(
            this._compositionManager._activeCompositionId,
            cabinetId,
            { [configKey]: cleanDividers }
        );

        DividerDebugLogger.log('Facade.updateSlot', 'Composition store updated', {
            traceId,
            cabinetId,
            configKey,
            saved: DividerDebugLogger.summarizeDrawerConfig(cleanDividers)
        });

        // 6. Виконати правила
        const entity = this._compositionManager.app?.root?.findByName(cabinetId);
        if (entity) {
            const updatedConfig = { ...productConfig, [configKey]: cleanDividers };
            const changes = { [configKey]: cleanDividers };
            if (typeof this._compositionManager._executeProductRulesWithChanges === 'function') {
                DividerDebugLogger.log('Facade.updateSlot', 'Executing product rules with changes', {
                    traceId,
                    cabinetId,
                    changedKeys: Object.keys(changes)
                });
                await this._compositionManager._executeProductRulesWithChanges(entity, changes, updatedConfig);
            } else {
                DividerDebugLogger.log('Facade.updateSlot', 'Executing product rules with full config fallback', {
                    traceId,
                    cabinetId
                });
                await this._compositionManager._executeProductRules(entity, updatedConfig);
            }
        } else {
            DividerDebugLogger.warn('Facade.updateSlot', 'Cabinet entity not found; rules skipped', {
                traceId,
                cabinetId
            });
        }

        DividerDebugLogger.log('Facade.updateSlot', 'Slot update completed', {
            traceId,
            cabinetId,
            drawerType,
            zone,
            key,
            start: requestedStart,
            newValue
        });

        return true;
    }

    _resolveTargetSlot(drawerState, zone, key, explicitZoneIndex, requestedStateId, isRemove) {
        const slots = drawerState?.zones?.[zone]?.slots;
        if (!Array.isArray(slots)) return null;

        if (isRemove) {
            if (requestedStateId) {
                const byStateId = slots.find(slot =>
                    this._isOccupiedSlot(slot) && this._getSlotStateId(slot) === requestedStateId
                );
                if (byStateId) return byStateId;
            }

            if (explicitZoneIndex !== null) {
                const byZoneIndex = slots.find(slot =>
                    this._isOccupiedSlot(slot) && this._getSlotZoneIndex(slot) === explicitZoneIndex
                );
                if (byZoneIndex) return byZoneIndex;
            }

            const occupiedByKey = slots.find(slot => this._isOccupiedSlot(slot) && slot.key === key);
            if (occupiedByKey) return occupiedByKey;
        }

        const byKey = slots.find(slot => slot.key === key);
        if (byKey) return byKey;

        if (explicitZoneIndex !== null) {
            return slots.find(slot => this._getSlotZoneIndex(slot) === explicitZoneIndex) || null;
        }

        return null;
    }

    _isOccupiedSlot(slot) {
        return slot?.other?.type === 'occupied' ||
            Boolean(slot?.value && slot.value !== 'empty' && slot.value !== 'none');
    }

    _getSlotZoneIndex(slot) {
        const zoneIndex = slot?.other?.zoneIndex ?? slot?.zoneIndex;
        return Number.isInteger(Number(zoneIndex)) ? Number(zoneIndex) : null;
    }

    _getSlotStateId(slot) {
        return slot?.other?.stateId || slot?.stateId || null;
    }

    _getTopSiphonPlacementGuard(cabinetWidth, drawerType, fullSlot, slotData, zone, newValue, targetZoneIndex) {
        const strategy = fullSlot?.other?.strategy;
        if (drawerType !== 'Top') return null;
        if (strategy !== 'edges-left' && strategy !== 'edges-right') return null;

        const selectedWidth = DividerDefinitions.getDividerWidth(newValue);
        const zoneWidth = this._getTopSiphonZoneWidth(cabinetWidth, drawerType, zone);
        if (!Number.isFinite(zoneWidth) || zoneWidth <= 0) return null;

        const occupiedSlots = slotData?.zones?.[zone]?.slots;
        const occupiedByIndex = new Map();
        if (Array.isArray(occupiedSlots)) {
            for (const slot of occupiedSlots) {
                if (!slot?.value || slot.value === 'empty' || slot.value === 'none') continue;
                occupiedByIndex.set(Number(slot.zoneIndex), slot);
            }
        }

        // Динамічна ємність: вільне місце = ширина зони − Σ(усіх occupied).
        // Без count-cap «2» і без greedy по базовій A-сітці. Кандидат влазить,
        // якщо його ширина ≤ реального залишку; позиційну валідність далі
        // підтверджує перерахунок (Controller.getAllSlots → _conflicts).
        let occupiedWidth = 0;
        for (const slot of occupiedByIndex.values()) {
            occupiedWidth += DividerDefinitions.getDividerWidth(slot.value);
        }
        const remainingWidth = Math.max(0, zoneWidth - occupiedWidth);

        if (selectedWidth <= remainingWidth + 0.01) return null;

        return {
            reason: 'top-siphon-no-space',
            strategy,
            zoneWidth: DividerDebugLogger._round(zoneWidth),
            selectedWidth,
            remainingWidth: DividerDebugLogger._round(remainingWidth),
            occupiedZoneIndexes: Array.from(occupiedByIndex.keys())
        };
    }

    _getTopSiphonZoneWidth(cabinetWidth, drawerType, zoneName) {
        try {
            const configType = DividerDefinitions.getConfigType(drawerType);
            const innerWidth = this._controller.calculator._getInnerWidth(cabinetWidth);
            const zones = this._controller.calculator._getZones(innerWidth, configType);
            const zone = zones.find(item => item.name === zoneName);
            return zone ? zone.end - zone.start : null;
        } catch (_) {
            return null;
        }
    }

    _getAlignedWidePlacementGuard(fullState, fullSlot, slotData, zone, newValue, targetZoneIndex) {
        const strategy = fullSlot?.other?.strategy;
        if (strategy !== 'edges-left' && strategy !== 'edges-right') return null;

        const dividerWidth = DividerDefinitions.getDividerWidth(newValue);
        const baseWidth = DividerDefinitions.getDividerWidth('A');
        if (dividerWidth <= baseWidth) return null;

        const occupiedSlots = slotData?.zones?.[zone]?.slots;
        if (!Array.isArray(occupiedSlots)) return null;
        const occupiedCount = occupiedSlots.filter(slot =>
            slot?.value &&
            slot.value !== 'empty' &&
            slot.value !== 'none'
        ).length;
        if (occupiedCount === 0) return null;

        const fullSlots = fullState?.zones?.[zone]?.slots;
        if (!Array.isArray(fullSlots)) return null;

        const emptyZoneIndexes = fullSlots
            .filter(slot => !this._isOccupiedSlot(slot))
            .map(slot => this._getSlotZoneIndex(slot))
            .filter(zoneIndex => Number.isInteger(zoneIndex));

        if (emptyZoneIndexes.length <= 1) return null;

        const canonicalZoneIndex = strategy === 'edges-left'
            ? Math.min(...emptyZoneIndexes)
            : Math.max(...emptyZoneIndexes);

        if (targetZoneIndex === canonicalZoneIndex) return null;

        return {
            reason: 'aligned-wide-canonical-candidate',
            strategy,
            canonicalZoneIndex,
            emptyZoneIndexes,
            occupiedCount
        };
    }

    getDebugSnapshot() {
        const composition = this._compositionManager.getActiveComposition();
        const snapshot = DividerDebugLogger.snapshotComposition(composition);
        DividerDebugLogger.log('Facade.getDebugSnapshot', 'Captured active composition divider snapshot', snapshot);
        return snapshot;
    }
}
