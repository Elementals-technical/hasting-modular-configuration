import { MeshRuleConfigBuilder } from '../../../../helpers/mesh-rule-config-builder.mjs';
import { SceneEntityHelper } from '../../../../helpers/scene-entity-helper.mjs';
import { SceneTransformHelper } from '../../../../helpers/scene-transform-helper.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { BaseProductRule } from '../base-product-rule.mjs';
import { FLUTING_TEXTURES } from '../Overlay/overlay-texture-config.mjs';

// ULH sheet rows 54-58: each overlay mirrors its front, but is shown only while DrawerPanelFluting is a fluting value.
const ULH_FLUTING_OVERLAYS = Object.freeze([
    "ULH_Overlay_HNoCut",
    "ULH_Overlay_HTopCut"
]);
/**
 * Правило керування видимістю ручок на тумбочках/полицях.
 *
 * Реагує на зміни атрибута 'HandleType' в store.
 * Показує/ховає відповідні handle-об'єкти залежно від типу.
 */ class RuleHandleULHCabinet extends BaseProductRule {
    onInitialize() {
        LoggerService.log(this, `🎨 [RuleHandleVisibility] Initialized for product "${this.productId}"`);
    }
    /**
     * Основне виконання правила.
     */ execute({ currentState, previousState }) {
        const handleType = currentState.Handle || currentState.get?.("Handle");
        const fluting = currentState.DrawerPanelFluting || currentState.get?.("DrawerPanelFluting");
        // Overlays are visible only with a fluting value; 'None', empty and unknown values hide them.
        const hasFluting = Object.hasOwn(FLUTING_TEXTURES, fluting);
        const setVisible = (entity, value)=>SceneTransformHelper.setVisibleByState(entity, !hasFluting && ULH_FLUTING_OVERLAYS.includes(entity.name) ? "Disable" : value);
        LoggerService.log(this, `🎨 [RuleHandleVisibility] Executing for HandleType: "${handleType}"`, {
            previousHandleType: previousState?.HandleType || previousState?.get?.("HandleType"),
            productId: this.productId
        });
        // Якщо HandleType не вказано або порожнє - встановлюємо дефолт
        if (!handleType || handleType === "") {
            LoggerService.log(this, '⚠️ [RuleHandleVisibility] HandleType is empty, applying default "Urban Handle (No Cut)"');
            this._applyTransformConfig("handle_pto", this.dataRule.visibility, setVisible);
            return;
        }
        // Перевіряємо чи існує конфігурація для цього типу
        if (!this.isHandleTypeSupported(handleType)) {
            LoggerService.log(this, `⚠️ [RuleHandleVisibility] Unknown HandleType "${handleType}", available types:`, this.getAvailableHandleTypes());
            if (!hasFluting) this._hideOverlays();
            return;
        }
        // Застосовуємо конфігурацію видимості
        this._applyTransformConfig(handleType, this.dataRule.visibility, setVisible);
    }
    /**
     * Ховає fluting-overlays (використовується, коли тип ручки невідомий і fluting немає)
     */ _hideOverlays() {
        SceneEntityHelper.collectByNames(this.entity, ULH_FLUTING_OVERLAYS).forEach((entity)=>SceneTransformHelper.setVisibleByState(entity, "Disable"));
    }
    /**
     * Отримує поточну конфігурацію видимості
     */ getCurrentConfiguration() {
        const handleEntities = SceneEntityHelper.collectByNames(this.context.entity, Object.keys(this.dataRule.visibility.values));
        const current = {};
        handleEntities.forEach((entity)=>{
            current[entity.name] = entity.enabled;
        });
        return current;
    }
    /**
     * Перевіряє чи Handle Type підтримується
     */ isHandleTypeSupported(handleType) {
        return this.dataRule.visibility.breakpoints.includes(handleType);
    }
    /**
     * Отримує список доступних типів ручок
     */ getAvailableHandleTypes() {
        return [
            ...this.dataRule.visibility.breakpoints
        ];
    }
    constructor(context){
        super({
            name: "HandleVisibility",
            watchAttributes: [
                "Handle",
                "DrawerPanelFluting"
            ],
            priority: 5
        });
        this.context = context;
        this.dataRule = {
            visibility: MeshRuleConfigBuilder.create().breakpoints([
                "handle_pto",
                "handle_urban_topcut"
            ]).meshes([
                "ULH_Drawer_HNoCut",
                "ULH_Overlay_HNoCut"
            ]).values({
                handle_pto: "Enable",
                handle_urban_topcut: "Disable"
            }).meshes([
                "ULH_Drawer_HTopCut",
                "ULH_Overlay_HTopCut",
                "ULH_Cabinet_HGroove"
            ]).values({
                handle_pto: "Disable",
                handle_urban_topcut: "Enable"
            }).build()
        };
    }
}

export { RuleHandleULHCabinet };
