import { Script, Asset } from 'playcanvas';

export class GlobalPresetManager extends Script {
    static scriptName = 'globalPresetManager';

    _presetNames = [];
    _presetData = [];
    _showUI = true;
    
    // Filters
    _includeStretch = true;
    _includePosition = true;
    _includeVisibility = true;
    
    _managers = { stretch: null, position: null, visibility: null };
    _selectedPresetIndex = -1;

    // UI Refs
    _uiContainer = null;
    _copyBtn = null;
    _dropdownTrigger = null;
    _dropdownList = null;
    _dropdownLabel = null;
    _hostSectionControl = null;

    initialize() {
        this.findManagers();
        this.initExternalUI();
        this.toggleUI(this._showUI);

        // Apply first preset by default if available
        if (this._presetData && this._presetData.length > 0 && this._presetData[0]) {
            this.applyPreset(0);
        }

        this.on('destroy', () => {
            if (this._hostSectionControl) this._hostSectionControl.remove();
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
     * @title Preset Names
     * @type {string[]}
     */
    get presetNames() { return this._presetNames; }
    set presetNames(value) {
        this._presetNames = value;
        this.rebuildDropdown();
    }

    /**
     * @attribute
     * @title Preset Data
     * @type {string[]}
     */
    get presetData() { return this._presetData; }
    set presetData(value) { this._presetData = value; }

    /** 
     * @attribute 
     * @title Include Stretch 
     * @type {boolean} 
     * @default true
     * */
    get includeStretch() { return this._includeStretch; }
    set includeStretch(value) { this._includeStretch = value; }

    /** @attribute 
     * @title Include Position 
     * @type {boolean} 
     * @default true
     * */
    get includePosition() { return this._includePosition; }
    set includePosition(value) { this._includePosition = value; }

    /** 
     * @attribute 
     * @title Include Visibility 
     * @type {boolean} 
     * @default true
     * */
    get includeVisibility() { return this._includeVisibility; }
    set includeVisibility(value) { this._includeVisibility = value; }

    /**
     * @attribute
     * @title Show UI
     * @type {boolean}
     * @default true
     */
    get showUI() { return this._showUI; }
    set showUI(value) {
        this._showUI = value;
        if (this._hostSectionControl) this._hostSectionControl.setVisible(value);
    }

    // --- LOGIC ---

    findManagers() {
        const find = (name) => {
            if (this.entity.script && this.entity.script[name]) return this.entity.script[name];
            return this.app.scripts.list().find(s => s instanceof Script && s.constructor.scriptName === name);
        };
        this._managers.stretch = find('globalStretchManager');
        this._managers.position = find('globalPositionManager');
        this._managers.visibility = find('globalVisibilityManager');
    }

    applyPreset(index) {
        if (index < 0 || index >= this._presetData.length) return;

        const jsonStr = this._presetData[index];
        if (!jsonStr) return;

        try {
            const config = JSON.parse(jsonStr);

            // Apply Stretch (if enabled)
            if (this._includeStretch && this._managers.stretch && config.stretch) {
                this._managers.stretch.stretchDataJson = JSON.stringify(config.stretch);
            }

            // Apply Position (if enabled)
            if (this._includePosition && this._managers.position && config.position) {
                this._managers.position.positionDataJson = JSON.stringify(config.position);
            }

            // Apply Visibility (if enabled)
            if (this._includeVisibility && this._managers.visibility && config.visibility) {
                this._managers.visibility.visibilityDataJson = JSON.stringify(config.visibility);
            }

            this.setDropdownLabel(this._presetNames[index]);
            console.log(`PresetManager: Applied '${this._presetNames[index]}'`);

        } catch (e) { console.error(e); }
    }

    captureCurrentState() {
        const fullConfig = {};

        // Capture Stretch
        if (this._includeStretch && this._managers.stretch) {
            fullConfig.stretch = this._managers.stretch._vectorsMap || {};
        }

        // Capture Position
        if (this._includePosition && this._managers.position) {
            fullConfig.position = this._managers.position._vectorsMap || {};
        }

        // Capture Visibility
        if (this._includeVisibility && this._managers.visibility) {
            fullConfig.visibility = this._managers.visibility._visibilityMap || {};
        }

        return JSON.stringify(fullConfig);
    }

    // --- UI IMPL ---

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
            const stop = (e) => e.stopPropagation();
            ['mousedown', 'mousemove', 'mouseup', 'wheel', 'touchstart', 'touchmove', 'touchend']
                .forEach(evt => this._uiContainer.addEventListener(evt, stop));

            this._dropdownTrigger = this._uiContainer.querySelector('.custom-select-trigger');
            this._dropdownList = this._uiContainer.querySelector('.custom-options');
            this._dropdownLabel = this._uiContainer.querySelector('.current-selection');
            this._copyBtn = this._uiContainer.querySelector('.preset-copy-btn');

            if (this._dropdownTrigger && this._dropdownList) {
                this._dropdownTrigger.addEventListener('click', () => {
                    this._dropdownList.classList.toggle('open');
                    this._dropdownTrigger.classList.toggle('active');
                });
            }

            if (this._copyBtn) {
                this._copyBtn.addEventListener('click', () => this.copyToClipboard());
            }

            this.rebuildDropdown();

            if (this.app.uiLayout) {
                this._hostSectionControl = this.app.uiLayout.addSection('Presets (Master)', this._uiContainer, this._showUI);
                this._hostSectionControl.setVisible(this._showUI);
            }
        }
    }

    rebuildDropdown() {
        if (!this._dropdownList) return;
        this._dropdownList.innerHTML = '';

        const addOption = (text, index) => {
            const item = document.createElement('div');
            item.className = 'custom-option';
            item.innerText = text;
            
            item.addEventListener('click', () => {
                this.applyPreset(index);
                this._dropdownList.classList.remove('open');
                this._dropdownTrigger.classList.remove('active');
            });
            
            this._dropdownList.appendChild(item);
        };

        if (this._presetNames && this._presetNames.length > 0) {
            this._presetNames.forEach((name, i) => addOption(name, i));
            // Default visual label to first preset if available, but don't apply it here logic-wise (done in init)
            // Or keep "Select Configuration..." if you prefer explicit choice
            // this.setDropdownLabel(this._presetNames[0]);
            this.setDropdownLabel(this._presetNames[0]);
        } else {
            this.setDropdownLabel("No Presets");
        }
    }

    setDropdownLabel(text) {
        if (this._dropdownLabel) this._dropdownLabel.innerText = text;
    }

    copyToClipboard() {
        const jsonStr = this.captureCurrentState();
        const el = document.createElement('textarea');
        el.value = jsonStr;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);

        const originalText = this._copyBtn.innerText;
        this._copyBtn.innerText = "COPIED STATE!";
        this._copyBtn.classList.add('success');
        setTimeout(() => {
            if(this._copyBtn) {
                this._copyBtn.innerText = originalText;
                this._copyBtn.classList.remove('success');
            }
        }, 1000);
    }

    toggleUI(show) {
        if (this._uiContainer) this._uiContainer.style.display = show ? 'flex' : 'none';
    }
}