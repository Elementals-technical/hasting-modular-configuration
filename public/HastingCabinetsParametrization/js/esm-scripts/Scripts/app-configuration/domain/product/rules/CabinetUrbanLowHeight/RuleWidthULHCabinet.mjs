import { BaseProductRule } from '../base-product-rule.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { MeshRuleConfigBuilder } from '../../../../helpers/mesh-rule-config-builder.mjs';
import { SceneTransformHelper } from '../../../../helpers/scene-transform-helper.mjs';
import { SceneEntityHelper } from '../../../../helpers/scene-entity-helper.mjs';
import { DividerDebugLogger } from '../../../../services/drawer-divider/diagnostics/DividerDebugLogger.mjs';

/**
 * Правило масштабування продукту по ширині.
 * 
 * Реагує на зміни атрибута 'Width' в store.
 * Застосовує відповідний крок масштабування до всіх дочірніх entities з певними тегами.
 */ class RuleWidthULHCabinet extends BaseProductRule {
    /**
     * Ініціалізація правила.
     * Викликається автоматично при реєстрації через RuleExecutor.
     */ onInitialize() {
        LoggerService.log(this, `📏 [RuleScaleWidth] Initialized for product "${this.productId}"`, {
            targetTags: this._targetTags.length
        });
    }
    /**
     * Виконання правила при зміні width у store.
     * 
     * @param {Object} params
     * @param {Object} params.changes - Зміни (містить width)
     * @param {Object} params.currentState - Поточний стан з новим width
     * @param {Object} params.previousState - Попередній стан
     */ execute({ changes, currentState, previousState }) {
        const newWidth = currentState.get('Width');
        const traceId = DividerDebugLogger.nextTraceId('cabinet-width-scale');
        LoggerService.log(this, `📏 [RuleScaleWidth] Executing for width: ${newWidth}`, {
            previousWidth: previousState?.get('Width')
        });
        DividerDebugLogger.log('CabinetLayout.RuleScaleWidthCabinetUniBox.start', 'Width scale rule started', {
            traceId,
            productId: this.context?.entity?.name,
            newWidth,
            previousWidth: previousState?.get('Width'),
            entityBeforeScale: this._summarizeEntity(this.context?.entity),
            targetEntitiesBeforeScale: this._summarizeTargetEntities(this._targetTags)
        });
        this._applyScaleToEntities(newWidth);
        DividerDebugLogger.log('CabinetLayout.RuleScaleWidthCabinetUniBox.done', 'Width scale rule completed', {
            traceId,
            productId: this.context?.entity?.name,
            newWidth,
            entityAfterScale: this._summarizeEntity(this.context?.entity),
            targetEntitiesAfterScale: this._summarizeTargetEntities(this._targetTags)
        });
    }
    /**
     * Застосовує масштабування до всіх target entities.
     * @private
     */ _applyScaleToEntities(width) {
        const widthKey = String(width);
        if (!widthKey) return;
        this._applyTransformConfig(widthKey, this.dataRule.stretchX, (entity, value)=>{
            SceneTransformHelper.setStretch(entity, value);
            DividerDebugLogger.log('CabinetLayout.RuleScaleWidthCabinetUniBox.applyStretch', 'Applied width stretch to cabinet child entity', {
                cabinetId: this.context?.entity?.name,
                entityName: entity.name,
                width: widthKey,
                value,
                stretchAfter: SceneTransformHelper.getStretch(entity)
            });
        });
    }
    _summarizeTargetEntities(targetNames) {
        const entities = SceneEntityHelper.collectByNames(this.context.entity, targetNames);
        return entities.map((entity)=>({
                name: entity.name,
                enabled: Boolean(entity.enabled),
                stretch: SceneTransformHelper.getStretch(entity),
                localPosition: this._summarizeVec3(entity.getLocalPosition?.()),
                localScale: this._summarizeVec3(entity.getLocalScale?.())
            }));
    }
    _summarizeEntity(entity) {
        if (!entity) return null;
        return {
            name: entity.name,
            enabled: Boolean(entity.enabled),
            position: this._summarizeVec3(entity.getPosition?.()),
            localPosition: this._summarizeVec3(entity.getLocalPosition?.()),
            localScale: this._summarizeVec3(entity.getLocalScale?.())
        };
    }
    _summarizeVec3(vec) {
        if (!vec) return null;
        return {
            x: DividerDebugLogger._round(vec.x),
            y: DividerDebugLogger._round(vec.y),
            z: DividerDebugLogger._round(vec.z)
        };
    }
    constructor(context){
        super({
            name: 'Width-ULH-Cabinet',
            watchAttributes: [
                'Width'
            ],
            priority: 10 // Низький пріоритет = виконується раніше
        });
        this._targetTags = [
            "ULH_Drawer_Bolts",
            "ULH_Cabinet_Bolts",
            "ULH_Cabinet_HBracket",
            "ULH_Cabinet_HGroove",
            "ULH_Cabinet_Mount",
            "ULH_Drawer_HNoCut",
            "ULH_Drawer_HTopCut",
            "ULH_Overlay_HNoCut",
            "ULH_Overlay_HTopCut",
            "ULH_Cabinet_SCBackWall",
            "ULH_Drawer_Floor",
            "ULH_Drawer_Hinge",
            "ULH_Drawer_BWall",
            "ULH_Drawer_TopFraming",
            "ULH_Cabinet_Walls",
            "ULH_Drawer_SWall"
        ];
        this.dataRule = {
            stretchX: MeshRuleConfigBuilder.meshes(this._targetTags).breakpoints([
                25,
                35,
                50,
                60,
                70,
                80,
                90,
                105,
                120
            ]).values({
                25: {
                    x: -0.35
                },
                35: {
                    x: -0.25
                },
                50: {
                    x: -0.1
                },
                60: {
                    x: 0.00
                },
                70: {
                    x: 0.10
                },
                80: {
                    x: 0.20
                },
                90: {
                    x: 0.30
                },
                105: {
                    x: 0.45
                },
                120: {
                    x: 0.60
                }
            }).build()
        };
        this.context = context;
    }
}

export { RuleWidthULHCabinet };
