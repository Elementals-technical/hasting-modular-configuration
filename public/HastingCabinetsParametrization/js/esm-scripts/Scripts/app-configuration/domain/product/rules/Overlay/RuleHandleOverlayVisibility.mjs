import { BaseProductRule } from '../base-product-rule.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { SceneEntityHelper } from '../../../../helpers/scene-entity-helper.mjs';

class RuleHandleOverlayVisibility extends BaseProductRule {
    onInitialize() {
        LoggerService.log(this, `[RuleHandleOverlayVisibility] Initialized for product "${this.productId}"`);
    }
    execute({ currentState }) {
        const handleType = currentState.get('Handle');
        const flutingType = currentState.get('DrawerPanelFluting');
        // Skip if no overlays should be active
        const hasOverlay = flutingType && flutingType !== 'None';
        if (!hasOverlay) {
            LoggerService.log(this, `[RuleHandleOverlayVisibility] No overlay active, skipping`);
            return;
        }
        LoggerService.log(this, `[RuleHandleOverlayVisibility] Executing for HandleType: "${handleType}"`, {
            flutingType
        });
        // Default to handle_pto if not specified
        if (!handleType || handleType === '') {
            LoggerService.log(this, `[RuleHandleOverlayVisibility] HandleType is empty, applying default "handle_pto"`);
            this._applyHandleConfiguration('handle_pto');
            return;
        }
        // Check if configuration exists for this handle type
        if (!this.handleConfigurations[handleType]) {
            LoggerService.log(this, `[RuleHandleOverlayVisibility] Unknown HandleType "${handleType}", available types:`, Object.keys(this.handleConfigurations));
            return;
        }
        this._applyHandleConfiguration(handleType);
    }
    _applyHandleConfiguration(handleType) {
        const config = this.handleConfigurations[handleType];
        if (!config) {
            LoggerService.log(this, `[RuleHandleOverlayVisibility] No configuration found for "${handleType}"`);
            return;
        }
        // Collect all overlay handle entities using fuzzy matching
        const handleEntities = [];
        this.allHandleOverlayObjects.forEach((baseName)=>{
            const found = SceneEntityHelper.collectByPredicate(this.context.entity, (e)=>e.name.includes(baseName));
            handleEntities.push(...found);
        });
        if (handleEntities.length === 0) {
            LoggerService.log(this, `[RuleHandleOverlayVisibility] No overlay handle entities found in product`, {
                productId: this.productId
            });
            return;
        }
        let appliedCount = 0;
        // Apply visibility to each handle overlay
        handleEntities.forEach((entity)=>{
            const matchingKey = this.allHandleOverlayObjects.find((key)=>entity.name.includes(key));
            if (matchingKey) {
                const shouldBeVisible = config[matchingKey];
                if (shouldBeVisible !== undefined) {
                    entity.enabled = shouldBeVisible;
                    appliedCount++;
                    LoggerService.log(this, `   ${shouldBeVisible ? '✓' : '✗'} ${entity.name}: ${shouldBeVisible ? 'visible' : 'hidden'}`);
                }
            }
        });
        LoggerService.log(this, `[RuleHandleOverlayVisibility] Applied "${handleType}" configuration`, {
            productId: this.productId,
            appliedCount,
            totalHandles: handleEntities.length
        });
    }
    constructor(context){
        super({
            name: 'HandleOverlayVisibility',
            watchAttributes: [
                'Handle',
                'GrainDirection',
                'DrawerPanelFluting'
            ],
            priority: 58 // After RuleDrawerOverlayLayout (57)
        });
        this.context = context;
        this.handleConfigurations = {
            'handle_pto': {
                'HandleBotCut_Top_Overlay': false,
                'HandleNoCut_Top_Overlay': true,
                'HandleTopCut_Top_Overlay': false,
                'HandleNoCut_Bot_Overlay': true,
                'HandleTopCut_Bot_Overlay': false
            },
            'handle_urban_topcut': {
                'HandleBotCut_Top_Overlay': false,
                'HandleNoCut_Top_Overlay': false,
                'HandleTopCut_Top_Overlay': true,
                'HandleNoCut_Bot_Overlay': false,
                'HandleTopCut_Bot_Overlay': true
            },
            'handle_urban_botcut': {
                'HandleBotCut_Top_Overlay': true,
                'HandleNoCut_Top_Overlay': false,
                'HandleTopCut_Top_Overlay': false,
                'HandleNoCut_Bot_Overlay': false,
                'HandleTopCut_Bot_Overlay': true
            }
        };
        this.allHandleOverlayObjects = [
            'HandleBotCut_Top_Overlay',
            'HandleNoCut_Top_Overlay',
            'HandleTopCut_Top_Overlay',
            'HandleNoCut_Bot_Overlay',
            'HandleTopCut_Bot_Overlay'
        ];
    }
}

export { RuleHandleOverlayVisibility };
