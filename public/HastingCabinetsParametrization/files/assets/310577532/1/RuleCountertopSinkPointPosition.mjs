import { BaseProductRule } from './base-product-rule.mjs';
import { LoggerService } from '../../../services/logger/logger-service.mjs';
import { SceneEntityHelper } from '../../../helpers/scene-entity-helper.mjs';
import { SceneTransformHelper } from '../../../helpers/scene-transform-helper.mjs';
import {
    COUNTERTOP_SINK_LOCAL_KEY,
    COUNTERTOP_SINK_POINT_NAME,
    COUNTERTOP_SINK_TYPE_KEY,
    isHostedSinkConfig
} from '../../countertop/countertop-hosted-sink.mjs';

const finiteNumber = value => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const offsetY = (offsets, thickness) => {
    if (!offsets || thickness === null) return null;
    const key = Object.keys(offsets).find(candidate => Number(candidate) === thickness);
    const value = key === undefined ? null : offsets[key];
    return finiteNumber(value?.y ?? value);
};

/**
 * Local Y of the hosted sink anchor in the countertop root frame.
 *
 * On a cabinet the sink anchor rises by Δ thicknessOffsets.sink (cabinet frame). The countertop root itself rises by
 * Δ thicknessOffsets.countertop / 2: TopSolid stretches symmetrically about the root and the composition layout keeps
 * `Countertop_Mount_Point` (local `baseLocalYM − offset/2`, RuleChangeCountertopPositionByStrategy) on the support plane.
 * So in the root frame the anchor shifts by Δsink − Δcountertop/2 (≈ the top surface's local shift), relative to the
 * thickness the captured `CountertopSinkLocalM` belongs to. Absolute from that reference, so repeated runs never drift.
 */
export function resolveHostedSinkLocalY({ localY, thickness, baseThickness, thicknessOffsets } = {}) {
    const y = finiteNumber(localY);
    if (y === null) return null;
    const current = finiteNumber(thickness);
    const base = finiteNumber(baseThickness);
    if (current === null || base === null || current === base) return y;

    const sinkDelta = (offsetY(thicknessOffsets?.sink, current) ?? NaN) - (offsetY(thicknessOffsets?.sink, base) ?? NaN);
    const topDelta = (offsetY(thicknessOffsets?.countertop, current) ?? NaN)
        - (offsetY(thicknessOffsets?.countertop, base) ?? NaN);
    const shift = sinkDelta - topDelta / 2;
    return Number.isFinite(shift) ? y + shift : y;
}

/** Keeps the countertop-hosted sink anchor (`Countertop_SinkPoint`) at `CountertopSinkLocalM`, corrected for Thickness. */
export class RuleCountertopSinkPointPosition extends BaseProductRule {
    constructor() {
        super({
            name: 'CountertopSinkPointPosition',
            watchAttributes: ['Thickness', COUNTERTOP_SINK_LOCAL_KEY, COUNTERTOP_SINK_TYPE_KEY],
            priority: 60
        });
    }

    execute({ currentState }) {
        if (!isHostedSinkConfig(currentState)) return;

        const local = currentState.get(COUNTERTOP_SINK_LOCAL_KEY);
        const anchors = SceneEntityHelper.collectByNames(this.context.entity, [COUNTERTOP_SINK_POINT_NAME]);
        if (!local || anchors.length === 0) {
            LoggerService.log(this, '[CountertopSinkPointPosition] Anchor or local position missing, skip', {
                local, anchors: anchors.length
            });
            return;
        }

        anchors.forEach(anchor => {
            const y = resolveHostedSinkLocalY({
                localY: local.y,
                thickness: currentState.get('Thickness'),
                baseThickness: local.thickness,
                thicknessOffsets: this.context.productConfig?.thicknessOffsets
            });
            if (y === null) return;
            SceneTransformHelper.setLocalPosition(anchor, {
                x: finiteNumber(local.x) ?? 0,
                y,
                z: finiteNumber(local.z) ?? 0
            });
        });
    }
}
