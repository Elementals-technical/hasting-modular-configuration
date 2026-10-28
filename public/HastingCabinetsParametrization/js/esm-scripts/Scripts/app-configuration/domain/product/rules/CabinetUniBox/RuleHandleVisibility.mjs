import { SceneEntityHelper } from '../../../../helpers/scene-entity-helper.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { BaseProductRule } from '../base-product-rule.mjs';

/**
 * Правило керування видимістю ручок на тумбочках/полицях.
 * 
 * Реагує на зміни атрибута 'HandleType' в store.
 * Показує/ховає відповідні handle-об'єкти залежно від типу.
 */ class RuleHandleVisibility extends BaseProductRule {
    onInitialize() {
        LoggerService.log(this, `🎨 [RuleHandleVisibility] Initialized for product "${this.productId}"`);
    }
    /**
     * Основне виконання правила.
     */ execute({ currentState, previousState }) {
        const handleType = currentState.Handle || currentState.get?.('Handle');
        LoggerService.log(this, `🎨 [RuleHandleVisibility] Executing for HandleType: "${handleType}"`, {
            previousHandleType: previousState?.HandleType || previousState?.get?.('HandleType'),
            productId: this.productId
        });
        // Якщо HandleType не вказано або порожнє - встановлюємо дефолт
        if (!handleType || handleType === '') {
            LoggerService.log(this, '⚠️ [RuleHandleVisibility] HandleType is empty, applying default "Urban Handle (No Cut)"');
            this._applyHandleConfiguration('handle_pto');
            return;
        }
        // Перевіряємо чи існує конфігурація для цього типу
        if (!this.handleConfigurations[handleType]) {
            LoggerService.log(this, `⚠️ [RuleHandleVisibility] Unknown HandleType "${handleType}", available types:`, Object.keys(this.handleConfigurations));
            return;
        }
        // Застосовуємо конфігурацію видимості
        this._applyHandleConfiguration(handleType);
    }
    /**
     * Застосовує конфігурацію видимості для handle-об'єктів
     * @private
     */ _applyHandleConfiguration(handleType) {
        const config = this.handleConfigurations[handleType];
        if (!config) {
            console.error(`[RuleHandleVisibility] No configuration found for "${handleType}"`);
            return;
        }
        // Збираємо всі handle entities в продукті
        const handleEntities = SceneEntityHelper.collectByNames(this.context.entity, this.allHandleObjects);
        if (handleEntities.length === 0) {
            LoggerService.log(this, '⚠️ [RuleHandleVisibility] No handle entities found in product', {
                productId: this.productId
            });
            return;
        }
        let appliedCount = 0;
        const changes = [];
        // Застосовуємо видимість до кожного handle
        handleEntities.forEach((entity)=>{
            const shouldBeVisible = config[entity.name];
            if (shouldBeVisible !== undefined) {
                const wasEnabled = entity.enabled;
                entity.enabled = shouldBeVisible;
                appliedCount++;
                changes.push({
                    name: entity.name,
                    from: wasEnabled,
                    to: shouldBeVisible,
                    changed: wasEnabled !== shouldBeVisible
                });
                LoggerService.log(this, `   ${shouldBeVisible ? '✓' : '✗'} ${entity.name}: ${wasEnabled ? 'visible' : 'hidden'} → ${shouldBeVisible ? 'visible' : 'hidden'}${wasEnabled !== shouldBeVisible ? ' (changed)' : ''}`);
            }
        });
        LoggerService.log(this, `✅ [RuleHandleVisibility] Applied "${handleType}" configuration`, {
            productId: this.productId,
            appliedCount,
            totalHandles: handleEntities.length,
            changes: changes.filter((c)=>c.changed)
        });
    }
    /**
     * Отримує поточну конфігурацію видимості
     */ getCurrentConfiguration() {
        const handleEntities = SceneEntityHelper.collectByNames(this.context.entity, this.allHandleObjects);
        const current = {};
        handleEntities.forEach((entity)=>{
            current[entity.name] = entity.enabled;
        });
        return current;
    }
    /**
     * Перевіряє чи Handle Type підтримується
     */ isHandleTypeSupported(handleType) {
        return this.handleConfigurations.hasOwnProperty(handleType);
    }
    /**
     * Отримує список доступних типів ручок
     */ getAvailableHandleTypes() {
        return Object.keys(this.handleConfigurations);
    }
    constructor(context){
        super({
            name: 'HandleVisibility',
            watchAttributes: [
                'Handle'
            ],
            priority: 5 // Висок��й пріоритет - виконується раніше
        });
        this.context = context;
        // Мапінг типів ручок на видимість об'єктів
        this.handleConfigurations = {
            'handle_pto': {
                'HandleBotCut_Top': false,
                'HandleNoCut_Top': true,
                'HandleTopCut_Top': false,
                'HandleNoCut_Bot': true,
                'HandleTopCut_Bot': false
            },
            'handle_urban_topcut': {
                'HandleBotCut_Top': false,
                'HandleNoCut_Top': false,
                'HandleTopCut_Top': true,
                'HandleNoCut_Bot': false,
                'HandleTopCut_Bot': true
            },
            'handle_urban_botcut': {
                'HandleBotCut_Top': true,
                'HandleNoCut_Top': false,
                'HandleTopCut_Top': false,
                'HandleNoCut_Bot': false,
                'HandleTopCut_Bot': true
            }
        };
        // Всі handle-об'єкти що керуємо
        this.allHandleObjects = [
            'HandleBotCut_Top',
            'HandleNoCut_Top',
            'HandleTopCut_Top',
            'HandleNoCut_Bot',
            'HandleTopCut_Bot'
        ];
    }
}

export { RuleHandleVisibility };
