import { BaseOverlayManager } from '../../../services/OverlaySystem/BaseOverlayManager.mjs';
import { PositionCalculator, AnchorType } from '../../../services/OverlaySystem/PositionCalculator.mjs';

const LAYER_ID = 'countertop-edit-overlay-layer';
const STYLE_ID = 'countertop-edit-overlay-styles';
const WIDGET_ID = 'countertop-edit-size';
const ACTION_TYPE = 'edit-size';
const ANCHOR_GAP_M = 0.06;
const ACTIVE_INTERACTION_STATES = Object.freeze(new Set([
    'selected',
    'editing',
    'dragging'
]));
const EDIT_SIZE_ICON = `<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
  <path d="M3 5.5V3h2.5M14.5 3H17v2.5M17 14.5V17h-2.5M5.5 17H3v-2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M6 10h8M7.75 8.25 6 10l1.75 1.75M12.25 8.25 14 10l-1.75 1.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
/**
 * One DOM action anchored to the active countertop. Position projection and
 * camera tracking are delegated to the existing BaseOverlayManager.
 */ class CountertopEditOverlay extends BaseOverlayManager {
    /** `source`: the countertop state source (`getState()`, `on('change', ({ state }) => …)`). */ bind({ source = this._service, binding = null, onAction = this._onAction } = {}) {
        if (this._destroyed) return;
        if (source !== this._service) {
            this._unsubscribeService?.();
            this._unsubscribeService = null;
            this._service = source || null;
            if (this._service?.on) {
                this._unsubscribeService = this._service.on('change', (payload)=>{
                    this.sync(payload?.state ?? null);
                });
            }
        }
        if (typeof onAction === 'function') this._onAction = onAction;
        const countertop = binding?.countertop || binding?.assembly?.countertop || null;
        const nextRoot = countertop?.root || null;
        const nextSurface = countertop?.mesh || nextRoot;
        const nextAnchor = countertop?.anchor || nextRoot;
        const targetChanged = nextRoot !== this._countertopRoot || nextSurface !== this._surfaceEntity || nextAnchor !== this._anchorEntity;
        this._countertopRoot = nextRoot;
        this._surfaceEntity = nextSurface;
        this._anchorEntity = nextAnchor;
        this._state = this._service?.getState?.() || this._state;
        if (targetChanged && this._button) this._removeWidget();
        this.sync();
    }
    sync(state = this._state) {
        if (this._destroyed) return false;
        if (state) this._state = state;
        if (!this.cameraEntity) {
            this.cameraEntity = this.app?.selectTool?.cameraEntity || this.app?.root?.findComponent?.('camera')?.entity || null;
        }
        const selected = Boolean(this._countertopRoot && this.app?.selectTool?.getSelected?.().includes(this._countertopRoot));
        // Resizing is only allowed while the countertop is moved off its composition.
        const active = this._state?.readiness === 'ready' && this._state?.canResize === true && ACTIVE_INTERACTION_STATES.has(this._state?.interactionState) && selected && Boolean(this._anchorEntity?.parent);
        if (!active) {
            this._removeWidget();
            this.setEnabled(false);
            return false;
        }
        if (!this._button) this._createWidget();
        this.refreshAnchor();
        this.setEnabled(true);
        return true;
    }
    refreshAnchor() {
        if (!this._button || !this._anchorEntity?.parent) return false;
        this._countertopRoot?.syncHierarchy?.();
        const orientation = this._countertopRoot || this._anchorEntity;
        let worldPosition;
        try {
            worldPosition = PositionCalculator.getPosition(this._surfaceEntity || this._countertopRoot, orientation, {
                face: AnchorType.TOP,
                offset: {
                    y: ANCHOR_GAP_M
                }
            });
        } catch (error) {
            worldPosition = this._anchorEntity.getPosition?.()?.clone?.() || null;
        }
        if (!worldPosition) return false;
        const anchorPosition = this._anchorEntity.getPosition();
        const widget = this._widgets.find((item)=>item.id === WIDGET_ID);
        if (!widget) return false;
        widget.position = {
            entity: this._anchorEntity,
            offset: {
                x: worldPosition.x - anchorPosition.x,
                y: worldPosition.y - anchorPosition.y,
                z: worldPosition.z - anchorPosition.z
            }
        };
        this._updatePositions();
        return true;
    }
    triggerEditSizeAction() {
        if (this._destroyed || !this._button || typeof this._onAction !== 'function') {
            return null;
        }
        return this._onAction(ACTION_TYPE);
    }
    shouldShowWidget(widget) {
        return super.shouldShowWidget(widget) && Boolean(this._anchorEntity?.parent);
    }
    destroy() {
        if (this._destroyed) return;
        this._destroyed = true;
        this._unsubscribeService?.();
        this._unsubscribeService = null;
        this._removeWidget();
        this.setEnabled(false);
        this.app?.off?.('update', this._updatePositions, this);
        if (this.container?.id === LAYER_ID && this.container.childElementCount === 0) {
            this.container.remove();
        }
        if (this._ownsStyleElement) this._styleElement?.remove();
        this._onAction = null;
        this._service = null;
        this._countertopRoot = null;
        this._surfaceEntity = null;
        this._anchorEntity = null;
        this._state = null;
        this._button = null;
        this._styleElement = null;
        this.cameraEntity = null;
        this.app = null;
    }
    _createWidget() {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'countertop-edit-size-button';
        button.dataset.action = ACTION_TYPE;
        button.setAttribute('aria-label', 'Edit countertop size');
        button.title = 'Edit size';
        button.innerHTML = EDIT_SIZE_ICON;
        const stopSceneInput = (event)=>{
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation?.();
        };
        button.onpointerdown = stopSceneInput;
        button.onmousedown = stopSceneInput;
        button.ontouchstart = stopSceneInput;
        button.onclick = (event)=>{
            stopSceneInput(event);
            this.triggerEditSizeAction();
        };
        this._button = button;
        this.addWidget(WIDGET_ID, {
            entity: this._anchorEntity,
            offset: {
                x: 0,
                y: ANCHOR_GAP_M,
                z: 0
            }
        }, button, {
            type: ACTION_TYPE
        });
    }
    _removeWidget() {
        if (!this._button && this._widgets.length === 0) return;
        this.clear();
        this._button = null;
    }
    _ensureStyles() {
        if (document.getElementById(STYLE_ID)) return null;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            .countertop-edit-size-button {
                position: absolute;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 40px;
                height: 40px;
                padding: 0;
                border: 0;
                border-radius: 999px;
                background: #282828;
                color: #fff;
                box-shadow: 0 3px 10px rgba(0, 0, 0, 0.35);
                cursor: pointer;
                pointer-events: auto;
                touch-action: none;
                transform: translate(-50%, -50%);
                transition: transform 120ms ease, filter 120ms ease;
                user-select: none;
                -webkit-user-select: none;
            }
            .countertop-edit-size-button:hover {
                filter: brightness(115%);
                transform: translate(-50%, -50%) scale(1.08);
            }
            .countertop-edit-size-button:focus-visible {
                outline: 2px solid #fff;
                outline-offset: 2px;
            }
        `;
        document.head.appendChild(style);
        return style;
    }
    constructor(app, cameraEntity, options = {}){
        super(app, cameraEntity, LAYER_ID);
        this._service = null;
        this._countertopRoot = null;
        this._surfaceEntity = null;
        this._anchorEntity = null;
        this._state = null;
        this._onAction = typeof options.onAction === 'function' ? options.onAction : null;
        this._unsubscribeService = null;
        this._button = null;
        this._destroyed = false;
        this._styleElement = this._ensureStyles();
        this._ownsStyleElement = Boolean(this._styleElement);
    }
}
function createCountertopEditOverlay(app, cameraEntity, options) {
    return new CountertopEditOverlay(app, cameraEntity, options);
}

export { CountertopEditOverlay, createCountertopEditOverlay };
