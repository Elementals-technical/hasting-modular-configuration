import { Vec3 } from '../../../../../playcanvas-stable.min.mjs';

function _define_property(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else {
        obj[key] = value;
    }
    return obj;
}
class PlusButtonManager {
    static updateButtons() {}
    get buttonMode() {
        return this._buttonMode;
    }
    get buttonDraftConfig() {
        return this._buttonDraftConfig;
    }
    set displayButtons(value) {
        this._displayButtons = value;
        if (!value) {
            this._buttonMode = null;
            this._buttonDraftConfig = null;
            this._hideAll();
        } else {
            this.showAllButtons();
        }
    }
    get displayButtons() {
        return this._displayButtons;
    }
    setHandleButtonClick(callback) {
        this._onAddClick = callback;
        this._buttons.forEach((btn)=>{
            const handleClick = async (e)=>{
                e.stopPropagation();
                e.preventDefault();
                if (this._onAddClick) {
                    // Third argument: the column "+" ({ id, kind, cabinetId, rowId, positionM, ... }); undefined for legacy anchors.
                    await this._onAddClick(btn.parentEntity?.name, btn.side, btn.plus);
                }
                this.updatePositions();
            };
            btn.element.onmousedown = handleClick;
            btn.element.ontouchstart = handleClick;
        });
    }
    // --- SETUP: HTML & CSS ---
    _ensureUI() {
        const layerId = "auto-placement-ui-layer";
        // 1. Проверяем, есть ли уже слой
        let layer = document.getElementById(layerId);
        if (layer) return layer;
        // 2. Добавляем CSS стили, если их нет
        const styleId = "auto-placement-styles";
        if (!document.getElementById(styleId)) {
            const style = document.createElement("style");
            style.id = styleId;
            style.innerHTML = `
                /* Прозрачный контейнер поверх канваса */
                #${layerId} {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 100;
                    pointer-events: none; /* Пропускаем клики сквозь пустоту */
                    overflow: hidden;
                }

                /* Стиль кнопки */
                .ap-plus-btn {
                    position: absolute;
                    width: 36px;
                    height: 36px;
                    background-color: #AC5331; /* Brown */
                    color: white;
                    border-radius: 50%;
                    text-align: center;
                    line-height: 32px;
                    font-family: Arial, sans-serif;
                    font-size: 20px;
                    font-weight: bold;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                    cursor: pointer;
                    transform: translate(-50%, -50%); /* Центрирование */
                    transition: transform 0.2s, background-color 0.2s;
                    

                    align-items: center;
                    justify-content: center; 

                    /* ВАЖНО: Кнопки должны ловить клики */
                    pointer-events: auto; 

                    
                }

                .ap-plus-btn:hover {
                  filter: brightness(85%);
                    transform: translate(-50%, -50%) scale(1.1);
                    z-index: 101;
                }

                .ap-plus-btn--empty {
                    width: 48px;
                    height: 48px;
                    line-height: 44px;
                }
            `;
            document.head.appendChild(style);
        }
        layer = document.createElement("div");
        layer.id = layerId;
        document.body.appendChild(layer);
        return layer;
    }
    // --- PUBLIC API ---
    /**
   * @param {Array} anchorsData - [{ entity, left: Vec3, right: Vec3 }]
   */ setAnchors(anchorsData, { multiRow = false } = {}) {
        this.clearButtons();
        anchorsData.forEach((item)=>{
            if (item.left) this._createButton(item.entity, item.left, "left");
            if (item.right) this._createButton(item.entity, item.right, "right");
        });
        // One composition row keeps a single right "+"; free-layout rows each keep their own ends.
        if (!multiRow) this.excludeDuplicatedByX();
        this.updatePositions();
        if (this._onAddClick) {
            this.setHandleButtonClick(this._onAddClick);
        }
        if (this._displayButtons) {
            this.showAllButtons();
        }
    }
    showDefault() {
        if (this._buttons.length === 0) return;
        this._hideAll();
        let minBtn = this._buttons[0];
        let maxBtn = this._buttons[0];
        this._buttons.forEach((btn)=>{
            if (btn.position.x < minBtn.position.x) minBtn = btn;
            if (btn.position.x > maxBtn.position.x) maxBtn = btn;
        });
        if (minBtn) minBtn.element.style.display = "flex";
        if (maxBtn) maxBtn.element.style.display = "flex";
    }
    excludeDuplicatedByX() {
        const buttons = this._buttons.sort((a, b)=>a.position.x - b.position.x);
        this._buttons = buttons.filter((btn, index, arr)=>btn.side !== "right" || btn.side === "right" && index === arr.length - 1);
    }
    showAllButtons() {
        this._hideAll();
        this._buttons.forEach((btn)=>{
            if (!this._isPlusVisible(btn)) return;
            btn.element.style.display = "flex";
        });
    }
    // --- COLUMN "+" (rows with columns, `columns: true`) ---
    /**
   * Column "+" buttons from planColumnPlusButtons (column-plus-anchors.mjs). Unavailable ones get no button.
   * The click callback receives (cabinetId, kind, plus); kind ∈ left | right | left-top | right-top | top | bottom.
   * Fires 'plusButtons:changed' with the list, so the UI can choose what to show.
   * Example: setPlusButtons([{ id: 'top:b', kind: 'top', cabinetId: 'b', rowId: 'row-1',
   *   positionM: { x: 0.8, y: 0.42, z: 0.46 }, availability: 'available', reasons: [] }])
   * @param {{id, kind, cabinetId, rowId, positionM, availability, reasons}[]} list
   * @param {{entities?: pc.Entity[]}} [options] the cabinet entities, so a cabinet id resolves without a scene search
   */ setPlusButtons(list, { entities = [] } = {}) {
        this.clearButtons();
        const pluses = Array.isArray(list) ? list : [];
        const entityByName = new Map(entities.map((entity)=>[
                entity.name,
                entity
            ]));
        for (const plus of pluses){
            // A low cabinet does not fit there: no button at all.
            if (plus.availability !== "available") continue;
            const entity = entityByName.get(plus.cabinetId) ?? this._entityByName(plus.cabinetId);
            const position = new Vec3(plus.positionM.x, plus.positionM.y, plus.positionM.z);
            this._createButton(entity, position, plus.kind);
            const button = this._buttons[this._buttons.length - 1];
            button.plus = plus;
            button.kind = plus.kind;
        }
        this.updatePositions();
        if (this._onAddClick) {
            this.setHandleButtonClick(this._onAddClick);
        }
        if (this._displayButtons) {
            this.showAllButtons();
        }
        this.app.fire("plusButtons:changed", pluses);
    }
    /** Show only the column "+" the filter accepts; null shows every one. Re-applied on every showAllButtons. */ setPlusFilter(filter) {
        this._plusFilter = typeof filter === "function" ? filter : null;
        this._refreshVisibility();
    }
    /** @returns {{id, kind, cabinetId, rowId, availability, visible}[]} the column "+" buttons now in the scene */ listPlusButtons() {
        return this._buttons.filter((btn)=>btn.plus).map((btn)=>({
                id: btn.plus.id,
                kind: btn.plus.kind,
                cabinetId: btn.plus.cabinetId,
                rowId: btn.plus.rowId,
                availability: btn.plus.availability,
                visible: this._displayButtons && this._isPlusVisible(btn)
            }));
    }
    showPlus(id) {
        this._hiddenPlusIds.delete(id);
        this._refreshVisibility();
    }
    hidePlus(id) {
        this._hiddenPlusIds.add(id);
        this._refreshVisibility();
    }
    /** Un-hides the given kinds of "+" of one cabinet (by default the column ones: top and bottom). */ showForColumn(cabinetId, kinds = [
        "top",
        "bottom"
    ]) {
        for (const kind of kinds)this._hiddenPlusIds.delete(`${kind}:${cabinetId}`);
        this._refreshVisibility();
    }
    /** Hides every "+" of one cabinet. */ hideForColumn(cabinetId) {
        this._buttons.filter((btn)=>btn.plus?.cabinetId === cabinetId).forEach((btn)=>this._hiddenPlusIds.add(btn.plus.id));
        this._refreshVisibility();
    }
    /** Drops the filter and every per-id hide. */ resetPlusVisibility() {
        this._plusFilter = null;
        this._hiddenPlusIds.clear();
        this._refreshVisibility();
    }
    /** Legacy buttons (no plus) are always visible; a column "+" passes the filter and is not hidden by id. */ _isPlusVisible(btn) {
        if (!btn.plus) return true;
        const passesFilter = !this._plusFilter || this._plusFilter(btn.plus);
        return passesFilter && !this._hiddenPlusIds.has(btn.plus.id);
    }
    _refreshVisibility() {
        // Buttons are hidden as a whole: nothing to refresh.
        if (!this._displayButtons) return;
        this.showAllButtons();
        this.updatePositions();
    }
    _entityByName(name) {
        if (!name) return null;
        return this.app.root?.findByName?.(name) ?? null;
    }
    /**
   * @param {pc.Entity} entity
   */ showForEntity(entity) {
        this._hideAll();
        const targetButtons = this._buttons.filter((b)=>b.parentEntity === entity);
        targetButtons.forEach((btn)=>{
            btn.element.style.display = "flex";
        });
    }
    updatePositions() {
        const camera = this.camera.camera;
        if (!camera) return;
        this._buttons.forEach((btn)=>{
            if (btn.element.style.display === "none") return;
            camera.worldToScreen(btn.position, this._tempVec);
            if (this._tempVec.z > 0) {
                btn.element.style.left = `${this._tempVec.x}px`;
                btn.element.style.top = `${this._tempVec.y}px`;
            } else {
                btn.element.style.display = "none";
            }
        });
    }
    // --- EMPTY STATE ---
    /**
   * Підготовлює empty state кнопку (без показу).
   * Викликається автоматично коли сцена порожня.
   */ _prepareEmptyState() {
        this.clearButtons();
        this._isEmptyState = true;
        const emptyPos = new Vec3(0, 0.28, 0.49);
        this._createButton(null, emptyPos, "right", "ap-plus-btn--empty");
        if (this._onAddClick) {
            this.setHandleButtonClick(this._onAddClick);
        }
    }
    /**
   * Показує empty state кнопку "+" по центру сцени.
   * Використовується для зовнішнього контролю через API.
   */ showEmptyButton() {
        if (!this._isEmptyState) {
            this._prepareEmptyState();
        }
        this.showAllButtons();
        this.updatePositions();
    }
    /**
   * Ховає empty state кнопку.
   */ hideEmptyButton() {
        if (this._isEmptyState) {
            this._hideAll();
        }
    }
    /**
   * @deprecated Використовуйте showEmptyButton() для явного контролю.
   */ showEmptyState() {
        this._prepareEmptyState();
    }
    clearButtons() {
        this._buttons.forEach((b)=>b.element.remove());
        this._buttons = [];
        this._isEmptyState = false;
    }
    // --- INTERNAL ---
    _createButton(entity, position, side, extraClass = null) {
        const btn = document.createElement("div");
        btn.className = "ap-plus-btn" + (extraClass ? ` ${extraClass}` : "");
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
<path d="M0.75 6.58333H12.4167M6.58333 0.75V12.4167" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
        btn.style.display = "none";
        this.container.appendChild(btn);
        this._buttons.push({
            element: btn,
            position: position.clone(),
            side: side,
            parentEntity: entity
        });
    }
    _hideAll() {
        this._buttons.forEach((b)=>b.element.style.display = "none");
    }
    /**
   * @param {pc.Application} app
   * @param {pc.Entity} cameraEntity
   */ constructor(app, cameraEntity){
        _define_property(this, "_displayButtons", false);
        _define_property(this, "_isEmptyState", false);
        /**
   * Поточний режим кнопок: null = cabinets (default), 'Side-Shelf' = тільки Side-Shelf позиції
   */ _define_property(this, "_buttonMode", null);
        /**
   * Height / Handle of the cabinet the UI is about to add ({ config } of setVisibleButtons), null when not sent.
   * SceneManager._applyButtonRules reads it for the UF row rule (tall cabinets in one block).
   */ _define_property(this, "_buttonDraftConfig", null);
        this.app = app;
        this.camera = cameraEntity;
        this.container = this._ensureUI();
        this._buttons = [];
        this._tempVec = new Vec3();
        this._onAddClick = (entityName, side)=>{
            if (side === "left") {
                window.ConfiguratorAPI.addProductByLeft("CabinetUniBox");
            }
            if (side === "right") {
                window.ConfiguratorAPI.addProductByRight("CabinetUniBox");
            }
            // Column kinds (left-top, right-top, top, bottom): the UI picks the product, so the default does nothing.
            this.updatePositions();
        };
        /** Column "+" visibility: the UI filter (null = show all) and the ids it hid one by one. */ this._plusFilter = null;
        this._hiddenPlusIds = new Set();
        this.app.on("update", this.updatePositions, this);
        this.app.on("displayButtons:set", (value, options = {})=>{
            this._buttonMode = options.productType || null;
            this._buttonDraftConfig = options.config || null;
            this.displayButtons = value;
            // Перерахувати позиції з новим mode
            if (value && this.app.sceneManager) {
                this.app.sceneManager.updateButtonsPositions();
            }
        }, this);
    }
}

export { PlusButtonManager };
