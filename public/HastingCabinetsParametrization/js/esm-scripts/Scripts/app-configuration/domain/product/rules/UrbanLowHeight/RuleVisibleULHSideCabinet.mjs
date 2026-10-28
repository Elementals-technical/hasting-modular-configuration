import { ULHCabinetTypeRuleBase } from './ulh-cabinet-type-rule-base.mjs';

/**
 * ULH — Set Side Cabinet (таблиця "SB - SC switch").
 * Priority 5: вимикаємо вирізання до правил розмірів — вони працюють із суцільним mesh.
 */ class RuleVisibleULHSideCabinet extends ULHCabinetTypeRuleBase {
    constructor(){
        super({
            name: 'RuleVisibleULHSideCabinet',
            priority: 5
        });
        this.ruleData = {
            visibility: {
                ULH_Cabinet_SCBackWall: 'Enable',
                ULH_Drawer_Framing: 'Disable',
                ULH_Drawer_TopFraming: 'Disable',
                // Cutter-и SB не потрібні: без вирізання їх ніхто не ховає.
                ULH_Drawer_SBBoolBox: 'Disable',
                ULH_Cabinet_SBBoolBox: 'Disable'
            },
            boolean: {
                ULH_Drawer_Floor: false,
                ULH_Drawer_BWall: false,
                ULH_Cabinet_Walls: false
            }
        };
    }
}

export { RuleVisibleULHSideCabinet };
