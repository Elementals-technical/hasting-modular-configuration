import { BaseOverlayManager } from "./BaseOverlayManager.mjs";
import { PositionCalculator, AnchorType } from "./PositionCalculator.mjs";

/**
 * DrawerOverlaySystem — UI overlay для drawer кнопок (Open/Close) та divider indicator.
 *
 * Підтримує два режими рендерингу:
 * 1. Default — вбудований HTML (indicator ✓ + "Open Drawer" кнопка)
 * 2. Callback — фронтенд повністю контролює DOM через onDrawerWidgetRender()
 */
export class DrawerOverlaySystem extends BaseOverlayManager {

    /** Дефолтна SVG іконка indicator */
    static DEFAULT_INDICATOR_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
  <path d="M16.6667 5L7.50001 14.1667L3.33334 10" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

    constructor(app, cameraEntity) {
        super(app, cameraEntity, "drawer-overlay-layer");

        this._isEditMode = false;
        this._activeDrawerId = null;

        // Callback renderers (null = дефолтний рендер)
        this._widgetRenderer = null;
        this._closeWidgetRenderer = null;

        this._injectStyles();
    }

    // ====== PUBLIC API ======

    /**
     * Встановити кастомний renderer для Open Drawer widget.
     * @param {Function|null} callback - (drawerInfo, parentEl) => void, або null для дефолту
     * @param {object} callback.drawerInfo
     * @param {string} callback.drawerInfo.cabinetId
     * @param {string} callback.drawerInfo.drawerType - 'Top' | 'TopFull' | 'Bot'
     * @param {boolean} callback.drawerInfo.hasOccupiedDividers
     * @param {number} callback.drawerInfo.dividerCount
     * @param {string[]} callback.drawerInfo.dividerTypes
     * @param {HTMLElement} callback.parentEl - Порожній контейнер для DOM
     */
    setWidgetRenderer(callback) {
        this._widgetRenderer = callback || null;
        this.rescan();
    }

    /**
     * Встановити кастомний renderer для Close widget.
     * @param {Function|null} callback - (drawerInfo, parentEl) => void, або null для дефолту
     */
    setCloseWidgetRenderer(callback) {
        this._closeWidgetRenderer = callback || null;
        this.rescan();
    }

    // ====== RESCAN ======

    rescan() {
        this.clear();

        const allDrawers = this._findAllDrawers(this.app.root);

        allDrawers.forEach(point => {
            const context = this._resolveContext(point);
            if (!context) return;
            if (!this._shouldExposeDrawerPoint(point, context)) return;

            const { cabinet, type } = context;
            const uniqueId = `${cabinet.name}_${type}`;
            const dividerInfo = this._getDividerInfo(cabinet.name, type);

            const drawerInfo = {
                cabinetId: cabinet.name,
                drawerType: type,
                ...dividerInfo
            };

            // Entity що рухається при анімації drawer (OpenClose_Point)
            const openClosePointName = point.name.replace('Drawer_Point', 'DrawerOpenClose_Point');
            const openClosePoint = cabinet.findByName(openClosePointName) || point;

            // Обчислюємо offset від entity один раз (AABB-based)
            const aabbOpen = PositionCalculator.getPosition(point, cabinet, {
                face: AnchorType.FRONT,
                offset: { z: -0.05 }
            });
            const aabbClose = PositionCalculator.getPosition(point, cabinet, {
                face: AnchorType.FRONT,
                offset: { y: 0.30 }
            });

            // Open widget offset відносно point (статичний, drawer закритий)
            const pointPos = point.getPosition();
            const openOffset = {
                x: aabbOpen.x - pointPos.x,
                y: aabbOpen.y - pointPos.y,
                z: aabbOpen.z - pointPos.z
            };

            // Close widget offset відносно openClosePoint (рухається з анімацією)
            const openClosePos = openClosePoint.getPosition();
            const closeOffset = {
                x: aabbClose.x - openClosePos.x,
                y: aabbClose.y - openClosePos.y,
                z: aabbClose.z - openClosePos.z
            };

            // ====== Open Widget (прив'язаний до point — не рухається) ======
            const openGroup = document.createElement("div");
            openGroup.className = "drawer-open-group";

            if (this._widgetRenderer) {
                this._widgetRenderer(drawerInfo, openGroup);
            } else {
                this._renderDefaultOpenWidget(drawerInfo, openGroup);
            }

            this.addWidget(`${uniqueId}_open`, { entity: point, offset: openOffset }, openGroup, {
                type: 'open',
                groupId: uniqueId,
                ...dividerInfo
            });

            // ====== Close Widget (прив'язаний до openClosePoint — слідує за анімацією) ======
            const closeGroup = document.createElement("div");
            closeGroup.className = "drawer-close-group";

            if (this._closeWidgetRenderer) {
                this._closeWidgetRenderer({ ...drawerInfo, isEditMode: true }, closeGroup);
            } else {
                this._renderDefaultCloseWidget(drawerInfo, closeGroup);
            }

            this.addWidget(`${uniqueId}_close`, { entity: openClosePoint, offset: closeOffset }, closeGroup, {
                type: 'close',
                groupId: uniqueId
            });
        });

        this._updateStateVisibility();
    }

    handleViewStateChange(isActive, cabinetId, drawerType) {
        this._isEditMode = isActive;
        this._activeDrawerId = isActive ? `${cabinetId}_${drawerType}` : null;

        if (!isActive) {
            // При виході з edit mode — повний rescan (dividers могли змінитись)
            this.rescan();
        } else {
            this._updateStateVisibility();
        }
    }

    // ====== DEFAULT RENDERERS ======

    /**
     * Дефолтний рендер Open widget: indicator (✓) + "Open Drawer" кнопка
     */
    _renderDefaultOpenWidget(drawerInfo, parentEl) {
        // Indicator — тільки якщо є dividers
        if (drawerInfo.hasOccupiedDividers) {
            const indicator = document.createElement("div");
            indicator.className = "divider-indicator";
            indicator.innerHTML = DrawerOverlaySystem.DEFAULT_INDICATOR_ICON;
            parentEl.appendChild(indicator);
        }

        // Button
        const btn = document.createElement("div");
        btn.className = "divider-ui-btn divider-open";
        btn.innerHTML = `<span>Open Drawer</span>`;
        btn.onclick = (e) => {
            e.stopPropagation();
            if (window.ConfiguratorAPI?.showTopView) {
                window.ConfiguratorAPI.showTopView(drawerInfo.cabinetId, drawerInfo.drawerType);
            }
        };
        parentEl.appendChild(btn);
    }

    /**
     * Дефолтний рендер Close widget
     */
    _renderDefaultCloseWidget(drawerInfo, parentEl) {
        const btn = document.createElement("div");
        btn.className = "divider-ui-btn divider-close";
        btn.innerHTML = `<span style="font-size:14px; margin-right:4px;">&#8617;</span> Close`;
        btn.onclick = (e) => {
            e.stopPropagation();
            if (window.ConfiguratorAPI?.exitTopView) {
                window.ConfiguratorAPI.exitTopView();
            }
        };
        parentEl.appendChild(btn);
    }

    // ====== VISIBILITY ======

    _updateStateVisibility() {
        this._widgets.forEach(w => {
            const { type, groupId } = w.data;

            if (this._isEditMode) {
                if (type === 'close' && groupId === this._activeDrawerId) {
                    w.visible = true;
                } else {
                    w.visible = false;
                }
            } else {
                if (type === 'open') {
                    w.visible = true;
                } else {
                    w.visible = false;
                }
            }
        });

        this._updatePositions();
    }

    // ====== DIVIDER INFO ======

    _getDividerInfo(cabinetId, drawerType) {
        const config = this._getProductConfig(cabinetId);
        if (!config) return { hasOccupiedDividers: false, dividerCount: 0, dividerTypes: [] };

        const dividerKey = drawerType === 'Bot' ? 'BotDrawerDividers' : 'TopDrawerDividers';
        const dividers = config[dividerKey];
        if (!dividers?.zones) return { hasOccupiedDividers: false, dividerCount: 0, dividerTypes: [] };

        const occupiedSlots = [];
        for (const zone of Object.values(dividers.zones)) {
            if (!zone.slots) continue;
            for (const slot of zone.slots) {
                if (slot.other?.type === 'occupied') {
                    occupiedSlots.push(slot.value);
                }
            }
        }

        return {
            hasOccupiedDividers: occupiedSlots.length > 0,
            dividerCount: occupiedSlots.length,
            dividerTypes: occupiedSlots
        };
    }

    // ====== HELPERS ======

    _resolveContext(point) {
        let cabinet = point.parent;
        while (cabinet && !cabinet.name.includes('Sink') && !cabinet.name.includes('Cabinet')) {
            cabinet = cabinet.parent;
        }
        if (!cabinet) cabinet = point.parent.parent;
        if (!cabinet) return null;

        const config = this._getProductConfig(cabinet.name);

        let type;
        if (point.name === 'BotDrawer_Point') {
            type = 'Bot';
        } else if (point.name === 'TopDrawer_Point') {
            type = config?.topDrawerType || 'Top';
        } else {
            type = 'Top';
        }

        return { cabinet, type, config };
    }

    _shouldExposeDrawerPoint(point, context) {
        const drawers = this._normalizeDrawers(context.config?.Drawers);

        if (drawers === '1D' || drawers === '1' || drawers === '1DWID' || drawers === '1+INNER') {
            return point.name === 'BotDrawer_Point' && context.type === 'Bot';
        }

        return true;
    }

    _normalizeDrawers(drawers) {
        return String(drawers || '').trim().toUpperCase();
    }

    _getProductConfig(cabinetId) {
        if (!this.app.compositionManager) return null;
        const composition = this.app.compositionManager.getActiveComposition();
        return composition?.getProduct(cabinetId);
    }

    _findAllDrawers(node, result = []) {
        if (node.name === 'TopDrawer_Point' || node.name === 'BotDrawer_Point') {
            let curr = node;
            let isVisible = true;
            while (curr && curr.parent) {
                if (!curr.enabled) { isVisible = false; break; }
                curr = curr.parent;
            }
            if (isVisible) result.push(node);
        }
        if (node.children) {
            for (const child of node.children) this._findAllDrawers(child, result);
        }
        return result;
    }

    // ====== STYLES ======

    _injectStyles() {
        if (document.getElementById("drawer-ui-styles")) return;
        const style = document.createElement("style");
        style.id = "drawer-ui-styles";
        style.innerHTML = `
            .divider-ui-btn {
                position: absolute;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 4px 10px;
                background-color: #A05535;
                color: white;
                border-radius: 12px;
                font-family: 'Segoe UI', Arial, sans-serif;
                font-size: 11px;
                font-weight: 600;
                box-shadow: 0 2px 6px rgba(0,0,0,0.2);
                cursor: pointer;
                pointer-events: auto;
                transform: translate(-50%, -50%);
                transition: transform 0.1s;
                user-select: none;
                white-space: nowrap;
            }
            .divider-ui-btn:hover {
                background-color: #8a482d;
                transform: translate(-50%, -50%) scale(1.05);
                z-index: 91;
            }
            .drawer-open-group {
                position: absolute;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 6px;
                transform: translate(-50%, -50%);
                pointer-events: none;
            }
            .drawer-open-group .divider-ui-btn {
                position: static;
                transform: none;
                pointer-events: auto;
            }
            .drawer-close-group {
                position: absolute;
                transform: translate(-50%, -50%);
            }
            .drawer-close-group .divider-ui-btn {
                position: static;
                transform: none;
            }
            .divider-indicator {
                display: flex;
                width: 36px;
                height: 36px;
                padding: 8px;
                justify-content: center;
                align-items: center;
                aspect-ratio: 1/1;
                background: #282828;
                border-radius: 100px;
                box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                pointer-events: none;
            }
        `;
        document.head.appendChild(style);
    }
}
