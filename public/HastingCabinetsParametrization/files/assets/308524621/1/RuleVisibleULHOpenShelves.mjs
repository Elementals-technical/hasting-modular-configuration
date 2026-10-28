import { ULHCabinetTypeRuleBase } from '../ulh-cabinet-type-rule-base.mjs';

/**
 * ULH-Open-Shelf — Visibility (таблиця "UniOpenShelves template").
 * OpenShelvesDivider завжди вимкнений. Boolean не використовується.
 */
export class RuleVisibleULHOpenShelves extends ULHCabinetTypeRuleBase {
    constructor() {
        super({ name: 'RuleVisibleULHOpenShelves', priority: 5 });

        this.ruleData = {
            visibility: {
                OpenShelvesDivider: 'Disable',
            },
            boolean: {},
        };
    }
}
