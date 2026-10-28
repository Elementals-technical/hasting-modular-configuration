import { Script, Asset, Vec3 } from 'playcanvas';

export class GlobalPositionManager extends Script {
    static scriptName = 'globalPositionManager';

    // State
    _vectorsMap = {}; 
    _targetTags = [];
    _positionDataJson = "{}";
    _showUI = true;

    // DOM & Layout
    _uiContainer = null;
    _listContainer = null;
    _copyBtn = null;
    _uiCache = [];
    _hostSectionControl = null;

    initialize() {
        // 1. Load initial state purely from Attribute
        this.parseJsonToMap(this._positionDataJson);
        this.syncMapWithTags();
        
        // 2. UI Initialization
        this.initExternalUI();
        
        // 3. Apply initial logic
        this.applyToScene();

        this.on('destroy', () => {
            if (this._hostSectionControl) {
                this._hostSectionControl.remove();
            }
        });
    }

    // --- ATTRIBUTES ---

    /**
     * @attribute
     * @title HTML Template
     * @type {Asset}
     * @assetType html
     */
    htmlAsset;

    /**
     * @attribute
     * @title CSS Styles
     * @type {Asset}
     * @assetType css
     */
    cssAsset;

    /**
     * @attribute
     * @title Target Tags
     * @type {string[]}
     */
    get targetTags() { return this._targetTags; }
    set targetTags(value) { 
        this._targetTags = value; 
        this.syncMapWithTags();
        this.rebuildListUI();
        this.applyToScene();
    }

    /**
     * @attribute
     * @title Position Data (JSON)
     * @type {string}
     */
    get positionDataJson() { return this._positionDataJson; }
    set positionDataJson(value) {
        this._positionDataJson = value;
        this.parseJsonToMap(value);
        this.syncMapWithTags();
        this.updateUIValues();
        this.applyToScene();
    }

    /**
     * @attribute
     * @title Show UI
     * @type {boolean}
     */
    get showUI() { return this._showUI; }
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
                this._vectorsMap = parsed;
            }
        } catch (e) {}
    }

    syncMapWithTags() {
        this._targetTags.forEach(tag => {
            if (!this._vectorsMap[tag]) {
                this._vectorsMap[tag] = { x: 0, y: 0, z: 0 };
            }
        });
    }

    applyToScene() {
        this._targetTags.forEach(tag => {
            const data = this._vectorsMap[tag];
            if (!data) return;

            const vec = new Vec3(data.x, data.y, data.z);
            const entities = this.app.root.findByTag(tag);

            entities.forEach(entity => {
                entity.setLocalPosition(vec);
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
            this._listContainer = this._uiContainer.querySelector('.pos-list-container');
            this._copyBtn = this._uiContainer.querySelector('.pos-copy-btn');
            
            if (this._copyBtn) {
                this._copyBtn.addEventListener('click', () => this.copyJsonToClipboard());
            }

            this.rebuildListUI();

            if (this.app.uiLayout) {
                this._hostSectionControl = this.app.uiLayout.addSection('Position Manager', this._uiContainer, this._showUI);
                this._hostSectionControl.setVisible(this._showUI);
            } else {
                console.warn('UiLayoutHost not found!');
            }
        }
    }

    rebuildListUI() {
        if (!this._listContainer) return;
        this._listContainer.innerHTML = '';
        this._uiCache = [];

        this._targetTags.forEach(tag => {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'pos-tag-group';

            const title = document.createElement('div');
            title.className = 'pos-group-title';
            title.innerText = tag;
            groupDiv.appendChild(title);

            const tagCache = { tag: tag, ctrls: {} };

            ['x', 'y', 'z'].forEach(axis => {
                const row = document.createElement('div');
                row.className = 'pos-axis-row';

                const label = document.createElement('span');
                label.className = `axis-label ${axis}`;
                label.innerText = axis.toUpperCase();

                const numInput = document.createElement('input');
                numInput.type = 'number';
                numInput.className = `pos-input-number pos-input-${axis}`;
                numInput.step = 0.01;

                const rangeInput = document.createElement('input');
                rangeInput.type = 'range';
                rangeInput.className = `pos-input-range pos-range-${axis}`;
                rangeInput.min = -5; // Range for position
                rangeInput.max = 5;
                rangeInput.step = 0.01;

                const onUpdate = (val) => {
                    const fVal = parseFloat(val);
                    if (!this._vectorsMap[tag]) this._vectorsMap[tag] = {x:0, y:0, z:0};
                    
                    this._vectorsMap[tag][axis] = fVal;
                    
                    this.applyToScene();
                    this.updateUIValues(tag);
                };

                numInput.addEventListener('input', (e) => onUpdate(e.target.value));
                rangeInput.addEventListener('input', (e) => onUpdate(e.target.value));

                row.appendChild(label);
                row.appendChild(numInput);
                row.appendChild(rangeInput);
                groupDiv.appendChild(row);

                tagCache.ctrls[axis] = { num: numInput, range: rangeInput };
            });

            this._uiCache.push(tagCache);
            this._listContainer.appendChild(groupDiv);
        });

        this.updateUIValues();
    }

    updateUIValues(specificTag = null) {
        this._uiCache.forEach(item => {
            if (specificTag && item.tag !== specificTag) return;

            const data = this._vectorsMap[item.tag] || { x:0, y:0, z:0 };

            ['x', 'y', 'z'].forEach(axis => {
                const ctrls = item.ctrls[axis];
                const val = data[axis];

                if (document.activeElement !== ctrls.num) {
                    ctrls.num.value = parseFloat(val).toFixed(2);
                }
                if (document.activeElement !== ctrls.range) {
                    ctrls.range.value = val;
                }
            });
        });
    }

    copyJsonToClipboard() {
        const cleanMap = {};
        this._targetTags.forEach(tag => {
            cleanMap[tag] = this._vectorsMap[tag] || {x:0,y:0,z:0};
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
        this._copyBtn.style.background = "#4CAF50";
        setTimeout(() => {
            if(this._copyBtn) {
                this._copyBtn.innerText = originalText;
                this._copyBtn.style.background = ""; 
            }
        }, 1000);
    }
}