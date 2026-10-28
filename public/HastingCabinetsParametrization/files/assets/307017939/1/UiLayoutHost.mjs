import { Script, Asset } from 'playcanvas';

export class UiLayoutHost extends Script {
    static scriptName = 'uiLayoutHost';

    _hostContainer = null;
    _contentArea = null;
    _showUI = true;

    initialize() {
        this.initHostUI();
        
        // Apply initial state
        this.updateVisibility();
        
        this.app.uiLayout = this;

        this.on('destroy', () => {
            if (this._hostContainer && document.body.contains(this._hostContainer)) {
                document.body.removeChild(this._hostContainer);
            }
            delete this.app.uiLayout;
        });
    }

    /**
     * @attribute
     * @title HTML Asset
     * @type {Asset}
     * @assetType html
     */
    htmlAsset;

    /**
     * @attribute
     * @title CSS Asset
     * @type {Asset}
     * @assetType css
     */
    cssAsset;

    /**
     * @attribute
     * @title Show UI
     * @description Toggle the entire layout panel visibility.
     * @type {boolean}
     * @default true
     */
    get showUI() { return this._showUI; }
    set showUI(value) {
        this._showUI = value;
        this.updateVisibility();
    }

    // --- LOGIC ---

    updateVisibility() {
        if (this._hostContainer) {
            // Use 'flex' to match CSS layout, or 'none' to hide
            this._hostContainer.style.display = this._showUI ? 'flex' : 'none';
        }
    }

    // --- API FOR MODULES ---

    /**
     * Registers a new section in the accordion
     */
    addSection(title, contentElement, startExpanded = false) {
        if (!this._contentArea) return null;

        const section = document.createElement('div');
        section.className = 'ui-host-section';

        const header = document.createElement('div');
        header.className = 'ui-host-header';
        
        const titleSpan = document.createElement('span');
        titleSpan.innerText = title;
        
        const icon = document.createElement('span');
        icon.className = 'ui-host-icon';
        icon.innerText = startExpanded ? '▼' : '▶';

        header.appendChild(titleSpan);
        header.appendChild(icon);

        const contentWrap = document.createElement('div');
        contentWrap.className = 'ui-host-content';
        if (!startExpanded) contentWrap.style.display = 'none';
        
        contentWrap.appendChild(contentElement);

        header.addEventListener('click', () => {
            const isClosed = contentWrap.style.display === 'none';
            contentWrap.style.display = isClosed ? 'block' : 'none';
            icon.innerText = isClosed ? '▼' : '▶';
        });

        section.appendChild(header);
        section.appendChild(contentWrap);
        this._contentArea.appendChild(section);

        return {
            element: section,
            setVisible: (visible) => {
                section.style.display = visible ? 'block' : 'none';
            },
            remove: () => {
                if (section.parentNode) section.parentNode.removeChild(section);
            }
        };
    }

    // --- INTERNAL ---

    initHostUI() {
        if (this._hostContainer) return;

        if (this.cssAsset) {
            const style = document.createElement('style');
            style.innerHTML = this.cssAsset.resource || '';
            document.head.appendChild(style);
        }

        if (this.htmlAsset) {
            const temp = document.createElement('div');
            temp.innerHTML = this.htmlAsset.resource || '';
            this._hostContainer = temp.firstElementChild;
            
            if (this._hostContainer) {
                document.body.appendChild(this._hostContainer);
                this._contentArea = this._hostContainer.querySelector('.ui-host-scroll-area');

                const stop = (e) => e.stopPropagation();
                ['mousedown', 'mousemove', 'mouseup', 'wheel', 'touchstart', 'touchmove', 'touchend']
                    .forEach(evt => this._hostContainer.addEventListener(evt, stop));
                
                // Ensure visibility is correct after creation
                this.updateVisibility();
            }
        }
    }
}