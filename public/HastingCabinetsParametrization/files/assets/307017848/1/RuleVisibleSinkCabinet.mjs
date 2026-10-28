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
export class RuleVisibleSinkCabinet extends BaseProductRule {
    constructor(context) {
        super({
            name: 'Visible-CabinetUniBox',
            watchAttributes: ['Height'],
            priority: 30
        });

        this.context = context;

        // Твої дані з таблиці
        this.dataCabinetUUniBox = {
            visibility: MeshRuleConfigBuilder
                .meshes([
                    'CabinetBackWall',
                ]).breakpoints([56, 53, 50])
                .values({
                    56: "Enable",
                    53: "Enable",
                    50: "Enable",
                })
                .meshes([
                    'CabinetHideWall',
                ]).breakpoints([56, 53, 50])
                .values({
                    56: "Disable",
                    53: "Disable",
                    50: "Disable",
                })
                .meshes([
                    "TopDrawerBoolMove_Point",
                    "BotDrawerBoolMove_Point",
                ]).breakpoints([56, 53, 50])
                .values({
                    56: "Disable",
                    53: "Disable",
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

        this._applyVisibility(height, this.dataCabinetUUniBox.visibility);

        // After disabling BoolMove_Points, schedule boolean re-execution
        // to restore original mesh on drawer entities (undo any prior boolean cuts).
        // Uses setTimeout to run AFTER all pending rAFs and initialize() booleans.
        this._scheduleBooleanRestore();
    }

    _scheduleBooleanRestore() {
        const rootEntity = this.context.entity;
        const targets = ['TopDrawerFloor', 'BotDrawerFloor', 'TopDrawerWalls', 'BotDrawerWalls'];

        setTimeout(() => {
            targets.forEach(name => {
                const entities = SceneEntityHelper.collectByPredicate(
                    rootEntity, e => e.name === name
                );
                entities.forEach(entity => {
                    const mb = entity.script?.meshBoolean;
                    if (!mb) return;
                    mb._isUpdating = false;
                    mb.performBoolean();
                });
            });
        }, 200);
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
