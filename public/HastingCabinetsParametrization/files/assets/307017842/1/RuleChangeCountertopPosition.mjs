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
export class RuleChangeCountertopPosition extends BaseProductRule {
    // State
    _materialAssets = [];

    constructor(context) {


        super({
            name: 'Thickness-Countertop',
            watchAttributes: ['Height', 'Thickness'],  // реагуємо на height
            priority: 20
        });

        this.context = context;

        // Твої дані з таблиці
        this.listNameMaterial = [
            "Top_Solid_Point",
        ]
        // Твої дані з таблиці
        this.CountTop = {
            move: MeshRuleConfigBuilder
                .meshes([
                    'Top_Solid_Point',
                ])
                .breakpoints([56, 53, 50])
                .values({
                    56: { y: 0 },
                    53: { y: -0.03 },
                    50: { y: -0.06 },
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

        let thickness = currentState.get('Thickness');
        let height = currentState.get('Height');

        // На випадок, якщо атрибут не заповнений
        if (thickness === undefined || thickness === null || thickness === '') {
            LoggerService.log(
                this,
                '⚠️ [RuleApplyCabinetMaterial] CabinetColor is empty, skip'
            );

            thickness = 0.5;
            // return;
        }

        // Якщо десь був parseInt – нормалізуємо, але зберігаємо як стрінгу
        // cabinetColor = назва матеріалу



        // this._applyStretchY(thickness, this.dataCabinetUUniBox.stretch);
        this._applyMoveY(height, thickness, this.CountTop.move);
    }


    // ================== Пошук і завантаження матеріалу ==================

    _getApp() {

        // Контекст, як правило, містить entity; з неї беремо app
        if (this.context?.entity?.app) return this.context.entity.app;
        if (typeof pc !== 'undefined' && pc.app) return pc.app; // fallback
        return null;
    }


    // ================== MoveY ==================

    _applyMoveY(height, thickness, entitiesByName) {
        const cfg = entitiesByName.values;
        let appliedCount = 0;

        const stratchCountertop = this.context.productConfig?.thicknessOffsets?.countertop;
        if (!stratchCountertop) {
            LoggerService.log(this, '⚠️ [Thickness-Countertop] No thicknessOffsets.countertop in productConfig, skip');
            return;
        }

        const thicknessOffset = stratchCountertop[thickness];
        if (!thicknessOffset) {
            LoggerService.log(this, `⚠️ [Thickness-Countertop] No offset for thickness=${thickness}, skip`);
            return;
        }

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

            SceneTransformHelper.setLocalPosition(entity, { y: value.y + thicknessOffset.y / 2 });
            appliedCount++;


        });


        LoggerService.log(
            this,
            `✅ [RuleScaleHeight] MoveY applied`,
            { height, appliedCount }
        );
    }



    // ================== StretchY ==================

    _applyStretchY(thickness, entitiesByName) {

        const cfg = entitiesByName.values;
        let appliedCount = 0;



        // const rootEntity = this.app.root;


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




}
