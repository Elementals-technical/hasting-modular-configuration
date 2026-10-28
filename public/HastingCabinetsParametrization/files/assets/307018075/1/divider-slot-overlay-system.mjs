// @ts-check
import { BaseOverlayManager } from "./BaseOverlayManager.mjs";
import { PositionCalculator } from "./PositionCalculator.mjs";

import { DividerDefinitions } from "../drawer-divider/core/DividerDefinitions.mjs";
import { DividerFacade } from "../drawer-divider/DividerFacade.mjs";
import { DividerDebugLogger } from "../drawer-divider/diagnostics/DividerDebugLogger.mjs";

/**
 * DividerSlotOverlaySystem v2 - мінімальна версія для малювання UI кнопок для ghost слотів
 * Показує кнопки "+" для додавання dividers у вільні слоти на основі даних DividerCalculator
 */
export class DividerSlotOverlaySystem extends BaseOverlayManager {

    constructor(app, cameraEntity) {
        super(app, cameraEntity, "divider-slot-overlay-layer");

        this._activeCabinetId = null;
        this._activeDrawerType = null;
        this._activeOverlayOptions = {};
        this._isActive = false;

        // Окремі callback для різних типів слотів
        this._onAddSlotClickCallback = null;
        this._onOccupiedSlotClickCallback = null;

        // Кастомні стилі для кнопок
        this._customStyles = {
            add: {},
            occupied: {},
            remove: {}
        };

        this._injectStyles();
    }

    /**
     * Активувати систему для конкретної шухляди
     * @param {string} cabinetId - ID кабінету
     * @param {'Top' | 'Bot' | 'TopFull'} drawerType - Тип шухляди
     */
    activateDrawer(cabinetId, drawerType, options = {}) {
        const normalizedOptions = this._normalizeActivationOptions(options);
        const traceId = normalizedOptions.debugRequestId || DividerDebugLogger.nextTraceId('divider-overlay');
        DividerDebugLogger.log('Overlay.activateDrawer', 'Activating divider overlay', {
            traceId,
            cabinetId,
            drawerType,
            options,
            normalizedOptions
        });
        DividerDebugLogger.log('ResizeOverlayCase.overlayActivateStart', 'Divider overlay activation started', {
            traceId,
            cabinetId,
            drawerType,
            selectedDividerType: normalizedOptions.selectedDividerType,
            usePlacementCandidates: normalizedOptions.usePlacementCandidates,
            runtimeBefore: DividerDebugLogger.summarizeDrawerRuntime(this.app, cabinetId, drawerType)
        });

        const facade = DividerFacade.instance;
        const slots = normalizedOptions.usePlacementCandidates
            ? facade.getPlacementCandidates(
                cabinetId,
                drawerType,
                this.app,
                normalizedOptions.selectedDividerType,
                traceId
            )
            : facade.getIconSlots(cabinetId, drawerType, this.app);
        
        this._activeOverlayOptions = normalizedOptions;
        this.renderSlots(slots, cabinetId, drawerType, { ...normalizedOptions, debugRequestId: traceId });
        this._isActive = true;

        DividerDebugLogger.log('Overlay.activateDrawer', 'Divider overlay activated', {
            traceId,
            cabinetId,
            drawerType,
            selectedDividerType: normalizedOptions.selectedDividerType,
            usePlacementCandidates: normalizedOptions.usePlacementCandidates,
            slots: DividerDebugLogger.summarizeSlots(slots)
        });
        DividerDebugLogger.log('ResizeOverlayCase.overlayActivateDone', 'Divider overlay activation completed', {
            traceId,
            cabinetId,
            drawerType,
            counts: this._getSlotRenderCounts(slots),
            duplicateSlotPositions: this._findDuplicateSlotPositions(slots),
            runtimeAfter: DividerDebugLogger.summarizeDrawerRuntime(this.app, cabinetId, drawerType)
        });
    }

    /**
     * Alias для activateDrawer (backward compatibility)
     */
    activate(cabinetId, drawerType, options = {}) {
        this.activateDrawer(cabinetId, drawerType, options);
    }
    /**
     * Деактивувати систему
     */
    deactivate() {
        DividerDebugLogger.log('Overlay.deactivate', 'Deactivating divider overlay', {
            activeCabinetId: this._activeCabinetId,
            activeDrawerType: this._activeDrawerType
        });
        DividerDebugLogger.log('ResizeOverlayCase.overlayDeactivate', 'Divider overlay deactivated', {
            runtimeBefore: DividerDebugLogger.summarizeDrawerRuntime(this.app)
        });
        this._activeCabinetId = null;
        this._activeDrawerType = null;
        this._activeOverlayOptions = {};
        this._isActive = false;
        this.setEnabled(false);
        this.clear();
    }
    /**
     * Встановити callback для кліку на ghost слот (додавання)
     * @param {Function} callback - Функція (slotInfo) => void
     */
    setOnAddSlotClick(callback) {
        this._onAddSlotClickCallback = callback;
        DividerDebugLogger.log('Overlay.setOnAddSlotClick', 'Add slot callback set', {
            hasCallback: typeof callback === 'function'
        });
    }

    /**
     * Встановити callback для кліку на occupied слот
     * @param {Function} callback - Функція (slotInfo) => void
     */
    setOnOccupiedSlotClick(callback) {
        this._onOccupiedSlotClickCallback = callback;
        DividerDebugLogger.log('Overlay.setOnOccupiedSlotClick', 'Occupied slot callback set', {
            hasCallback: typeof callback === 'function'
        });
    }

    /**
     * Встановити загальний callback для всіх слотів (backward compatibility)
     * @param {Function} callback - Функція (slotInfo) => void
     */
    setOnSlotClick(callback) {
        this._onAddSlotClickCallback = callback;
        this._onOccupiedSlotClickCallback = callback;
        DividerDebugLogger.log('Overlay.setOnSlotClick', 'Legacy slot callback set for add and occupied slots', {
            hasCallback: typeof callback === 'function'
        });
    }

    /**
     * Встановити кастомні стилі для кнопок
     * @param {Object} styles - Об'єкт стилів { add: {}, occupied: {}, remove: {} }
     * @example
     * setCustomStyles({
     *   add: { background: 'blue', borderRadius: '8px' },
     *   occupied: { background: 'green', fontSize: '24px' }
     * })
     */
    setCustomStyles(styles) {
        if (styles.add) this._customStyles.add = { ...this._customStyles.add, ...styles.add };
        if (styles.occupied) this._customStyles.occupied = { ...this._customStyles.occupied, ...styles.occupied };
        if (styles.remove) this._customStyles.remove = { ...this._customStyles.remove, ...styles.remove };
    }
    /**
     * Намалювати кнопки на основі готових даних слотів
     * @param {Array} slots - Результат з calculator.getAllPotentialSlots()
     * @param {string} cabinetId - ID кабінету
     * @param {'Top' | 'Bot' | 'TopFull'} drawerType - Тип шухляди
     * @example
     * const calculator = new DividerCalculator();
     * const slots = calculator.getAllPotentialSlots(80, 'STANDARD_WIDTH_SIPHON', ['C', 'C']);
     * dividerSlotOverlay.renderSlots(slots, 'Cabinet_1', 'Top');
     */
    renderSlots(slots, cabinetId, drawerType, options = {}) {
        const traceId = options.debugRequestId || DividerDebugLogger.nextTraceId('divider-render');
        const previousWidgets = this._summarizeWidgets(this._widgets);
        const previousWidgetCount = this._widgets.length;
        const previousDomChildCount = this.container?.children?.length || 0;
        this.clear();

        DividerDebugLogger.log('Overlay.renderSlots', 'Rendering divider overlay slots', {
            traceId,
            cabinetId,
            drawerType,
            options,
            previousWidgetCount,
            previousDomChildCount,
            previousWidgets,
            counts: this._getSlotRenderCounts(slots),
            duplicateSlotPositions: this._findDuplicateSlotPositions(slots),
            slots: DividerDebugLogger.summarizeSlots(slots)
        });
        DividerDebugLogger.log('ResizeOverlayCase.overlayRenderStart', 'Divider overlay render started', {
            traceId,
            cabinetId,
            drawerType,
            options,
            previousWidgetCount,
            previousDomChildCount,
            previousWidgets,
            counts: this._getSlotRenderCounts(slots),
            duplicateSlotPositions: this._findDuplicateSlotPositions(slots),
            slots: DividerDebugLogger.summarizeSlots(slots),
            runtimeBeforeRender: DividerDebugLogger.summarizeDrawerRuntime(this.app, cabinetId, drawerType)
        });

        const cabinet = this.app.root.findByName(cabinetId);
        if (!cabinet) {
            console.warn(`[DividerSlotOverlay] Cabinet not found: ${cabinetId}`);
            DividerDebugLogger.warn('Overlay.renderSlots', 'Cabinet entity not found', {
                traceId,
                cabinetId,
                drawerType
            });
            DividerDebugLogger.warn('ResizeOverlayCase.overlayRenderMissingTarget', 'Cabinet entity not found during divider overlay render', {
                traceId,
                cabinetId,
                drawerType,
                runtime: DividerDebugLogger.summarizeDrawerRuntime(this.app, cabinetId, drawerType)
            });
            return;
        }

        const pointName = DividerDefinitions.getScenePointName(drawerType);
        const drawerPoint = cabinet.findByName(pointName);
        if (!drawerPoint) {
            console.warn(`[DividerSlotOverlay] Drawer point not found: ${pointName}`);
            DividerDebugLogger.warn('Overlay.renderSlots', 'Drawer point not found', {
                traceId,
                cabinetId,
                drawerType,
                pointName
            });
            DividerDebugLogger.warn('ResizeOverlayCase.overlayRenderMissingTarget', 'Drawer point not found during divider overlay render', {
                traceId,
                cabinetId,
                drawerType,
                pointName,
                runtime: DividerDebugLogger.summarizeDrawerRuntime(this.app, cabinetId, drawerType)
            });
            return;
        }

        const floorName = DividerDefinitions.getSceneFloorName(drawerType);
        const PointForRender = drawerPoint.findByName(floorName);
        if (!PointForRender) {
            DividerDebugLogger.warn('Overlay.renderSlots', 'Drawer floor render point not found', {
                traceId,
                cabinetId,
                drawerType,
                floorName
            });
            DividerDebugLogger.warn('ResizeOverlayCase.overlayRenderMissingTarget', 'Drawer floor render point not found during divider overlay render', {
                traceId,
                cabinetId,
                drawerType,
                floorName,
                runtime: DividerDebugLogger.summarizeDrawerRuntime(this.app, cabinetId, drawerType)
            });
            return;
        }

        // Обчислюємо AABB offset один раз для всіх кнопок (TOP anchor = center.y + halfExtents.y)
        const aabb = PositionCalculator.getFullHierarchyAABB(PointForRender);
        const entityPos = PointForRender.getPosition();
        const aabbTopOffsetY = (aabb.center.y + aabb.halfExtents.y) - entityPos.y;

        // Встановлюємо активний стан
        this._activeCabinetId = cabinetId;
        this._activeDrawerType = drawerType;
        this._isActive = true;

        // Малюємо кнопки для всіх слотів
        slots.forEach((slot) => {
            if ((slot.other.type === 'ghost' || slot.other.type === 'candidate') && slot.value === 'empty') {
                this._createAddButtonForSlot(cabinet, PointForRender, slot, cabinetId, drawerType, aabbTopOffsetY);
            } else if (slot.other.type === 'occupied') {
                this._createOccupiedButtonForSlot(cabinet, PointForRender, slot, cabinetId, drawerType, aabbTopOffsetY);
            }
        });

        // Вмикаємо відображення overlay
        this.setEnabled(true);

        DividerDebugLogger.log('Overlay.renderSlots', 'Divider overlay widgets created', {
            traceId,
            cabinetId,
            drawerType,
            widgetCount: this._widgets.length,
            domChildCount: this.container?.children?.length || 0,
            widgets: this._summarizeWidgets(this._widgets)
        });
        DividerDebugLogger.log('ResizeOverlayCase.overlayRenderDone', 'Divider overlay widgets created', {
            traceId,
            cabinetId,
            drawerType,
            counts: this._getSlotRenderCounts(slots),
            widgetCount: this._widgets.length,
            domChildCount: this.container?.children?.length || 0,
            widgets: this._summarizeWidgets(this._widgets),
            runtimeAfterRender: DividerDebugLogger.summarizeDrawerRuntime(this.app, cabinetId, drawerType)
        });

        // Оновлюємо позиції в наступному фреймі, коли DOM елементи вже відрендерені
        requestAnimationFrame(() => {
            this._updatePositions();
            DividerDebugLogger.log('Overlay.renderSlots', 'Divider overlay positions updated after render', {
                traceId,
                cabinetId,
                drawerType,
                counts: this._getSlotRenderCounts(slots),
                renderedSlots: slots.length,
                widgets: this._summarizeWidgets(this._widgets)
            });
            DividerDebugLogger.log('ResizeOverlayCase.overlayPositionUpdate', 'Divider overlay positions updated after render', {
                traceId,
                cabinetId,
                drawerType,
                counts: this._getSlotRenderCounts(slots),
                renderedSlots: slots.length,
                widgets: this._summarizeWidgets(this._widgets),
                runtimeAfterPositionUpdate: DividerDebugLogger.summarizeDrawerRuntime(this.app, cabinetId, drawerType)
            });
        });
    }

    //

    /**
     * Пересканувати та перемалювати всі кнопки для ghost слотів
     */
    rescan() {
        if (!this._isActive || !this._activeCabinetId || !this._activeDrawerType) {
            DividerDebugLogger.log('Overlay.rescan', 'Rescan skipped because overlay is inactive', {
                isActive: this._isActive,
                activeCabinetId: this._activeCabinetId,
                activeDrawerType: this._activeDrawerType
            });
            return;
        }

        DividerDebugLogger.log('Overlay.rescan', 'Rescanning active divider overlay', {
            activeCabinetId: this._activeCabinetId,
            activeDrawerType: this._activeDrawerType,
            activeOverlayOptions: this._activeOverlayOptions
        });
        DividerDebugLogger.log('ResizeOverlayCase.overlayRescan', 'Rescanning active divider overlay', {
            runtimeBeforeRescan: DividerDebugLogger.summarizeDrawerRuntime(this.app, this._activeCabinetId, this._activeDrawerType)
        });

        // Просто перезапускаємо активацію з поточними параметрами
        this.activateDrawer(this._activeCabinetId, this._activeDrawerType, this._activeOverlayOptions);
    }

    /**
     * @private
     */
    _normalizeActivationOptions(options = {}) {
        if (!options || typeof options !== 'object') {
            return {
                selectedDividerType: null,
                usePlacementCandidates: false,
                debugRequestId: null
            };
        }

        const hasSelectedDividerType = Object.prototype.hasOwnProperty.call(options, 'selectedDividerType');
        return {
            selectedDividerType: options.selectedDividerType || null,
            usePlacementCandidates: Boolean(options.usePlacementCandidates || hasSelectedDividerType),
            debugRequestId: options.debugRequestId || null
        };
    }

    /**
     * @private
     */
    _getSlotRenderCounts(slots = []) {
        const list = Array.isArray(slots) ? slots : [];
        return {
            occupied: list.filter(slot => slot?.other?.type === 'occupied').length,
            ghost: list.filter(slot => slot?.other?.type === 'ghost').length,
            activeCandidates: list.filter(slot => slot?.other?.type === 'candidate' && slot?.other?.canPlace === true).length,
            disabledCandidates: list.filter(slot => slot?.other?.type === 'candidate' && slot?.other?.canPlace === false).length
        };
    }

    /**
     * @private
     */
    _findDuplicateSlotPositions(slots = []) {
        const groups = new Map();
        for (const slot of Array.isArray(slots) ? slots : []) {
            const zone = slot?.other?.zone || 'unknown';
            const center = DividerDebugLogger._round(slot?.position?.center);
            const key = `${zone}:${center}`;
            const group = groups.get(key) || [];
            group.push({
                key: slot?.key,
                value: slot?.value,
                slotType: slot?.other?.type,
                zoneIndex: slot?.other?.zoneIndex,
                placementType: slot?.other?.placementType,
                canPlace: slot?.other?.canPlace
            });
            groups.set(key, group);
        }

        return Array.from(groups.entries())
            .filter(([, group]) => group.length > 1)
            .map(([positionKey, group]) => ({ positionKey, slots: group }));
    }

    /**
     * @private
     */
    _summarizeWidgets(widgets = []) {
        return (Array.isArray(widgets) ? widgets : []).map(widget => ({
            id: widget?.id,
            visible: widget?.visible,
            data: {
                type: widget?.data?.type,
                key: widget?.data?.key,
                zone: widget?.data?.zone,
                zoneIndex: widget?.data?.zoneIndex,
                placementType: widget?.data?.placementType,
                canPlace: widget?.data?.canPlace,
                disabledReason: widget?.data?.disabledReason,
                dividerType: widget?.data?.dividerType,
                stateId: widget?.data?.stateId
            },
            offset: widget?.position?.offset
                ? {
                    x: DividerDebugLogger._round(widget.position.offset.x || 0),
                    y: DividerDebugLogger._round(widget.position.offset.y || 0),
                    z: DividerDebugLogger._round(widget.position.offset.z || 0)
                }
                : undefined,
            dom: DividerDebugLogger.summarizeDomElement(widget?.element)
        }));
    }

    /**
     * Створити "+" кнопку для legacy ghost або selected-type candidate слота.
     * @private
     */
    _createAddButtonForSlot(cabinet, drawerPoint, slot, cabinetId, drawerType, aabbTopOffsetY = 0) {
        const { key, position, other } = slot;
        const {
            type,
            zone,
            availableTypes,
            strategy,
            zoneIndex,
            placementType = null,
            disabledReason = null,
            start = null,
            anchor = null
        } = other;
        const isCandidate = type === 'candidate';
        const canPlace = isCandidate ? other.canPlace === true : true;
        const buttonType = canPlace ? 'add' : 'disabled';
        const logStage = isCandidate ? 'Overlay.candidateSlotClick' : 'Overlay.addSlotClick';
        const logMessage = isCandidate ? 'Placement candidate clicked' : 'Add divider slot clicked';

        const xPos = position.center;
        const dividerLabel = placementType ? ` ${placementType}` : '';

        // Створюємо DOM елемент кнопки
        const btnAdd = this._createButtonDOM(
            `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
<path d="M0.75 6.58333H12.4167M6.58333 0.75V12.4167" stroke="#282828" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`,
            buttonType,
            zone,
            canPlace ? `Add divider${dividerLabel} to ${zone}` : `Divider${dividerLabel} is not available here`,
            () => {
                DividerDebugLogger.log(logStage, logMessage, {
                    cabinetId,
                    drawerType,
                    zone,
                    key,
                    zoneIndex,
                    placementType,
                    canPlace,
                    disabledReason,
                    availableTypes,
                    slot: DividerDebugLogger.summarizeSlots([slot])
                });
                // Викликаємо callback з повною інформацією про слот
                if (this._onAddSlotClickCallback) {
                    this._onAddSlotClickCallback({
                        cabinetId,
                        drawerType,
                        slot,
                        zone,
                        availableTypes,
                        position: slot.position,
                        key: key,
                        zoneIndex,
                        start,
                        anchor,
                        placementType: isCandidate ? placementType : null,
                        canPlace,
                        disabledReason: isCandidate ? disabledReason : null,
                        debugRequestId: this._activeOverlayOptions?.debugRequestId || null
                    });
                } else {
                    DividerDebugLogger.warn(logStage, 'Add slot click has no registered callback', {
                        cabinetId,
                        drawerType,
                        zone,
                        key,
                        zoneIndex,
                        placementType,
                        canPlace,
                        disabledReason
                    });
                }
            },
            canPlace ? this._customStyles.add : {}
        );

        const widgetId = isCandidate
            ? `${cabinetId}_${drawerType}_${zone}_${zoneIndex}_${placementType || 'none'}_${canPlace ? 'candidate' : 'disabled'}`
            : `${cabinetId}_${drawerType}_${key}`;
        // Entity-based позиція: слідує за drawerPoint кожен кадр
        this.addWidget(widgetId, { entity: drawerPoint, offset: { x: xPos, y: aabbTopOffsetY, z: 0 } }, btnAdd, {
            type: isCandidate ? (canPlace ? 'candidate-slot' : 'disabled-candidate-slot') : 'add-slot',
            key: key,
            zone,
            cabinetId,
            drawerType,
            strategy,
            zoneIndex,
            placementType,
            canPlace,
            disabledReason,
            availableTypes
        });

        DividerDebugLogger.log('Overlay.createAddButton', 'Divider add button created', {
            traceId: this._activeOverlayOptions?.debugRequestId,
            widgetId,
            cabinetId,
            drawerType,
            zone,
            key,
            zoneIndex,
            placementType,
            canPlace,
            disabledReason,
            availableTypes,
            position: {
                start: DividerDebugLogger._round(position.start),
                center: DividerDebugLogger._round(position.center),
                end: DividerDebugLogger._round(position.end)
            },
            offset: {
                x: DividerDebugLogger._round(xPos),
                y: DividerDebugLogger._round(aabbTopOffsetY),
                z: 0
            }
        });
    }

    /**
     * Створити кнопку "✓" для occupied слота
     * @private
     */
    _createOccupiedButtonForSlot(cabinet, drawerPoint, slot, cabinetId, drawerType, aabbTopOffsetY = 0) {
        const { key, position, other, value } = slot;
        const { zone, stateId, zoneIndex, strategy } = other;

        const xPos = position.center;

        // Створюємо DOM елемент кнопки з галочкою
        const btnOccupied = this._createButtonDOM(
            `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="11" viewBox="0 0 15 11" fill="none">
<path d="M14.0833 0.75L4.91667 9.91667L0.75 5.75" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`,
            'occupied',
            zone,
            `Divider ${value} at ${zone}`,
            () => {
                DividerDebugLogger.log('Overlay.occupiedSlotClick', 'Occupied divider slot clicked', {
                    cabinetId,
                    drawerType,
                    zone,
                    key,
                    stateId,
                    zoneIndex,
                    dividerType: value,
                    slot: DividerDebugLogger.summarizeSlots([slot])
                });
                // Викликаємо callback для occupied слота (можна використати для видалення)
                if (this._onOccupiedSlotClickCallback) {
                    this._onOccupiedSlotClickCallback({
                        cabinetId,
                        drawerType,
                        slot,
                        zone,
                        position: slot.position,
                        key: key,
                        stateId: stateId,
                        zoneIndex: zoneIndex,
                        dividerType: value,
                        isOccupied: true,
                        debugRequestId: this._activeOverlayOptions?.debugRequestId || null
                    });
                } else {
                    DividerDebugLogger.warn('Overlay.occupiedSlotClick', 'Occupied slot click has no registered callback', {
                        cabinetId,
                        drawerType,
                        zone,
                        key,
                        stateId,
                        zoneIndex,
                        dividerType: value
                    });
                }
            },
            this._customStyles.occupied
        );

        const widgetId = `${cabinetId}_${drawerType}_${key}`;
        // Entity-based позиція: слідує за drawerPoint кожен кадр
        this.addWidget(widgetId, { entity: drawerPoint, offset: { x: xPos, y: aabbTopOffsetY, z: 0 } }, btnOccupied, {
            type: 'occupied-slot',
            key: key,
            zone,
            cabinetId,
            drawerType,
            strategy,
            stateId,
            zoneIndex,
            dividerType: value
        });

        DividerDebugLogger.log('Overlay.createOccupiedButton', 'Divider occupied button created', {
            traceId: this._activeOverlayOptions?.debugRequestId,
            widgetId,
            cabinetId,
            drawerType,
            zone,
            key,
            zoneIndex,
            stateId,
            dividerType: value,
            position: {
                start: DividerDebugLogger._round(position.start),
                center: DividerDebugLogger._round(position.center),
                end: DividerDebugLogger._round(position.end)
            },
            offset: {
                x: DividerDebugLogger._round(xPos),
                y: DividerDebugLogger._round(aabbTopOffsetY),
                z: 0
            }
        });
    }

    /**
     * Створити DOM кнопку (універсальний метод)
     * @private
     * @param {string} icon - Іконка кнопки ('+', '✓', і т.д.)
     * @param {string} type - Тип кнопки ('add', 'occupied', 'remove')
     * @param {string} zone - Назва зони
     * @param {string} title - Підказка при наведенні
     * @param {Function} onClick - Обробник кліку
     * @param {Object} customStyles - Кастомні inline стилі
     */
    _createButtonDOM(icon, type, zone, title, onClick, customStyles = {}) {
        const container = document.createElement("div");
        container.className = "divider-slot-control";

        const btn = document.createElement("div");
        btn.className = `divider-slot-btn divider-slot-${type}`;
        btn.innerHTML = icon;
        btn.title = title;
        btn.dataset.zone = zone;
        btn.dataset.type = type;

        // Застосовуємо кастомні стилі
        Object.keys(customStyles).forEach(styleProp => {
            btn.style[styleProp] = customStyles[styleProp];
        });

        const stopSceneSelection = (e) => {
            e.stopPropagation();
        };

        btn.onpointerdown = stopSceneSelection;
        btn.onmousedown = stopSceneSelection;
        btn.ontouchstart = stopSceneSelection;
        btn.onclick = (e) => {
            stopSceneSelection(e);
            e.preventDefault();
            onClick();
        };

        container.appendChild(btn);
        return container;
    }


    /**
     * Ін'єкція CSS стилів
     * @private
     */
    _injectStyles() {
        if (document.getElementById("divider-slot-overlay-styles")) return;

        const style = document.createElement("style");
        style.id = "divider-slot-overlay-styles";
        style.innerHTML = `
            .divider-slot-control {
                position: relative;
            }

            .divider-slot-btn {
                position: absolute;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 36px;
                height: 36px;
                border-radius: 50%;
                font-family: 'Segoe UI', Arial, sans-serif;
                font-size: 20px;
                font-weight: 700;
                box-shadow: 0 3px 10px rgba(0,0,0,0.35);
                cursor: pointer;
                pointer-events: auto;
                transform: translate(-50%, -50%);
                transition: all 0.2s ease;
                user-select: none; 

                box-shadow:
    0 8px 20px rgba(0,0,0,0.18),
    0 2px 6px rgba(0,0,0,0.12);
            }

            /* Кнопка додавання (плюс) - зелена */
            .divider-slot-add {
                background: #E5E6EA;
                color: white;
            }

            .divider-slot-add:hover {
                 filter: brightness(85%);
                transform: translate(-50%, -50%) scale(1.2);
              box-shadow:
    0 14px 34px rgba(0,0,0,0.18),
    0 6px 14px rgba(0,0,0,0.12);
                z-index: 95;
            }

            .divider-slot-disabled {
                background: #D7D9DE;
                color: #8B9099;
                cursor: not-allowed;
                opacity: 0.7;
            }

            .divider-slot-disabled:hover {
                filter: brightness(96%);
                transform: translate(-50%, -50%) scale(1.05);
                box-shadow:
    0 8px 20px rgba(0,0,0,0.14),
    0 2px 6px rgba(0,0,0,0.1);
                z-index: 95;
            }

            /* Кнопка зайнятого слота (галочка) - синя */
            .divider-slot-occupied {
                background: #282828;
                color: white;
                font-size: 18px;
            }

            .divider-slot-occupied:hover { 
                 filter: brightness(85%);
                transform: translate(-50%, -50%) scale(1.2);
               box-shadow:
    0 14px 34px rgba(0,0,0,0.28),
    0 6px 14px rgba(0,0,0,0.18);
                z-index: 95;
            }
 
             
        `;
        document.head.appendChild(style);
    }
}
