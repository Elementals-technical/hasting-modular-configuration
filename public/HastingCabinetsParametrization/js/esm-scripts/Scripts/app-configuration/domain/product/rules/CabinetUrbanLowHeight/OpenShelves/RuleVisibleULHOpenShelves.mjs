import { BaseProductRule } from '../../base-product-rule.mjs';
import { SceneTransformHelper } from '../../../../../helpers/scene-transform-helper.mjs';

/**
 * ULH-Open-Shelf — Visibility (таблиця "UniOpenShelves template").
 * OpenShelvesDivider завжди вимкнений. Boolean не використовується.
 */ class RuleVisibleULHOpenShelves extends BaseProductRule {
    execute() {
        this._applyTransformConfig('shelf', this.dataRule.visibility, (entity, value)=>SceneTransformHelper.setVisibleByState(entity, value));
    }
    constructor(){
        super({
            name: 'RuleVisibleULHOpenShelves',
            priority: 5
        });
        this.dataRule = {
            visibility: {
                values: {
                    OpenShelvesDivider: {
                        shelf: 'Disable'
                    }
                }
            }
        };
    }
}

export { RuleVisibleULHOpenShelves };
