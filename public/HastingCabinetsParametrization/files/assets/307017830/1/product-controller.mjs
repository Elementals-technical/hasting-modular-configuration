import { RuleExecutor } from '../rules/rule-executor.mjs';
import { LoggerService } from '../../../services/logger/logger-service.mjs';
import { Script } from 'playcanvas';
import { ProductRegistry_V2 } from '../registry/product-registry-v2.mjs';


/**
 * The {@link https://api.playcanvas.com/classes/Engine.Script.html | Script} class is
 * the base class for all PlayCanvas scripts. Learn more about writing scripts in the
 * {@link https://developer.playcanvas.com/user-manual/scripting/ | scripting guide}.
 */
export class ProductController extends Script {

    static scriptName = 'productController';

    initialize() {
        const productId = this.entity.name;

        LoggerService.log(
            this,
            `📦 [ProductController] Initializing for '${productId}'`
        );

        // 1. Ініціалізація Rule Executor
        const context = {
            app: this.app,
            entity: this.entity,
            productId: productId
        };

        this.ruleExecutor = new RuleExecutor(context);

        // 2. Реєстрація правил продукту
        this._registerProductRules();

        LoggerService.log(
            this,
            `✅ [ProductController] Initialized with ${this.ruleExecutor.rules.length} rules`
        );
    }

    /**
     * Реєстрація всіх правил для цього продукту через ProductRegistry.
     * Автоматично визначає тип продукту та завантажує відповідні правила.
     */
    _registerProductRules() {
        const registry = ProductRegistry_V2.instance;
        const entityName = this.entity.name;

        // Визначаємо тип продукту за назвою entity
        const productType = registry.detectProductType(entityName);

        if (!productType) {
            LoggerService.warn(
                this,
                `⚠️ [ProductController] Unknown product type for "${entityName}". No rules registered.`
            );
            return;
        }

        // Додаємо productConfig до context для доступу в правилах
        const productConfig = registry.getProductConfig(productType);
        this.ruleExecutor.context.productConfig = productConfig;

        // Отримуємо всі правила для цього типу продукту (специфічні + глобальні)
        const ruleConfigs = registry.getRulesForProduct(productType);

        if (ruleConfigs.length === 0) {
            LoggerService.warn(
                this,
                `⚠️ [ProductController] No rules found for product type "${productType}"`
            );
            return;
        }

        // Реєструємо правила
        ruleConfigs.forEach(({ rule: RuleClass, priority }) => {
            const ruleInstance = new RuleClass();

            // Встановлюємо пріоритет якщо правило підтримує
            if (ruleInstance.setPriority) {
                ruleInstance.setPriority(priority);
            }

            this.ruleExecutor.registerRule(ruleInstance);
        });

        LoggerService.log(
            this,
            `✅ [ProductController] Registered ${ruleConfigs.length} rules for "${productType}" (${entityName})`
        );
    }

    onDestroy() {
        // Знищуємо rule executor
        if (this.ruleExecutor) {
            this.ruleExecutor.destroy();
            this.ruleExecutor = null;
        }

        LoggerService.log(
            this,
            `🗑️ [ProductController] Destroyed for "${this.entity.name}"`
        );
    }
}
