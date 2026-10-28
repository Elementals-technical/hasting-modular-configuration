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
class GlobalMaterialManager extends Script {
    initialize() {
        this.collectMaterials();
        this.parseJsonToMap(this._materialDataJson);
        this.initExternalUI();
        // Initial application based on saved JSON
        this.applyToScene();
        // Handle assets adding late (e.g. dynamic load)
        this.app.assets.on('add', this.onAssetAdd, this);
        this.on('destroy', ()=>{
            this.app.assets.off('add', this.onAssetAdd, this);
            if (this._hostSectionControl) this._hostSectionControl.remove();
        });
    }
    /**
     * @attribute
     * @title Material Tags
     * @type {string[]}
     * @description Tags to find MATERIAL ASSETS in Registry.
     */ get materialTags() {
        return this._materialTags;
    }
    set materialTags(value) {
        this._materialTags = value;
        this.collectMaterials();
        this.rebuildListUI();
    }
    /**
     * @attribute
     * @title Model Tags
     * @type {string[]}
     * @description Tags to find TARGET MODELS in Scene. One dropdown per tag.
     */ get modelTags() {
        return this._modelTags;
    }
    set modelTags(value) {
        this._modelTags = value;
        this.rebuildListUI();
        this.applyToScene();
    }
    /**
     * @attribute
     * @title Material Data (JSON)
     * @type {string}
     */ get materialDataJson() {
        return this._materialDataJson;
    }
    set materialDataJson(value) {
        this._materialDataJson = value;
        this.parseJsonToMap(value);
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
        if (this._hostSectionControl) this._hostSectionControl.setVisible(value);
    }
    // --- LOGIC ---
    onAssetAdd(asset) {
        if (asset.type === 'material') {
            const matches = this._materialTags.some((tag)=>asset.tags.has(tag));
            if (matches) {
                this.collectMaterials();
                this.rebuildListUI();
            }
        }
    }
    collectMaterials() {
        this._materialAssets = [];
        const seenIds = new Set();
        this._materialTags.forEach((tag)=>{
            // findByTag gets metadata even if asset is not loaded (Preload: false)
            const assets = this.app.assets.findByTag(tag);
            assets.forEach((a)=>{
                if (a.type === 'material' && !seenIds.has(a.id)) {
                    this._materialAssets.push(a);
                    seenIds.add(a.id);
                }
            });
        });
        this._materialAssets.sort((a, b)=>a.name.localeCompare(b.name));
    }
    parseJsonToMap(jsonStr) {
        try {
            const parsed = JSON.parse(jsonStr);
            if (typeof parsed === 'object' && parsed !== null) {
                this._assignments = parsed;
            }
        } catch (e) {}
    }
    /**
     * Applies materials to the scene. Handles Lazy Loading.
     */ applyToScene() {
        this._modelTags.forEach((modelTag)=>{
            const assignedMatName = this._assignments[modelTag];
            if (!assignedMatName) return;
            const matAsset = this._materialAssets.find((a)=>a.name === assignedMatName);
            if (!matAsset) return;
            if (matAsset.resource) {
                this._applyResourceToTag(matAsset.resource, modelTag);
            } else {
                matAsset.ready((loadedAsset)=>{
                    if (this._assignments[modelTag] === loadedAsset.name) {
                        this._applyResourceToTag(loadedAsset.resource, modelTag);
                    }
                });
                this.app.assets.load(matAsset);
            }
        });
    }
    _applyResourceToTag(materialResource, modelTag) {
        const entities = this.app.root.findByTag(modelTag);
        entities.forEach((entity)=>{
            let changed = false;
            // 1. Assign new material
            if (entity.render) {
                entity.render.meshInstances.forEach((mi)=>{
                    mi.material = materialResource;
                    changed = true;
                });
            }
            if (entity.model && entity.model.meshInstances) {
                entity.model.meshInstances.forEach((mi)=>{
                    mi.material = materialResource;
                    changed = true;
                });
            }
            // 2. Refresh logic if material changed
            if (changed && entity.script) {
                // Refresh TriPlanarMapping
                if (entity.script.triPlanarMapping && typeof entity.script.triPlanarMapping.refreshMaterials === 'function') {
                    entity.script.triPlanarMapping.refreshMaterials();
                }
                // Refresh SmartStretch
                if (entity.script.smartStretch && typeof entity.script.smartStretch.refreshMaterials === 'function') {
                    entity.script.smartStretch.refreshMaterials();
                }
                // Force MeshBoolean update
                if (entity.script.meshBoolean && typeof entity.script.meshBoolean.performBoolean === 'function') {
                    entity.script.meshBoolean.performBoolean();
                }
            }
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
            const stop = (e)=>e.stopPropagation();
            [
                'mousedown',
                'mousemove',
                'mouseup',
                'wheel',
                'touchstart',
                'touchmove',
                'touchend'
            ].forEach((evt)=>this._uiContainer.addEventListener(evt, stop));
            this._listContainer = this._uiContainer.querySelector('.mat-list-container');
            this._copyBtn = this._uiContainer.querySelector('.mat-copy-btn');
            if (this._copyBtn) {
                this._copyBtn.addEventListener('click', ()=>this.copyJsonToClipboard());
            }
            this.rebuildListUI();
            if (this.app.uiLayout) {
                this._hostSectionControl = this.app.uiLayout.addSection('Materials', this._uiContainer, this._showUI);
                this._hostSectionControl.setVisible(this._showUI);
            } else {
                console.warn('UiLayoutHost not found!');
            }
        }
    }
    rebuildListUI() {
        if (!this._listContainer) return;
        this._listContainer.innerHTML = '';
        this._modelTags.forEach((modelTag)=>{
            const row = document.createElement('div');
            row.className = 'mat-row';
            const label = document.createElement('div');
            label.className = 'mat-label';
            label.innerText = modelTag;
            const dropdownWrapper = document.createElement('div');
            dropdownWrapper.className = 'mat-select-wrapper';
            const trigger = document.createElement('div');
            trigger.className = 'mat-select-trigger';
            const currentSelection = this._assignments[modelTag] || "Select Material...";
            const spanText = document.createElement('span');
            spanText.className = 'current-selection';
            spanText.innerText = currentSelection;
            const arrow = document.createElement('span');
            arrow.className = 'arrow';
            arrow.innerText = '▼';
            trigger.appendChild(spanText);
            trigger.appendChild(arrow);
            const optionsList = document.createElement('div');
            optionsList.className = 'mat-options';
            this._materialAssets.forEach((asset)=>{
                const opt = document.createElement('div');
                opt.className = 'mat-option';
                opt.innerText = asset.name;
                opt.addEventListener('click', ()=>{
                    this._assignments[modelTag] = asset.name;
                    spanText.innerText = asset.name;
                    optionsList.classList.remove('open');
                    trigger.classList.remove('active');
                    // Trigger application (and loading)
                    this.applyToScene();
                });
                optionsList.appendChild(opt);
            });
            trigger.addEventListener('click', (e)=>{
                const allLists = this._listContainer.querySelectorAll('.mat-options.open');
                allLists.forEach((l)=>{
                    if (l !== optionsList) {
                        l.classList.remove('open');
                        l.parentElement.querySelector('.mat-select-trigger').classList.remove('active');
                    }
                });
                optionsList.classList.toggle('open');
                trigger.classList.toggle('active');
            });
            dropdownWrapper.appendChild(trigger);
            dropdownWrapper.appendChild(optionsList);
            row.appendChild(label);
            row.appendChild(dropdownWrapper);
            this._listContainer.appendChild(row);
        });
    }
    copyJsonToClipboard() {
        const jsonStr = JSON.stringify(this._assignments, null, 2);
        const el = document.createElement('textarea');
        el.value = jsonStr;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        const originalText = this._copyBtn.innerText;
        this._copyBtn.innerText = "SAVED!";
        // Green success state
        this._copyBtn.style.background = "#4CAF50";
        this._copyBtn.style.color = "#fff";
        setTimeout(()=>{
            if (this._copyBtn) {
                this._copyBtn.innerText = originalText;
                this._copyBtn.style.background = "";
                this._copyBtn.style.color = "";
            }
        }, 1000);
    }
    constructor(...args){
        super(...args), // State
        _define_property(this, "_materialAssets", []), _define_property(this, "_assignments", {}), // Attributes Cache
        _define_property(this, "_materialTags", []), _define_property(this, "_modelTags", []), _define_property(this, "_materialDataJson", "{}"), _define_property(this, "_showUI", true), // DOM & Layout
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
_define_property(GlobalMaterialManager, "scriptName", 'globalMaterialManager');

export { GlobalMaterialManager };
