import { BaseProductRule } from '../base-product-rule.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { SceneEntityHelper } from '../../../../helpers/scene-entity-helper.mjs';
import { SceneTransformHelper } from '../../../../helpers/scene-transform-helper.mjs';

/**
 * Правило зміни висоти TowelBar.
 *
 * Зміщує TowelBar40_R_Point по Y залежно від Height кабінету.
 *
 * Таблиця:
 * | Height (cm) | 56   | 53    | 50    |
 * | MoveY       | 0    | -0.03 | -0.06 |
 */
export class RuleChangeTowelBarHeight extends BaseProductRule {
    constructor(context) {
        super({
            name: 'ChangeTowelBarHeight',
            watchAttributes: ['Height'],
            priority: 20
        });

        this.context = context;

        // MoveY config: entity → { height: { y } }
        this._moveConfig = {
            'TowelBar40_R_Point': {
                56: { y: 0 },
                53: { y: -0.03 },
                50: { y: -0.06 }
            }
        };
    }

    async execute({ changes, currentState, previousState }) {
        const height = currentState.get('Height');

        if (!height || Number.isNaN(height)) {
            LoggerService.log(this, '[RuleTowelBarHeight] Height is missing or NaN, skip');
            return;
        }

        LoggerService.log(this, `[RuleTowelBarHeight] Executing for height: ${height}`);

        let appliedCount = 0;

        const entityNames = Object.keys(this._moveConfig);
        const entities = SceneEntityHelper.collectByNames(this.entity, entityNames);

        entities.forEach(entity => {
            const configForEntity = this._moveConfig[entity.name];
            if (!configForEntity) return;

            // Шукаємо значення для height (точний збіг або найближчий)
            const value = configForEntity[height];
            if (!value) {
                LoggerService.log(this, `[RuleTowelBarHeight] No value for height ${height} on ${entity.name}`);
                return;
            }

            SceneTransformHelper.setLocalPosition(entity, value);
            appliedCount++;
        });

        LoggerService.log(this, `[RuleTowelBarHeight] MoveY applied`, { height, appliedCount });
    }
}
