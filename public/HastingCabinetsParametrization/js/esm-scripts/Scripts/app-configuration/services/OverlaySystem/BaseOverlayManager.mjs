import { Vec3 } from '../../../../../playcanvas-stable.min.mjs';

class BaseOverlayManager {
    rescan() {
        this.clear();
    }
    /**
     * Додає widget до overlay.
     * @param {string} id - Унікальний ID
     * @param {Vec3|{entity: pc.Entity, offset: {x?: number, y?: number, z?: number}}} position
     *   - Vec3: статична world position (legacy)
     *   - { entity, offset }: динамічна позиція що слідує за entity кожен кадр
     * @param {HTMLElement} element - DOM елемент
     * @param {object} [data] - Додаткові дані
     */ addWidget(id, position, element, data = {}) {
        this.container.appendChild(element);
        this._widgets.push({
            id,
            position,
            element,
            data,
            visible: true
        });
    }
    clear() {
        this._widgets.forEach((w)=>{
            if (w.element && w.element.parentNode) w.element.remove();
        });
        this._widgets = [];
    }
    setEnabled(value) {
        this._enabled = value;
        this.container.style.display = value ? 'block' : 'none';
        if (value) {
            this._updatePositions();
        }
    }
    shouldShowWidget(widget) {
        return widget.visible;
    }
    /**
     * Обчислює world position для widget.
     * Підтримує статичний Vec3 та динамічний entity-based position.
     * @param {object} widget
     * @returns {Vec3} world position
     * @private
     */ _resolveWorldPosition(widget) {
        const pos = widget.position;
        // Entity-based: перераховується кожен кадр
        if (pos && pos.entity) {
            const entityPos = pos.entity.getPosition();
            const offset = pos.offset || {};
            this._tempWorldPos.set(entityPos.x + (offset.x || 0), entityPos.y + (offset.y || 0), entityPos.z + (offset.z || 0));
            return this._tempWorldPos;
        }
        // Static Vec3 (legacy)
        return pos;
    }
    _updatePositions() {
        if (!this._enabled || this._widgets.length === 0) return;
        const camera = this.cameraEntity?.camera;
        if (!camera) return;
        this._widgets.forEach((widget)=>{
            if (!this.shouldShowWidget(widget)) {
                widget.element.style.display = "none";
                return;
            }
            const worldPos = this._resolveWorldPosition(widget);
            camera.worldToScreen(worldPos, this._tempVec);
            if (this._tempVec.z > 0) {
                widget.element.style.display = widget.visible ? "flex" : "none";
                widget.element.style.left = `${this._tempVec.x}px`;
                widget.element.style.top = `${this._tempVec.y}px`;
            } else {
                widget.element.style.display = "none";
            }
        });
    }
    _ensureUI() {
        let layer = document.getElementById(this.layerId);
        if (!layer) {
            layer = document.createElement("div");
            layer.id = this.layerId;
            Object.assign(layer.style, {
                position: 'absolute',
                top: '0',
                left: '0',
                width: '100%',
                height: '100%',
                zIndex: '90',
                pointerEvents: 'none',
                overflow: 'hidden'
            });
            document.body.appendChild(layer);
        }
        return layer;
    }
    constructor(app, cameraEntity, layerId = "base-ui-layer"){
        this.app = app;
        this.cameraEntity = cameraEntity;
        this.layerId = layerId;
        this.container = this._ensureUI();
        this._widgets = [];
        this._tempVec = new Vec3();
        this._tempWorldPos = new Vec3();
        this._enabled = false;
        this.setEnabled(this._enabled);
        this.app.on("update", this._updatePositions, this);
    }
}

export { BaseOverlayManager };
