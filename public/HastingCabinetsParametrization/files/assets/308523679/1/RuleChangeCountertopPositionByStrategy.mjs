import { RuleChangeCountertopPosition } from './RuleChangeCountertopPosition.mjs';
import { SceneEntityHelper } from '../../../helpers/scene-entity-helper.mjs';
import { SceneTransformHelper } from '../../../helpers/scene-transform-helper.mjs';
import { LoggerService } from '../../../services/logger/logger-service.mjs';
import { COUNTERTOP_POSITIONING } from '../../countertop/countertop-support-resolver.mjs';

const finiteNumberOrNull = value => {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
};

/** Resolve the mount point below the centred TopSolid pivot after a symmetric Y stretch. */
export function resolveCountertopMountLocalY({ baseLocalYM, thicknessOffsetYM } = {}) {
    const baseY = finiteNumberOrNull(baseLocalYM);
    const offsetY = finiteNumberOrNull(thicknessOffsetYM);
    return baseY !== null && offsetY !== null ? baseY - offsetY / 2 : null;
}

/**
 * Dispatches the local countertop positioning rule by the explicit composition strategy.
 *
 * Standard Height keeps the legacy height table. Support-plane collections only keep the
 * thickness correction; their cabinet-relative world Y is owned by the composition layout.
 */
export class RuleChangeCountertopPositionByStrategy extends RuleChangeCountertopPosition {
    constructor() {
        super();
        this.name = 'Countertop-Position-By-Strategy';
        this.watchAttributes = ['Height', 'Thickness', 'CountertopPositioning'];
    }

    execute(params) {
        const strategy = params.currentState.get('CountertopPositioning') || COUNTERTOP_POSITIONING.LEGACY;
        if (strategy !== COUNTERTOP_POSITIONING.SUPPORT_PLANE) {
            return super.execute(params);
        }

        let thickness = params.currentState.get('Thickness');
        if (thickness === undefined || thickness === null || thickness === '') thickness = 0.5;

        const offset = this.context.productConfig?.thicknessOffsets?.countertop?.[thickness];
        if (!offset) {
            LoggerService.warn(this, '[Countertop-Position-By-Strategy] No thickness offset', { thickness });
            return;
        }

        const thicknessOffsetY = finiteNumberOrNull(offset.y);
        if (thicknessOffsetY === null) {
            LoggerService.warn(this, '[Countertop-Position-By-Strategy] Invalid thickness offset', { thickness, offset });
            return;
        }

        const topSolidPoints = SceneEntityHelper.collectByNames(this.context.entity, ['Top_Solid_Point']);
        topSolidPoints.forEach(point => {
            SceneTransformHelper.setLocalPosition(point, { y: thicknessOffsetY / 2 });
        });

        const mountConfig = this.context.productConfig?.countertopMount;
        const mountLocalY = resolveCountertopMountLocalY({
            baseLocalYM: mountConfig?.baseLocalYM,
            thicknessOffsetYM: thicknessOffsetY
        });
        if (mountLocalY === null) {
            LoggerService.warn(this, '[Countertop-Position-By-Strategy] Countertop mount base is unavailable', {
                baseLocalYM: mountConfig?.baseLocalYM
            });
            return;
        }

        const mountPoints = SceneEntityHelper.collectByNames(
            this.context.entity,
            [mountConfig?.anchorName || 'Countertop_Mount_Point']
        );
        mountPoints.forEach(point => {
            SceneTransformHelper.setLocalPosition(point, { y: mountLocalY });
        });
    }
}
