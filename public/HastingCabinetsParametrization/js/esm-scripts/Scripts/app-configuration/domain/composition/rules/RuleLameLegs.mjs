import { BaseCompositionRule } from './base-composition-rule.mjs';

class RuleLameLegs extends BaseCompositionRule {
    aggregateFn(compositions) {
        return Object.keys(compositions);
    }
    async applyFn(compositionIds, context) {
        // recalculateAll() не передає compositionId.
        const ids = context.compositionId ? [
            context.compositionId
        ] : compositionIds;
        for (const id of ids){
            await this.service.reconcile(id);
        }
    }
    constructor(service){
        super({
            name: "LameLegs",
            watchCompositions: [
                "cabinets",
                "addons"
            ],
            watchParams: [
                "Width",
                "Depth",
                "Height",
                "Thickness",
                "ShowLegs",
                "Drawers",
                "HandleColor",
                "CabinetColor",
                "LegCapColor",
                "SidePanel",
                "SidePanelType",
                "SpatialOffsetM",
                "productType"
            ]
        });
        this.service = service;
    }
}

export { RuleLameLegs };
