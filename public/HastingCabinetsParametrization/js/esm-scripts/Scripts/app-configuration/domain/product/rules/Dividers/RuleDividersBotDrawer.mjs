import { BaseDividerRenderRule } from './BaseDividerRenderRule.mjs';

/**
 * Дивайдери нижньої шухляди (Bot).
 * Зона 'main' (packed), без siphon, без height-offset.
 * Уся логіка рендеру — у BaseDividerRenderRule; тут лише конфіг.
 */ class RuleDividersBotDrawer extends BaseDividerRenderRule {
    constructor(){
        super({
            name: 'DividersBotDrawer',
            watchAttributes: [
                'BotDrawerDividers',
                'BotDrawerAlignment',
                'Width',
                'Depth'
            ],
            priority: 46,
            stateKey: 'BotDrawerDividers',
            drawerPointName: 'BotDrawer_Point',
            openClosePointName: 'BotDrawerOpenClose_Point',
            zoneNames: [
                'main'
            ],
            heightOffsets: null,
            traceLabel: 'divider-rule-bot',
            logTag: 'BotDrawer'
        });
    }
}

export { RuleDividersBotDrawer };
