import { Script, Asset, Vec3 } from 'playcanvas';

export class DemoWidthController extends Script {
    static scriptName = 'demoWidthController';

    // --- CONFIGURATION ---
    // Map UI labels to actual X-stretch values
    _steps = [
        { label: "25", value: -0.35 },
        { label: "35", value: -0.25 },
        { label: "50", value: -0.10 },
        { label: "60", value: 0.00 }, // Default?
        { label: "70", value: 0.10 },
        { label: "90", value: 0.30 },
        { label: "105", value: 0.45 },
        { label: "120", value: 0.60 }
    ];

    _showUI = true;
    _targetTags = []; // Tags are now stored directly here

    // DOM
    _uiContainer = null;
    _slider = null;
    _valueLabel = null;
    _hostSectionControl = null;

    initialize() {
        this.initExternalUI();
        this.toggleUI(this._showUI);

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
     * @title Target Tags
     * @type {string[]}
     * @description List of tags to control Width (X Stretch).
     */
    get targetTags() { return this._targetTags; }
    set targetTags(value) {
        this._targetTags = value;
    }

    /**
     * @attribute
     * @title Show UI
     * @type {boolean}
     */
    get showUI() { return this._showUI; }
    set showUI(value) {
        this._showUI = value;
        if (this._hostSectionControl) this._hostSectionControl.setVisible(value);
    }

    // --- LOGIC ---

    applyWidth(stepIndex) {
        // 1. Get Config
        const step = this._steps[stepIndex];
        if (!step) return;

        // 2. Use local Target Tags
        if (!this._targetTags || this._targetTags.length === 0) return;

        // 3. Apply to all entities
        const processedEntities = new Set();

        this._targetTags.forEach(tag => {
            const entities = this.app.root.findByTag(tag);
            entities.forEach(entity => {
                if (processedEntities.has(entity)) return;
                processedEntities.add(entity);

                if (entity.script && entity.script.smartStretch) {
                    // Read current vector to preserve Y and Z set by other managers
                    const current = entity.script.smartStretch.stretchAmount;

                    // Create new vector with updated X only
                    const newVec = new Vec3(step.value, current.y, current.z);

                    entity.script.smartStretch.stretchAmount = newVec;
                }
            });
        });

        // Update UI Label
        if (this._valueLabel) {
            this._valueLabel.innerText = `${step.label} cm`;
        }
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
            const stop = (e) => e.stopPropagation();
            ['mousedown', 'mousemove', 'mouseup', 'wheel', 'touchstart', 'touchmove', 'touchend']
                .forEach(evt => this._uiContainer.addEventListener(evt, stop));

            this._slider = this._uiContainer.querySelector('.demo-range');
            this._valueLabel = this._uiContainer.querySelector('.demo-value');

            if (this._slider) {
                this._slider.min = 0;
                this._slider.max = this._steps.length - 1;
                this._slider.step = 1;

                // Set default to index 3 (Value "60" -> 0.0)
                this._slider.value = 3;

                // Apply initially to sync state
                this.applyWidth(3);

                this._slider.addEventListener('input', (e) => {
                    const idx = parseInt(e.target.value);
                    this.applyWidth(idx);
                });
            }

            // Register to Host
            if (this.app.uiLayout) {
                this._hostSectionControl = this.app.uiLayout.addSection('Width', this._uiContainer, this._showUI);
                if (this._hostSectionControl) {
                    this._hostSectionControl.setVisible(this._showUI);
                }
            } else {
                console.warn('UiLayoutHost not found!');
            }
        }
    }

    toggleUI(show) {
        if (this._uiContainer) this._uiContainer.style.display = show ? 'flex' : 'none';
    }
}