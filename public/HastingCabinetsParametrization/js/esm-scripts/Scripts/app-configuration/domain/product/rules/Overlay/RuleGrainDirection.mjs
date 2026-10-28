import { BaseProductRule } from '../base-product-rule.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { SceneEntityHelper } from '../../../../helpers/scene-entity-helper.mjs';
import { getGrainRotationAngle } from './grain-rotation-config.mjs';

/**
 * Grain Direction — повертає текстури через triplanar rotation.
 *
 * Замість overlay entities, змінює rotationAngle на triPlanarMapping скриптах
 * всіх enabled entities продукту (крім _Overlay — ті для fluting).
 *
 * Кут повороту залежить від матеріалу (CabinetColor) та напрямку (GrainVertical/GrainHorizontal).
 * Працює тільки на матеріалах зі списку GRAIN_SUPPORTED_MATERIALS.
 */ class RuleGrainDirection extends BaseProductRule {
    onInitialize() {
        LoggerService.log(this, `[RuleGrainDirection] Initialized for product "${this.productId}"`);
    }
    execute({ currentState }) {
        const grainType = currentState.get("GrainDirection");
        const cabinetColor = currentState.get("CabinetColor");
        const entity = this.context.entity;
        if (!grainType || grainType === "None" || !cabinetColor) {
            this._setRotation(entity, 0);
            return;
        }
        const angle = getGrainRotationAngle(cabinetColor, grainType);
        if (angle === null) {
            // Material not supported for grain direction
            this._setRotation(entity, 0);
            return;
        }
        this._setRotation(entity, angle);
        LoggerService.log(this, `[RuleGrainDirection] Applied rotation ${angle}°`, {
            grainType,
            cabinetColor
        });
    }
    _setRotation(rootEntity, angle) {
        const sinkAnchorName = this.context?.productConfig?.sinkMount?.anchorName || 'Sink_Point';
        const isInsideSink = (e)=>{
            for(let cur = e.parent; cur && cur !== rootEntity.parent; cur = cur.parent){
                if (cur.name === sinkAnchorName) return true;
            }
            return false;
        };
        const entities = SceneEntityHelper.collectByPredicate(rootEntity, (e)=>e.script?.triPlanarMapping && !e.name.includes("_Overlay") && !isInsideSink(e));
        entities.forEach((ent)=>{
            const triPlanar = ent.script.triPlanarMapping;
            triPlanar.rotationAngle = angle;
            triPlanar.updateUniforms?.();
        });
    }
    constructor(context){
        super({
            name: "GrainDirection",
            watchAttributes: [
                "GrainDirection",
                "CabinetColor"
            ],
            priority: 55
        });
        this.context = context;
    }
}

export { RuleGrainDirection };
