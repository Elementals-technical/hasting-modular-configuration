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
 */
export class RuleWidthULHCabinet extends BaseProductRule {
    constructor(context) {
        super({
            name: 'Width-ULH-Cabinet',
            watchAttributes: ['Width'],  // Спрацьовує тільки при зміні width
            priority: 10  // Низький пріоритет = виконується раніше
        });



        // this.dataTopHande = {
        //     stretch: MeshRuleConfigBuilder.create()
        //         .breakpoints([25, 35, 50, 60, 70, 80, 90, 105, 120])
        //         .meshes([
        //             "HandleBotCut_Top",
        //             "HandleNoCut_Top",
        //             "HandleTopCut_Top",
        //         ])
        //         .values({
        //             25: { x: -0.35 },
        //             35: { x: -0.25 },
        //             50: { x: -0.10 },
        //             60: { x: 0.00 }, // Default
        //             70: { x: 0.10 },
        //             80: { x: 0.20 },
        //             90: { x: 0.30 },
        //             105: { x: 0.45 },
        //             120: { x: 0.60 }
        //         })
        //         .build(),
        // };

        // Теги entities, на які діє правило
        this._targetTags = [
            "ULH_Drawer_Bolts",
            "ULH_Cabinet_Bolts",
            "ULH_Cabinet_HBracket",
            "ULH_Cabinet_HGroove",
            "ULH_Cabinet_Mount",

            "ULH_Drawer_HNoCut",
            "ULH_Drawer_HTopCut",
            "ULH_Cabinet_SCBackWall",

            "ULH_Drawer_Floor",
            "ULH_Drawer_Hinge",

            "ULH_Drawer_BWall",

            "ULH_Drawer_TopFraming",

            "ULH_Cabinet_Walls",

            "ULH_Drawer_SWall",
        ];

        this._meshRuleConfig = MeshRuleConfigBuilder.meshes(this._targetTags)
            .breakpoints([25, 35, 50, 60, 70, 80, 90, 105, 120])
            .values({
                25: { x: -0.35 },
                35: { x: -0.25 },
                50: { x: -0.10 },
                60: { x: 0.00 }, // Default
                70: { x: 0.10 },
                80: { x: 0.20 },
                90: { x: 0.30 },
                105: { x: 0.45 },
                120: { x: 0.60 }
            })
            .build();

        // this.dataCabinetUUniBox = {
        //     visibility: MeshRuleConfigBuilder
        //         .meshes([
        //             'TopDrawerBoolMove_Point',
        //             'BotDrawerBoolMove_Point',

        //         ]).breakpoints([25, 35, 50, 60, 70, 80, 90, 105, 120])
        //         .values({
        //             25: "Disable",
        //             35: "Disable",
        //             50: "Disable",
        //             60: "Enable",
        //             70: "Enable",
        //             80: "Enable",
        //             90: "Enable",
        //             105: "Enable",
        //             120: "Enable",
        //         })
        //         .build(),

        // };


        this.context = context;
    }

    /**
     * Ініціалізація правила.
     * Викликається автоматично при реєстрації через RuleExecutor.
     */
    onInitialize() {
        LoggerService.log(
            this,
            `📏 [RuleScaleWidth] Initialized for product "${this.productId}"`,
            { targetTags: this._targetTags.length }
        );
    }

    /**
     * Виконання правила при зміні width у store.
     * 
     * @param {Object} params
     * @param {Object} params.changes - Зміни (містить width)
     * @param {Object} params.currentState - Поточний стан з новим width
     * @param {Object} params.previousState - Попередній стан
     */
    execute({ changes, currentState, previousState }) {
        const newWidth = currentState.get('Width');
        const traceId = DividerDebugLogger.nextTraceId('cabinet-width-scale');

        LoggerService.log(
            this,
            `📏 [RuleScaleWidth] Executing for width: ${newWidth}`,
            { previousWidth: previousState?.get('Width') }
        );

        DividerDebugLogger.log('CabinetLayout.RuleScaleWidthCabinetUniBox.start', 'Width scale rule started', {
            traceId,
            productId: this.context?.entity?.name,
            newWidth,
            previousWidth: previousState?.get('Width'),
            entityBeforeScale: this._summarizeEntity(this.context?.entity),
            targetEntitiesBeforeScale: this._summarizeTargetEntities(this._targetTags)
        });

        // Застосовуємо масштабування
        this._applyScaleToEntities(newWidth);
        // this._applyVisibility(newWidth, this.dataCabinetUUniBox.visibility);

        // this._applyStretchY(newWidth, this.dataTopHande.stretch);
        // this._applyVisibility(newWidth, this.dataCabinetUUniBox.visibility);

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
     */
    _applyScaleToEntities(width) {
        // захист від строк / чисел
        const widthKey = String(width);
        if (!widthKey) return;

        LoggerService.log(
            this,
            `📐 [RuleScaleWidth] Applying width "${widthKey}"`
        );

        const entities = SceneEntityHelper.collectByNames(
            this.context.entity,
            this._targetTags
        );

        let appliedCount = 0;

        entities.forEach(entity => {
            const configForMesh = this._meshRuleConfig.values[entity.name];
            if (!configForMesh) {
                LoggerService.log(
                    this,
                    '[RuleScaleWidth] No config for mesh name',
                    { entityName: entity.name }
                );
                return;
            }

            const value = configForMesh[widthKey];

            if (!value) {
                LoggerService.log(
                    this,
                    '[RuleScaleWidth] No value for width',
                    { entityName: entity.name, width: widthKey }
                );
                return;
            }

            SceneTransformHelper.setStretch(entity, value);
            DividerDebugLogger.log('CabinetLayout.RuleScaleWidthCabinetUniBox.applyStretch', 'Applied width stretch to cabinet child entity', {
                cabinetId: this.context?.entity?.name,
                entityName: entity.name,
                width: widthKey,
                value,
                stretchAfter: SceneTransformHelper.getStretch(entity)
            });
            appliedCount++;
        });

        LoggerService.log(
            this,
            `✅ [RuleScaleWidth] Applied to ${appliedCount} entities`
        );
    }

    // ================== Visibility ==================

    // _applyVisibility(width, entitiesByName) {
    //     const cfg = entitiesByName.values;
    //     let appliedCount = 0;


    //     const entities = SceneEntityHelper.collectByNames(
    //         this.context.entity,
    //         Object.keys(cfg)
    //     );

    //     entities.forEach(entity => {
    //         const configForMesh = cfg[entity.name];

    //         const value = configForMesh[width];
    //         if (!value) {
    //             LoggerService.log(
    //                 this,
    //                 '[RuleScaleWidth] No value for width',
    //                 { entityName: entity.name, width: width }
    //             );
    //             return;
    //         }

    //         SceneTransformHelper.setVisibleByState(entity, value);
    //         appliedCount++;
    //     });

    //     LoggerService.log(
    //         this,
    //         `✅ [RuleScaleWidth] Visibility applied`,
    //         { width, appliedCount }
    //     );
    // }
    
    // _applyStretchY(height, entitiesByName) {

    //     const cfg = entitiesByName.values;
    //     let appliedCount = 0;

    //     const entities = SceneEntityHelper.collectByNames(
    //         this.context.entity,
    //         Object.keys(cfg)
    //     );

    //     entities.forEach(entity => {
    //         const configForMesh = cfg[entity.name];
    //         if (!configForMesh) {
    //             LoggerService.log(
    //                 this,
    //                 '[RuleScaleWidth] No config for mesh name',
    //                 { entityName: entity.name }
    //             );
    //             return;
    //         }

    //         const value = configForMesh[height];
    //         if (!value) {
    //             LoggerService.log(
    //                 this,
    //                 '[RuleScaleHeight] No value for height',
    //                 { entityName: entity.name, height: height }
    //             );
    //             return;
    //         }

    //         SceneTransformHelper.setStretch(entity, value);
    //         DividerDebugLogger.log('CabinetLayout.RuleScaleWidthCabinetUniBox.applyHandleStretch', 'Applied width stretch to handle child entity', {
    //             cabinetId: this.context?.entity?.name,
    //             entityName: entity.name,
    //             width: height,
    //             value,
    //             stretchAfter: SceneTransformHelper.getStretch(entity)
    //         });
    //         appliedCount++;
    //     });



    //     LoggerService.log(
    //         this,
    //         `✅ [RuleScaleHeight] StretchY applied`,
    //         { height, appliedCount }
    //     );
    // }

    _summarizeTargetEntities(targetNames) {
        const entities = SceneEntityHelper.collectByNames(
            this.context.entity,
            targetNames
        );

        return entities.map((entity) => ({
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
}
