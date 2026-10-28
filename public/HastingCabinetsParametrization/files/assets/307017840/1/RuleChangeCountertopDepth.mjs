import { BaseProductRule } from './base-product-rule.mjs';
import { LoggerService } from '../../../services/logger/logger-service.mjs';
import { SceneEntityHelper } from '../../../helpers/scene-entity-helper.mjs';
import { MeshRuleConfigBuilder } from '../../../helpers/mesh-rule-config-builder.mjs';
import { SceneTransformHelper } from '../../../helpers/scene-transform-helper.mjs';

/**
 * Правило масштабування продукту по ширині.
 * 
 * Реагує на зміни атрибута 'Width' в store.
 * Застосовує відповідний крок масштабування до всіх дочірніх entities з певними тегами.
 */
export class RuleChangeCountertopDepth extends BaseProductRule {
    // State
    _materialAssets = [];

    constructor(context) {


        super({
            name: 'Depth-Countertop',
            watchAttributes: [],  // реагуємо на height
            priority: 20
        });

        this.context = context;

        // Твої дані з таблиці
        this.listStratchMesh = [
            "TopSolid"
        ]
        this.listNameMaterial = [
            'Top_Solid_Point'
        ]
        // Твої дані з таблиці
        this.dataCabinetUUniBox = {
            stretch: MeshRuleConfigBuilder
                .meshes([
                    'TopSolid',
                ])
                .breakpoints([45, 46, 50, 50.5, 52])
                .values({
                    45: { z: -0.01 },
                    46: { z: 0 },
                    50: { z: 0.04 },
                    50.5: { z: 0.045 },
                    52: { z: 0.06 }
                })
                .build(),
            move: MeshRuleConfigBuilder
                .meshes([
                    'Top_Solid_Point',
                ])
                .breakpoints([45, 46, 50, 50.5, 52])
                .values({
                    45: { z: -0.005 },
                    46: { z: 0 },
                    50: { z: 0.02 },
                    50.5: { z: 0.0225 },
                    52: { z: 0.03 }
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

        let Depth = currentState.get('Depth');

        // На випадок, якщо атрибут не заповнений
        if (Depth === undefined || Depth === null || Depth === '') {
            LoggerService.log(
                this,
                '⚠️ [RuleApplyCabinetMaterial] CabinetColor is empty, skip'
            );
            return;
        }

        // Якщо десь був parseInt – нормалізуємо, але зберігаємо як стрінгу
        // cabinetColor = назва матеріалу



        this._applyStretchY(Depth, this.dataCabinetUUniBox.stretch);
        this._applyMove(Depth, this.dataCabinetUUniBox.move);
    }


    // ================== Пошук і завантаження матеріалу ==================

    _getApp() {

        // Контекст, як правило, містить entity; з неї беремо app
        if (this.context?.entity?.app) return this.context.entity.app;
        if (typeof pc !== 'undefined' && pc.app) return pc.app; // fallback
        return null;
    }

    // ================== StretchY ==================

    _applyStretchY(thickness, entitiesByName) {

        const cfg = entitiesByName.values;
        let appliedCount = 0;



        const rootEntity = this.context?.entity;
        if (!rootEntity) return;

        const entities = SceneEntityHelper.collectByNamesIncludes(
            rootEntity,
            this.listStratchMesh
        );

  
        entities.forEach(entity => {
            const configForMesh = cfg[entity.name];
            if (!configForMesh) return

            const value = configForMesh[thickness];
            if (!value) {
                LoggerService.log(
                    this,
                    '[RuleScaleHeight] No value for thickness',
                    { entityName: entity.name, thickness: thickness }
                );
                return;
            }

            SceneTransformHelper.setStretch(entity, value);
            appliedCount++;
        });



        LoggerService.log(
            this,
            `✅ [RuleScale thickness] StretchY applied`,
            { thickness, appliedCount }
        );
    }


    // ================== MoveY ==================

    _applyMove(height, entitiesByName) {
        const cfg = entitiesByName.values;
        let appliedCount = 0;

        const rootEntity = this.context?.entity;
        if (!rootEntity) return;

        const entities = SceneEntityHelper.collectByNamesIncludes(
            rootEntity,
            this.listNameMaterial
        );

        entities.map(entity => {
            const configForMesh = cfg[entity.name];
            if (!configForMesh) return
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




}
