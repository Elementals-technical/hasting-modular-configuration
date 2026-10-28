import { BaseProductRule } from './base-product-rule.mjs';
import { LoggerService } from '../../../services/logger/logger-service.mjs';
import { SceneEntityHelper } from '../../../helpers/scene-entity-helper.mjs';
import { SceneTransformHelper } from '../../../helpers/scene-transform-helper.mjs';

const finiteNumber = value => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const valueForNumericKey = (values, requestedKey) => {
    if (!values || requestedKey === null) return null;

    const direct = values[requestedKey];
    if (direct !== undefined) return direct;

    const matchingKey = Object.keys(values).find(key => Number(key) === requestedKey);
    return matchingKey === undefined ? null : values[matchingKey];
};

/**
 * Resolve the absolute local Y of a collection-specific sink mount.
 * The height position is the calibrated 0.5-inch baseline; thickness adds a
 * deterministic offset from that baseline, so repeated updates never drift.
 */
export function resolveSinkMountLocalY({
    height,
    thickness,
    heightLocalY,
    thicknessOffsets
} = {}) {
    const parsedHeight = finiteNumber(height);
    const parsedThickness = finiteNumber(thickness);
    if (parsedHeight === null || parsedThickness === null) return null;

    const baseValue = valueForNumericKey(heightLocalY, parsedHeight);
    const offsetValue = valueForNumericKey(thicknessOffsets, parsedThickness);
    const baseY = finiteNumber(baseValue?.y ?? baseValue);
    const offsetY = finiteNumber(offsetValue?.y ?? offsetValue);
    if (baseY === null || offsetY === null) return null;

    return baseY + offsetY;
}

/**
 * Positions the sink attachment point for cabinet collections that declare
 * sinkMount.heightLocalY and thicknessOffsets.sink in product metadata.
 * The Urban Duplex and Urban Freestanding Height rules leave Sink_Point to this rule
 * (Lame's Height rule still moves its anchor to the same table).
 */
export class RuleSinkMountPosition extends BaseProductRule {
    constructor() {
        super({
            name: 'SinkMountPosition',
            watchAttributes: ['Height', 'Thickness'],
            priority: 60
        });
    }

    execute({ currentState }) {
        const sinkMount = this.context.productConfig?.sinkMount;
        const anchorName = sinkMount?.anchorName;
        const thicknessOffsets = this.context.productConfig?.thicknessOffsets?.sink;
        const height = currentState.get('Height');
        const localY = resolveSinkMountLocalY({
            height,
            thickness: currentState.get('Thickness') ?? 0.5,
            heightLocalY: sinkMount?.heightLocalY,
            thicknessOffsets
        });

        if (!anchorName || localY === null) {
            LoggerService.log(this, '[SinkMountPosition] Position metadata is incomplete, skip', {
                anchorName,
                height,
                thickness: currentState.get('Thickness')
            });
            return;
        }

        const anchors = SceneEntityHelper.collectByNames(this.context.entity, [anchorName]);
        if (anchors.length === 0) {
            LoggerService.log(this, '[SinkMountPosition] Anchor was not found, skip', { anchorName });
            return;
        }

        anchors.forEach(anchor => SceneTransformHelper.setLocalPosition(anchor, { y: localY }));

        LoggerService.log(this, '[SinkMountPosition] Sink mount positioned', {
            anchorName,
            localY,
            height,
            thickness: currentState.get('Thickness')
        });
    }
}
