
import { SceneEntityHelper } from '../../../../helpers/scene-entity-helper.mjs';

import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { ProductRegistry_V2 } from '../../registry/product-registry-v2.mjs';
import { BaseProductRule } from '../base-product-rule.mjs';

/**
 * Правило для зміни варіанту SidePanel
 * 
 * Реагує на зміни атрибута 'SidePanelType' в store.
 * Обробляє зміну SidePanelType для продуктів з type: 'variants'
 */
export class RuleChangeSidePanelVariant extends BaseProductRule {
    constructor(context) {
        super({
            name: 'ChangeSidePanelVariant',
            watchAttributes: ['SidePanelType'],
            priority: 10
        });

        this.context = context;
    }

    onInitialize() {
        LoggerService.log(
            this,
            `🎨 [RuleChangeSidePanelVariant] Initialized for product "${this.context.productId}"`
        );
    }

    /**
     * Інвертує Z-позицію інлеїв у лівій бічній панелі.
     * Панель повернута на 180° по Y → local Z стає world -Z.
     * Інвертуємо local Z щоб Inlay залишався на правильній стороні.
     * @param {pc.Entity} meshEntity - кореневий entity з mesh
     * @private
     */
    _applyLeftSidePanelInlayOffset(meshEntity) {
        const inlayEntities = SceneEntityHelper.collectByPredicate(
            meshEntity,
            entity => entity.name.includes('_Inlay')
        );

        inlayEntities.forEach((inlay) => {
            const parent = inlay.parent;
            if (!parent) return;

            // Знаходимо сусідню Panel для обчислення gap
            const panelSibling = parent.children.find(c =>
                c.name.includes('_Panel') && !c.name.includes('_Inlay')
            );
            if (!panelSibling) return;

            const inlayMI = inlay.render?.meshInstances?.[0] || inlay.model?.meshInstances?.[0];
            const panelMI = panelSibling.render?.meshInstances?.[0] || panelSibling.model?.meshInstances?.[0];
            if (!inlayMI || !panelMI) return;

            // У лівій панелі root повертається на 180° по Y, тому world-напрямок Z
            // може бути вже інвертований на момент повторного changeVariant. Беремо
            // величину найближчого edge gap, але застосовуємо її тільки в local +Z:
            // після дзеркалення це дає рух "назад", а не назовні.
            const inlayMinZ = inlayMI.aabb.center.z - inlayMI.aabb.halfExtents.z;
            const inlayMaxZ = inlayMI.aabb.center.z + inlayMI.aabb.halfExtents.z;
            const panelMinZ = panelMI.aabb.center.z - panelMI.aabb.halfExtents.z;
            const panelMaxZ = panelMI.aabb.center.z + panelMI.aabb.halfExtents.z;
            const edgeGaps = [
                Math.abs(inlayMinZ - panelMinZ),
                Math.abs(panelMaxZ - inlayMaxZ)
            ].filter(value => value > 0.001);
            const gap = edgeGaps.length > 0 ? Math.min(...edgeGaps) : 0;

            if (Math.abs(gap) > 0.001) {
                // Зсуваємо Inlay в local +Z щоб gap перемістився на задній край панелі
                const localPosition = inlay.getLocalPosition();
                inlay.setLocalPosition(localPosition.x, localPosition.y, gap);
                LoggerService.log(
                    this,
                    `✓ Shifted Inlay "${inlay.name}" localZ +${gap.toFixed(4)} (gap fix for left panel)`
                );
            }
        });
    }

    /**
     * Основне виконання правила
     */
    async execute({ changes, currentState, previousState }) {
        const newVariantKey = currentState.get('SidePanelType');

        // Перевіряємо чи є значення
        if (newVariantKey === undefined || newVariantKey === null || newVariantKey === '') {
            LoggerService.warn(
                this,
                '⚠️ [RuleChangeSidePanelVariant] SidePanelType is empty, skip'
            );
            return;
        }

        // Перевіряємо що продукт підтримує variants
        const productType = currentState.get('productType');
        const meshConfig = ProductRegistry_V2.instance.getMeshConfig(productType);

        if (!meshConfig || meshConfig.type !== 'variants') {
            LoggerService.warn(
                this,
                `⚠️ [RuleChangeSidePanelVariant] Product "${productType}" does not support variants`
            );
            return;
        }

        LoggerService.log(
            this,
            `🔄 [RuleChangeSidePanelVariant] Changing variant to "${newVariantKey}" for "${productType}"`
        );

        // Використовуємо EntityBuilder для зміни варіанту
        const registry = ProductRegistry_V2.instance;
        const meshEntity = await registry.entityBuilder.changeVariant(
            this.entity,
            productType,
            newVariantKey,
            this.app
        );

        // Застосовуємо спеціальний offset для інлеїв у лівих панелях
        if (meshEntity && productType.includes('SidePanel_Left')) {
            this._applyLeftSidePanelInlayOffset(meshEntity);
        }
    }
}
