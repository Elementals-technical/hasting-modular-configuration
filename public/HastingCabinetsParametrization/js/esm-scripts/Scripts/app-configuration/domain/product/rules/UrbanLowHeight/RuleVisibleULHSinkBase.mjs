import { ULHCabinetTypeRuleBase } from './ulh-cabinet-type-rule-base.mjs';

/**
 * ULH — Set Sink Bases (таблиця "SB - SC switch").
 * Priority 60: вирізання після розмірів, ручок і розкладки.
 */ class RuleVisibleULHSinkBase extends ULHCabinetTypeRuleBase {
    constructor(){
        super({
            name: 'RuleVisibleULHSinkBase',
            priority: 60
        });
        this.ruleData = {
            visibility: {
                ULH_Cabinet_SCBackWall: 'Disable',
                ULH_Drawer_Framing: 'Enable',
                ULH_Drawer_TopFraming: 'Enable'
            },
            boolean: {
                ULH_Drawer_Floor: 'ULH_Drawer_SBBoolBox',
                ULH_Drawer_BWall: 'ULH_Drawer_SBBoolBox',
                ULH_Cabinet_Walls: 'ULH_Cabinet_SBBoolBox'
            }
        };
    }
}

export { RuleVisibleULHSinkBase };
