// @ts-check
/**
 * @typedef {import('../core/divider.types.mjs').ZoneDefinition} ZoneDefinition
 * @typedef {import('../core/divider.types.mjs').DividerType} DividerType
 */ class DividerValidationService {
    /**
     * Перевіряє, чи фізично влізе новий елемент у вказану зону.
     * * @param {ZoneDefinition} zoneDef - Опис зони (start, end)
     * @param {string[]} currentItems - Масив типів поточних елементів ['A', 'B']
     * @param {string} newItemType - Тип елемента, який хочемо додати ('C')
     * @returns {boolean} True, якщо елемент влазить
     */ canAddItem(zoneDef, currentItems, newItemType) {
        // 1. Визначаємо доступну ширину зони
        const zoneWidth = zoneDef.end - zoneDef.start;
        // 2. Рахуємо ширину, яку займають вже існуючі елементи
        let usedWidth = this._calculateItemsWidth(currentItems);
        // 3. Рахуємо ширину нового елемента
        const newItemWidth = this.dividerWidths[newItemType];
        if (!newItemWidth) {
            console.warn(`[Validation] Unknown item type: ${newItemType}`);
            return false;
        }
        // 4. Додаємо відступ (SPACING) перед новим елементом, 
        // якщо в зоні вже щось є
        let additionalSpacing = 0;
        if (currentItems.length > 0) {
            additionalSpacing = this.spacing;
        }
        // 5. Фінальна перевірка
        const totalRequiredWidth = usedWidth + additionalSpacing + newItemWidth;
        // Використовуємо невеликий епісілон для порівняння float чисел, 
        // щоб уникнути проблем типу 50.0000001 > 50
        return totalRequiredWidth <= zoneWidth + 0.0001;
    }
    /**
     * Допоміжний метод розрахунку ширини групи елементів
     * @private
     * @param {string[]} items 
     * @returns {number}
     */ _calculateItemsWidth(items) {
        if (items.length === 0) return 0;
        // Сума ширин самих елементів
        const itemsTotalWidth = items.reduce((sum, type)=>{
            return sum + (this.dividerWidths[type] || 0);
        }, 0);
        // Сума відступів (між N елементами є N-1 проміжків)
        const totalSpacing = (items.length - 1) * this.spacing;
        return itemsTotalWidth + totalSpacing;
    }
    /**
     * @param {Object} config - Конфігурація (Dependency Injection)
     * @param {Object.<string, number>} config.dividerWidths - Розміри дільників { 'A': 13.5, ... }
     * @param {Object} config.systemParams - Параметри системи
     * @param {number} config.systemParams.SPACING - Відступ між елементами
     */ constructor(config){
        this.dividerWidths = config.dividerWidths;
        this.spacing = config.systemParams.SPACING;
    }
}

export { DividerValidationService };
