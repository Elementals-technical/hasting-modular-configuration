import { Script } from '../../../playcanvas-stable.min.mjs';

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
class GlobalAttributeManager extends Script {
    initialize() {
        // 1. Load initial state from Attribute
        this.parseJsonToMap(this._attributeDataJson);
        this.syncMapWithTags();
        // 2. UI Initialization
        this.initExternalUI();
        // 3. Apply initial logic
        this.applyToScene();
        this.on('destroy', ()=>{
            if (this._hostSectionControl) {
                this._hostSectionControl.remove();
            }
        });
    }
    /**
     * @attribute
     * @title Target Tags
     * @type {string[]}
     * @description List of tags to control (e.g. 'handle_a', 'handle_b').
     */ get targetTags() {
        return this._targetTags;
    }
    set targetTags(value) {
        this._targetTags = value;
        this.syncMapWithTags();
        this.rebuildListUI();
        this.applyToScene();
    }
    /**
     * @attribute
     * @title Attribute Data (JSON)
     * @type {string}
     */ get attributeDataJson() {
        return this._attributeDataJson;
    }
    set attributeDataJson(value) {
        this._attributeDataJson = value;
        this.parseJsonToMap(value);
        this.syncMapWithTags();
        this.rebuildListUI();
        this.applyToScene();
    }
    /**
     * @attribute
     * @title Show UI
     * @type {boolean}
     */ get showUI() {
        return this._showUI;
    }
    set showUI(value) {
        this._showUI = value;
        if (this._hostSectionControl) {
            this._hostSectionControl.setVisible(value);
        }
    }
    // --- LOGIC ---
    parseJsonToMap(jsonStr) {
        try {
            const parsed = JSON.parse(jsonStr);
            if (typeof parsed === 'object' && parsed !== null) {
                this._attributeMap = parsed;
            }
        } catch (e) {}
    }
    syncMapWithTags() {
        this._targetTags.forEach((tag)=>{
            if (this._attributeMap[tag] === undefined) {
                this._attributeMap[tag] = true;
            }
        });
    }
    applyToScene() {
        this._targetTags.forEach((tag)=>{
            const isActive = this._attributeMap[tag];
            const state = isActive !== undefined ? isActive : true;
            const entities = this.app.root.findByTag(tag);
            entities.forEach((entity)=>{
                if (entity.enabled !== state) entity.enabled = state;
            });
        });
    }
    // --- UI GENERATION ---
    initExternalUI() {
        if (this._uiContainer || !this.htmlAsset) return;
        if (this.cssAsset) {
            const style = document.createElement('style');
            style.innerHTML = this.cssAsset.resource || '';
            document.head.appendChild(style);
        }
        const div = document.createElement('div');
        div.innerHTML = this.htmlAsset.resource || '';
        this._uiContainer = div.firstElementChild;
        if (this._uiContainer) {
            this._listContainer = this._uiContainer.querySelector('.attr-list-container');
            this._copyBtn = this._uiContainer.querySelector('.attr-copy-btn');
            if (this._copyBtn) {
                this._copyBtn.addEventListener('click', ()=>this.copyJsonToClipboard());
            }
            this.rebuildListUI();
            // REGISTER TO HOST (Title: 'Attributes')
            if (this.app.uiLayout) {
                this._hostSectionControl = this.app.uiLayout.addSection('Attributes', this._uiContainer, this._showUI);
                this._hostSectionControl.setVisible(this._showUI);
            } else {
                console.warn('UiLayoutHost not found!');
            }
        }
    }
    rebuildListUI() {
        if (!this._listContainer) return;
        this._listContainer.innerHTML = '';
        this._targetTags.forEach((tag)=>{
            const row = document.createElement('div');
            row.className = 'attr-row';
            const label = document.createElement('span');
            label.className = 'attr-tag-label';
            label.innerText = tag;
            const switchLabel = document.createElement('label');
            switchLabel.className = 'attr-switch';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = this._attributeMap[tag] !== false;
            const slider = document.createElement('span');
            slider.className = 'attr-slider';
            checkbox.addEventListener('change', (e)=>{
                this._attributeMap[tag] = e.target.checked;
                this.applyToScene();
            });
            switchLabel.appendChild(checkbox);
            switchLabel.appendChild(slider);
            row.appendChild(label);
            row.appendChild(switchLabel);
            this._listContainer.appendChild(row);
        });
    }
    copyJsonToClipboard() {
        const cleanMap = {};
        this._targetTags.forEach((tag)=>{
            cleanMap[tag] = this._attributeMap[tag] !== false;
        });
        const jsonStr = JSON.stringify(cleanMap);
        const el = document.createElement('textarea');
        el.value = jsonStr;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        const originalText = this._copyBtn.innerText;
        this._copyBtn.innerText = "SAVED!";
        this._copyBtn.style.background = "#E91E63"; // Pink
        setTimeout(()=>{
            if (this._copyBtn) {
                this._copyBtn.innerText = originalText;
                this._copyBtn.style.background = "";
            }
        }, 1000);
    }
    constructor(...args){
        super(...args), // State
        _define_property(this, "_attributeMap", {}), _define_property(this, "_targetTags", []), _define_property(this, "_attributeDataJson", "{}"), _define_property(this, "_showUI", true), // DOM & Layout
        _define_property(this, "_uiContainer", null), _define_property(this, "_listContainer", null), _define_property(this, "_copyBtn", null), _define_property(this, "_hostSectionControl", null), // --- ATTRIBUTES ---
        /**
     * @attribute
     * @title HTML Template
     * @type {Asset}
     * @assetType html
     */ _define_property(this, "htmlAsset", void 0), /**
     * @attribute
     * @title CSS Styles
     * @type {Asset}
     * @assetType css
     */ _define_property(this, "cssAsset", void 0);
    }
}
_define_property(GlobalAttributeManager, "scriptName", 'globalAttributeManager');

export { GlobalAttributeManager };
