import { BaseProductRule } from '../base-product-rule.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { OverlayRuleHelper } from './overlay-rule-helper.mjs';
import { FLUTING_TEXTURES } from './overlay-texture-config.mjs';

/**
 * Fluting texture for collections whose drawer overlays are part of the product template.
 *
 * Unlike RuleDrawerPanelFluting (Urban Storage Hybrid), nothing is cloned, enabled or disabled
 * here: overlay names come from product metadata `fluting.overlayNames`, and overlay visibility
 * belongs to the collection's handle rules (visible = handle shows it AND fluting is not 'None').
 * This rule only loads the USH fluting normal/AO maps into the overlays' triPlanarMapping.
 */
export class RuleOverlayFluting extends BaseProductRule {
    constructor() {
        super({
            name: 'OverlayFluting',
            watchAttributes: ['DrawerPanelFluting', 'CabinetColor'],
            priority: 56
        });
        this._warnedValues = new Set();
    }

    async execute({ currentState }) {
        const entity = this.context?.entity;
        const overlayNames = this.context?.productConfig?.fluting?.overlayNames;
        if (!entity || entity._destroyed || !overlayNames?.length) return;

        const flutingType = currentState.get('DrawerPanelFluting');
        if (!flutingType || flutingType === 'None') return;

        const textureConfig = FLUTING_TEXTURES[flutingType];
        if (!textureConfig) {
            if (!this._warnedValues.has(flutingType)) {
                this._warnedValues.add(flutingType);
                LoggerService.warn(this, '[OverlayFluting] Unknown DrawerPanelFluting value, skip', { flutingType });
            }
            return;
        }

        await OverlayRuleHelper.applyTextureConfig(entity, overlayNames, textureConfig, entity.app || this.app);
    }
}
