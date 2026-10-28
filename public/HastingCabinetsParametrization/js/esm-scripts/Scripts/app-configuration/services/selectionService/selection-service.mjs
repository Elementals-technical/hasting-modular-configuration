import { EventHandler } from '../../../../../playcanvas-stable.min.mjs';

class SelectionService extends EventHandler {
    setMode(mode) {
        if (mode === 'single' || mode === 'multi') {
            this._selectionMode = mode;
        } else {
            console.warn(`SelectionService: Unknown mode '${mode}'. Using 'single'.`);
            this._selectionMode = 'single';
        }
    }
    getMode() {
        return this._selectionMode;
    }
    getSelection() {
        return Array.from(this._selectedEntities);
    }
    has(entity) {
        return this._selectedEntities.has(entity);
    }
    isEmpty() {
        return this._selectedEntities.size === 0;
    }
    /**
     * @param {Entity|Entity[]} entities 
     * @param {Object} options 
     * @param {'replace'|'add'|'remove'|'toggle'} [options.mode='replace']
     */ select(entities, options = {}) {
        const inputArray = Array.isArray(entities) ? entities : entities ? [
            entities
        ] : [];
        const opMode = options.mode || 'replace';
        let targetSet;
        if (opMode === 'replace') {
            targetSet = new Set(inputArray);
        } else {
            targetSet = new Set(this._selectedEntities);
            inputArray.forEach((entity)=>{
                if (opMode === 'add') {
                    targetSet.add(entity);
                } else if (opMode === 'remove') {
                    targetSet.delete(entity);
                } else if (opMode === 'toggle') {
                    if (targetSet.has(entity)) {
                        targetSet.delete(entity);
                    } else {
                        targetSet.add(entity);
                    }
                }
            });
        }
        const added = [];
        const removed = [];
        this._selectedEntities.forEach((current)=>{
            if (!targetSet.has(current)) removed.push(current);
        });
        targetSet.forEach((target)=>{
            if (!this._selectedEntities.has(target)) added.push(target);
        });
        if (added.length === 0 && removed.length === 0) return;
        this._selectedEntities = targetSet;
        this.fire('select', this.getSelection(), added, removed);
    }
    deselectAll() {
        this.select([], {
            mode: 'replace'
        });
    }
    constructor(){
        super();
        this._selectedEntities = new Set();
        this._selectionMode = 'single'; // 'single' | 'multi'
    }
}

export { SelectionService };
