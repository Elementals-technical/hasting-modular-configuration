import { BaseCompositionRule } from "./base-composition-rule.mjs";

export class RuleLameUndertop extends BaseCompositionRule {
    constructor(service) {
        super({
            name: "LameUndertop",
            watchCompositions: ["cabinets", "addons"],
            watchParams: ["Width", "Depth", "Height", "Thickness", "ShowUndertop", "HandleColor", "UndertopColor", "SidePanel", "SidePanelType", "SpatialOffsetM", "productType"],
        });

        this.service = service;
    }

    aggregateFn(compositions) {
        return Object.keys(compositions);
    }

    async applyFn(compositionIds, context) {
        // recalculateAll() не передає compositionId.
        const ids = context.compositionId ? [context.compositionId] : compositionIds;

        for (const id of ids) {
            await this.service.reconcile(id);
        }
    }
}
