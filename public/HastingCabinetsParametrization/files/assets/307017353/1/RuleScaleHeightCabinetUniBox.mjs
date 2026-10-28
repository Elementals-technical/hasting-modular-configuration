import { BaseProductRule } from '../base-product-rule.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { MeshRuleConfigBuilder } from '../../../../helpers/mesh-rule-config-builder.mjs';
import { SceneEntityHelper } from '../../../../helpers/scene-entity-helper.mjs';
import { SceneTransformHelper } from '../../../../helpers/scene-transform-helper.mjs';

/**
 * Правило масштабування продукту по ширині.
 * 
 * Реагує на зміни атрибута 'Width' в store.
 * Застосовує відповідний крок масштабування до всіх дочірніх entities з певними тегами.
 */
export class RuleScaleHeightCabinetUniBox extends BaseProductRule {
    constructor(context) {
        super({
            name: 'ScaleHeight-CabinetUniBox',
            watchAttributes: ['Height'],  // реагуємо на height
            priority: 20
        });

        this.context = context;

        // Твої дані з таблиці
        this.dataHeightSizeProduct = {
            stretch: MeshRuleConfigBuilder.create()
                .meshes(['CabinetUniBody', 'CabinetBackWall'])
                .breakpoints([56, 53, 50])
                .values({
                    56: { y: 0 },
                    53: { y: -0.03 },
                    50: { y: -0.06 },
                })
                .meshes(['CabinetFBotPlate'])
                .values({
                    56: { y: 0 },
                    53: { y: 0.025 },
                    50: { y: 0 },
                })
                .build(),

            move: MeshRuleConfigBuilder.create()
                .breakpoints([56, 53, 50])
                .meshes([
                    'CabinetMove_Point',
                    "CabinetBackWallMove_Point"
                ])
                .values({
                    56: { y: 0 },
                    53: { y: -0.015 },
                    50: { y: -0.03 },
                })
                .meshes([
                    'Sink_Point',
                ])
                .values({
                    56: { y: 0 },
                    53: { y: -0.03 },
                    50: { y: -0.06 },
                })
                .meshes([
                    'TopDrawer_Point',
                ])
                .values({
                    56: { y: 0 },
                    53: { y: 0 },
                    50: { y: -0.03 },
                }).meshes([
                    'CabinetFBotPlateMove_Point',
                ])
                .values({
                    56: { y: 0 },
                    53: { y: 0.0125 },
                    50: { y: 0 },
                })
                .meshes([
                    'Countertop_Point',
                ])
                .values({
                    56: { y: 0 },
                    53: { y: -0.03 },
                    50: { y: -0.06 },
                }).meshes([
                    'CabinetFTopPlateMove_Point',
                ])
                .values({
                    56: { y: 0 },
                    53: { y: -0.03 },
                    50: { y: -0.06 },
                })
                .meshes([
                    'CabinetHideWallMove_Point',
                ])
                .values({
                    56: { y: 0.03 },
                    53: { y: 0 },
                    50: { y: -0.03 },
                })
                .build(),


            visibility: MeshRuleConfigBuilder.meshes([
                'CabinetFrontTopPlate',
                "CabinetFBotPlate",

            ]).breakpoints([56, 53, 50])
                .values({
                    56: "Enable",
                    53: "Enable",
                    50: "Disable",
                })
                .build(),

        };
    }

    onInitialize() {
        LoggerService.log(
            this,
            `📏 [RuleScaleHeight] Initialized for product "${this.productId}"`
        );
    }

    /**
     * Основне виконання правила.
     */
    execute({ currentState, previousState }) {
        const height = parseInt(currentState.get('Height'));

        LoggerService.log(
            this,
            `📏 [RuleScaleHeight] Executing for height: ${height}`,
            { previousHeight: previousState?.get('Height') }
        );

        if (Number.isNaN(height)) {
            LoggerService.log(this, '⚠️ [RuleScaleHeight] height is NaN, skip');
            return;
        }


        this._applyStretchY(height, this.dataHeightSizeProduct.stretch);
        this._applyMoveY(height, this.dataHeightSizeProduct.move);
        this._applyVisibility(height, this.dataHeightSizeProduct.visibility);
    }

    // ================== helpers ==================

    _getValueForHeight(map, height) {
        if (!map) return undefined;

        // напряму числом
        if (Object.prototype.hasOwnProperty.call(map, height)) {
            return map[height];
        }
        // або ключі-строки
        const key = Object.keys(map).find(k => parseInt(k) === height);
        return key ? map[key] : undefined;
    }

    // ================== StretchY ==================

    _applyStretchY(height, entitiesByName) {

        const cfg = entitiesByName.values;
        let appliedCount = 0;

        const entities = SceneEntityHelper.collectByNames(
            this.context.entity,
            Object.keys(cfg)
        );

        entities.forEach(entity => {
            const configForMesh = cfg[entity.name];
            if (!configForMesh) {
                LoggerService.log(
                    this,
                    '[RuleScaleWidth] No config for mesh name',
                    { entityName: entity.name }
                );
                return;
            }

            const value = configForMesh[height];
            if (!value) {
                LoggerService.log(
                    this,
                    '[RuleScaleHeight] No value for height',
                    { entityName: entity.name, height: height }
                );
                return;
            }

            SceneTransformHelper.setStretch(entity, value);
            appliedCount++;
        });



        LoggerService.log(
            this,
            `✅ [RuleScaleHeight] StretchY applied`,
            { height, appliedCount }
        );
    }


    // ================== MoveY ==================

    _applyMoveY(height, entitiesByName) {
        const cfg = entitiesByName.values;
        let appliedCount = 0;

        const entities = SceneEntityHelper.collectByNames(
            this.context.entity,
            Object.keys(cfg)
        );

        entities.map(entity => {
            const configForMesh = cfg[entity.name];

            const value = configForMesh[height];
            if (!value) {
                LoggerService.log(
                    this,
                    '[RuleScaleHeight] No value for height',
                    { entityName: entity.name, height: height }
                );
                return;
            }

            SceneTransformHelper.setLocalPosition(entity, value);
            appliedCount++;


        });


        LoggerService.log(
            this,
            `✅ [RuleScaleHeight] MoveY applied`,
            { height, appliedCount }
        );
    }


    // ================== Visibility ==================

    _applyVisibility(height, entitiesByName) {
        const cfg = entitiesByName.values;
        let appliedCount = 0;


        const entities = SceneEntityHelper.collectByNames(
            this.context.entity,
            Object.keys(cfg)
        );
 
        entities.forEach(entity => {
            const configForMesh = cfg[entity.name];

            const value = configForMesh[height];
            if (!value) {
                LoggerService.log(
                    this,
                    '[RuleScaleHeight] No value for height',
                    { entityName: entity.name, height: height }
                );
                return;
            }

            SceneTransformHelper.setVisibleByState(entity, value);
            appliedCount++;
        });

        LoggerService.log(
            this,
            `✅ [RuleScaleHeight] Visibility applied`,
            { height, appliedCount }
        );
    }
}
