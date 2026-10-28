import { BaseDividerRenderRule } from './BaseDividerRenderRule.mjs';

/**
 * Дивайдери верхньої повної шухляди Sink-Cabinet (TopFull).
 * Одна зона 'main' (packed, без siphon) + height-offset.
 * Уся логіка рендеру — у BaseDividerRenderRule; тут лише конфіг.
 */
export class RuleDividersTopFullDrawer extends BaseDividerRenderRule {
    constructor() {
        super({
            name: 'DividersTopFullDrawer',
            watchAttributes: ['TopDrawerDividers', 'TopDrawerAlignment', 'Width', 'Height', 'Depth'],
            priority: 45,
            stateKey: 'TopDrawerDividers',
            drawerPointName: 'TopDrawer_Point',
            openClosePointName: 'TopDrawerOpenClose_Point',
            zoneNames: ['main'],
            heightOffsets: { 56: 0.2323, 53: 0.2623, 50: 0.2623 },
            traceLabel: 'divider-rule-topfull',
            logTag: 'TopFullDrawer'
        });
    }
}
