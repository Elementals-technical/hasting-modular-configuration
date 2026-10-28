import { BaseDividerRenderRule } from './BaseDividerRenderRule.mjs';

/**
 * Дивайдери верхньої шухляди Sink-Base (Top).
 * Дві siphon-зони навколо вирізу під сифон + height-offset.
 * Уся логіка рендеру — у BaseDividerRenderRule; тут лише конфіг.
 */
export class RuleDividersTopDrawer extends BaseDividerRenderRule {
    constructor() {
        super({
            name: 'DividersTopDrawer',
            watchAttributes: ['TopDrawerDividers', 'TopDrawerAlignment', 'Width', 'Height', 'Depth'],
            priority: 45,
            stateKey: 'TopDrawerDividers',
            drawerPointName: 'TopDrawer_Point',
            openClosePointName: 'TopDrawerOpenClose_Point',
            zoneNames: ['siphon_left', 'siphon_right'],
            heightOffsets: { 56: 0.2323, 53: 0.2623, 50: 0.2623 },
            traceLabel: 'divider-rule-top',
            logTag: 'TopDrawer'
        });
    }
}
