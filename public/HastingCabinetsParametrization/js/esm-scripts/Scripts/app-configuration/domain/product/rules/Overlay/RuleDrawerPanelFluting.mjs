import { BaseProductRule } from '../base-product-rule.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { OverlayRuleHelper } from './overlay-rule-helper.mjs';
import { SceneTransformHelper } from '../../../../helpers/scene-transform-helper.mjs';
import { SceneEntityHelper } from '../../../../helpers/scene-entity-helper.mjs';
import { MeshRuleConfigBuilder } from '../../../../helpers/mesh-rule-config-builder.mjs';
import { DRAWER_OVERLAY_ENTITIES, FLUTING_TEXTURES, OVERLAY_TEMPLATE_GROUPS } from './overlay-texture-config.mjs';

class RuleDrawerPanelFluting extends BaseProductRule {
    onInitialize() {
        LoggerService.log(this, `[RuleDrawerPanelFluting] Initialized for product "${this.productId}"`);
    }
    async execute({ currentState, previousState }) {
        const flutingType = currentState.get('DrawerPanelFluting');
        const cabinetColor = currentState.get('CabinetColor');
        const width = currentState.get("Width");
        const height = currentState.get("Height");
        const depth = currentState.get("Depth");
        const entity = this.context.entity;
        const app = entity.app || this.app;
        // 1. Handle 'None' case — disable drawer overlays
        if (!flutingType || flutingType === 'None') {
            if (OverlayRuleHelper.hasOverlays(entity, DRAWER_OVERLAY_ENTITIES)) {
                OverlayRuleHelper.setOverlaysEnabled(entity, DRAWER_OVERLAY_ENTITIES, false);
            }
            return;
        }
        // 2. Validate fluting type
        const textureConfig = FLUTING_TEXTURES[flutingType];
        if (!textureConfig) return;
        // 3. Ensure overlays exist + enable + wait for SmartStretch init
        const justCreated = await this._ensureDrawerOverlaysExist();
        OverlayRuleHelper.setOverlaysEnabled(entity, DRAWER_OVERLAY_ENTITIES, true);
        if (justCreated) {
            // SmartStretch ініціалізується тільки коли entity enabled + в scene
            await SceneTransformHelper.waitForFrames(2);
        }
        // 4. Color Logic
        if (cabinetColor) {
            const matAsset = app.assets.find(cabinetColor, 'material');
            if (matAsset) {
                if (!matAsset.resource) {
                    await new Promise((resolve)=>{
                        matAsset.ready(()=>resolve());
                        app.assets.load(matAsset);
                    });
                }
                OverlayRuleHelper.applyBaseMaterial(entity, DRAWER_OVERLAY_ENTITIES, matAsset.resource);
            }
        }
        // 5. Apply Textures
        await this._applyToDrawerOverlays(textureConfig);
        // 6. Apply Transforms (Stretch/Move)
        this._applyOverlayTransforms(width, height, depth);
        LoggerService.log(this, `[RuleDrawerPanelFluting] Applied fluting and transforms`, {
            flutingType,
            width
        });
    }
    // === TRANSFORM HELPERS ===
    _applyOverlayTransforms(width, height, depth) {
        const entity = this.context.entity;
        // 1. Stretch X (Только для списка Handle...Overlay)
        this._applyBatchStretchToOverlays(entity, this._stretchByWidth, width);
        // 2. Moves (Двигаем точки привязки ящиков/ручек)
        this._applyMoveConfig(entity, this._moveByHeight, height, "y");
        this._applyMoveConfig(entity, this._moveByDepth, depth, "z");
        this._applyMoveConfig(entity, this._moveByDepthTopDrawer, depth, "z");
    }
    _applyBatchStretchToOverlays(rootEntity, config, value) {
        const valueKey = String(value);
        Object.keys(config.values).forEach((baseName)=>{
            const meshConfig = config.values[baseName];
            if (!meshConfig || !meshConfig[valueKey]) return;
            const targets = SceneEntityHelper.collectByPredicate(rootEntity, (e)=>e.name.includes(baseName));
            targets.forEach((ent)=>SceneTransformHelper.setStretch(ent, meshConfig[valueKey]));
        });
    }
    _applyMoveConfig(rootEntity, config, value, axis) {
        const valueKey = String(value);
        Object.keys(config.values).forEach((baseName)=>{
            const targets = SceneEntityHelper.collectByPredicate(rootEntity, (e)=>e.name.includes(baseName));
            targets.forEach((ent)=>{
                const cfg = config.values[baseName][valueKey];
                if (!cfg) return;
                const cur = ent.getLocalPosition();
                const newPos = {
                    x: axis === "x" ? cfg.x : cur.x,
                    y: axis === "y" ? cfg.y : cur.y,
                    z: axis === "z" ? cfg.z : cur.z
                };
                SceneTransformHelper.setLocalPosition(ent, newPos);
            });
        });
    }
    // === EXISTING HELPERS ===
    /**
     * @returns {boolean} true якщо overlays щойно створені (потрібен wait для SmartStretch init)
     */ async _ensureDrawerOverlaysExist() {
        const entity = this.context.entity;
        const app = this.context.entity.app || this.app;
        if (OverlayRuleHelper.hasOverlays(entity, DRAWER_OVERLAY_ENTITIES)) {
            return false;
        }
        const templateName = OVERLAY_TEMPLATE_GROUPS.cabinet;
        OverlayRuleHelper.cloneAndAttachOverlays(templateName, entity, app);
        return true;
    }
    async _applyToDrawerOverlays(textureConfig) {
        const entity = this.context.entity;
        const app = this.context.entity.app || this.app;
        await OverlayRuleHelper.applyTextureConfig(entity, DRAWER_OVERLAY_ENTITIES, textureConfig, app);
    }
    constructor(context){
        super({
            name: 'DrawerPanelFluting',
            watchAttributes: [
                'DrawerPanelFluting',
                'CabinetColor',
                'GrainDirection',
                'Width',
                'Height',
                'Depth'
            ],
            priority: 56
        });
        this.context = context;
        this._widthTargetOverlays = [
            "HandleNoCut_Bot_Overlay",
            "HandleTopCut_Bot_Overlay",
            "HandleBotCut_Top_Overlay",
            "HandleNoCut_Top_Overlay",
            "HandleTopCut_Top_Overlay"
        ];
        this._stretchByWidth = MeshRuleConfigBuilder.meshes(this._widthTargetOverlays).breakpoints([
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
                x: 0.0
            },
            70: {
                x: 0.1
            },
            80: {
                x: 0.2
            },
            90: {
                x: 0.3
            },
            105: {
                x: 0.45
            },
            120: {
                x: 0.6
            }
        }).build();
        this._moveByHeight = MeshRuleConfigBuilder.meshes([
            "TopHandleMove_Overlay_Point",
            "TopDrawer_Overlay_Point",
            "BotHandleMove_Overlay_Point"
        ]).breakpoints([
            50,
            53,
            56
        ]).values({
            50: {
                y: -0.03
            },
            53: {
                y: -0.015
            },
            56: {
                y: 0.0
            }
        }).build();
        this._moveByDepth = MeshRuleConfigBuilder.meshes([
            "TopHandleMove_Overlay_Point",
            "TopDrawer_Overlay_Point",
            "BotHandleMove_Overlay_Point"
        ]).breakpoints([
            46,
            50.5
        ]).values({
            46: {
                z: 0.0
            },
            50.5: {
                z: 0.0225
            }
        }).build();
        this._moveByDepthTopDrawer = MeshRuleConfigBuilder.meshes([
            "TopDrawer_Overlay_Point",
            "TopHandleMove_Overlay_Point"
        ]).breakpoints([
            46,
            50.5
        ]).values({
            46: {
                z: 0.0
            },
            50.5: {
                z: 0.044
            }
        }).build();
    }
}

export { RuleDrawerPanelFluting };
