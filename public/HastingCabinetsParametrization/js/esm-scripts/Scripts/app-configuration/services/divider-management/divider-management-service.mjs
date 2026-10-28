import { LoggerService } from '../logger/logger-service.mjs';

class DividerManagementService {
    validateDividers(dividers) {
        if (!Array.isArray(dividers)) return {
            valid: false,
            errors: [
                'Not an array'
            ]
        };
        const errors = [];
        dividers.forEach((type, i)=>{
            if (!this._dividerWidths[type]) errors.push(`Index ${i}: Unknown type ${type}`);
        });
        return {
            valid: errors.length === 0,
            errors
        };
    }
    getDepthGroup(depth) {
        return depth <= 46 ? '46' : '50';
    }
    /**
     * Рассчитать позиции X для размещения слева направо.
     * @param {string[]} dividers - Массив типов ['A', 'B']
     * @param {number} physicalWidth - Реальная ширина ящика в МЕТРАХ (из AABB)
     * @returns {Array<{type: string, x: number}>}
     */ calculatePositions(dividers, physicalWidth) {
        if (!dividers || dividers.length === 0) return [];
        if (!physicalWidth || physicalWidth <= 0) {
            LoggerService.warn(this, '⚠️ [DividerService] Invalid physical width calculated');
            return [];
        }
        const positions = [];
        let currentX = -(physicalWidth / 2) + this._sidePadding;
        for (const type of dividers){
            const dimWidth = this._dividerWidths[type];
            if (!dimWidth) continue;
            const posX = currentX + dimWidth / 2;
            positions.push({
                type: type,
                x: posX
            });
            currentX += dimWidth + this._spacing;
        }
        return positions;
    }
    constructor(app){
        this.app = app;
        this._dividerWidths = {
            'A': 0.145,
            'B': 0.245,
            'C': 0.345
        };
        this._spacing = 0.005;
        this._sidePadding = 0.02;
        LoggerService.log(this, '🔧 [DividerManagementService] Initialized');
    }
}

export { DividerManagementService };
