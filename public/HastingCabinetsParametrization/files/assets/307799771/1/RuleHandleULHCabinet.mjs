import { MeshRuleConfigBuilder } from "../../../../helpers/mesh-rule-config-builder.mjs";
import { SceneEntityHelper } from "../../../../helpers/scene-entity-helper.mjs";
import { SceneTransformHelper } from "../../../../helpers/scene-transform-helper.mjs";
import { LoggerService } from "../../../../services/logger/logger-service.mjs";
import { BaseProductRule } from "../base-product-rule.mjs";

/**
 * Правило керування видимістю ручок на тумбочках/полицях.
 *
 * Реагує на зміни атрибута 'HandleType' в store.
 * Показує/ховає відповідні handle-об'єкти залежно від типу.
 */
export class RuleHandleULHCabinet extends BaseProductRule {
    constructor(context) {
        super({
            name: "HandleVisibility",
            watchAttributes: ["Handle"],
            priority: 5, // Висок��й пріоритет - виконується раніше
        });

        this.context = context;

        this.ruleData = {
            visibility: MeshRuleConfigBuilder.create()
                .breakpoints(["handle_pto", "handle_urban_topcut"])
                .meshes(["ULH_Drawer_HNoCut"])
                .values({
                    handle_pto: "Enable",
                    handle_urban_topcut: "Disable",
                })
                .meshes(["ULH_Drawer_HTopCut", "ULH_Cabinet_HGroove"])
                .values({
                    handle_pto: "Disable",
                    handle_urban_topcut: "Enable",
                })
                .build(),
        };
    }

    onInitialize() {
        LoggerService.log(this, `🎨 [RuleHandleVisibility] Initialized for product "${this.productId}"`);
    }

    /**
     * Основне виконання правила.
     */
    execute({ currentState, previousState }) {
        const handleType = currentState.Handle || currentState.get?.("Handle");

        LoggerService.log(this, `🎨 [RuleHandleVisibility] Executing for HandleType: "${handleType}"`, {
            previousHandleType: previousState?.HandleType || previousState?.get?.("HandleType"),
            productId: this.productId,
        });

        // Якщо HandleType не вказано або порожнє - встановлюємо дефолт
        if (!handleType || handleType === "") {
            LoggerService.log(
                this,
                '⚠️ [RuleHandleVisibility] HandleType is empty, applying default "Urban Handle (No Cut)"',
            );
            this._applyVisibility("handle_pto", this.ruleData.visibility);
            return;
        }

        // Перевіряємо чи існує конфігурація для цього типу
        if (!this.isHandleTypeSupported(handleType)) {
            LoggerService.log(
                this,
                `⚠️ [RuleHandleVisibility] Unknown HandleType "${handleType}", available types:`,
                this.getAvailableHandleTypes(),
            );
            return;
        }

        // Застосовуємо конфігурацію видимості
        this._applyVisibility(handleType, this.ruleData.visibility);
    }

    /**
     * Застосовує конфігурацію видимості для handle-об'єктів
     * @private
     */
    _applyVisibility(handleType, entitiesByName) {
        const cfg = entitiesByName.values;
        let appliedCount = 0;

        const entities = SceneEntityHelper.collectByNames(this.context.entity, Object.keys(cfg));

        if (entities.length === 0) {
            LoggerService.log(this, "⚠️ [RuleHandleVisibility] No handle entities found in product", {
                productId: this.productId,
            });
            return;
        }

        entities.forEach((entity) => {
            const configForMesh = cfg[entity.name];
            if (!configForMesh) {
                LoggerService.log(this, "[RuleHandleVisibility] No config for mesh name", { entityName: entity.name });
                return;
            }

            const value = configForMesh[handleType];
            if (!value) {
                LoggerService.log(this, "[RuleHandleVisibility] No value for handleType", {
                    entityName: entity.name,
                    handleType,
                });
                return;
            }

            SceneTransformHelper.setVisibleByState(entity, value);
            appliedCount++;
        });

        LoggerService.log(this, `✅ [RuleHandleVisibility] Applied "${handleType}" configuration`, {
            productId: this.productId,
            appliedCount,
            totalHandles: entities.length,
        });
    }

    /**
     * Отримує поточну конфігурацію видимості
     */
    getCurrentConfiguration() {
        const handleEntities = SceneEntityHelper.collectByNames(
            this.context.entity,
            Object.keys(this.ruleData.visibility.values),
        );

        const current = {};
        handleEntities.forEach((entity) => {
            current[entity.name] = entity.enabled;
        });

        return current;
    }

    /**
     * Перевіряє чи Handle Type підтримується
     */
    isHandleTypeSupported(handleType) {
        return this.ruleData.visibility.breakpoints.includes(handleType);
    }

    /**
     * Отримує список доступних типів ручок
     */
    getAvailableHandleTypes() {
        return [...this.ruleData.visibility.breakpoints];
    }
}
