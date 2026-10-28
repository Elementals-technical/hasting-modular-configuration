import { BaseCompositionRule } from './base-composition-rule.mjs';

class RuleUFBaseboard extends BaseCompositionRule {
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
            name: "UFBaseboard",
            watchCompositions: [
                "cabinets"
            ],
            watchParams: [
                "Width",
                "Depth",
                "Height",
                "CabinetColor",
                "SpatialOffsetM",
                "productType"
            ]
        });
        this.service = service;
    }
}

export { RuleUFBaseboard };
