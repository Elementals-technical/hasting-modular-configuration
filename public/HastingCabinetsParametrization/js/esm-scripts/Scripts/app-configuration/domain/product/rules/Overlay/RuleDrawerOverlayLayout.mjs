import { BaseProductRule } from '../base-product-rule.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { MeshRuleConfigBuilder } from '../../../../helpers/mesh-rule-config-builder.mjs';
import { SceneEntityHelper } from '../../../../helpers/scene-entity-helper.mjs';
import { SceneTransformHelper } from '../../../../helpers/scene-transform-helper.mjs';

class RuleDrawerOverlayLayout extends BaseProductRule {
    onInitialize() {
        LoggerService.log(this, `[RuleDrawerOverlayLayout] Initialized for product "${this.productId}"`);
    }
    execute({ currentState }) {
        const drawers = currentState.get('Drawers');
        const flutingType = currentState.get('DrawerPanelFluting');
        const hasOverlay = flutingType && flutingType !== 'None';
        if (!hasOverlay) {
            LoggerService.log(this, `[RuleDrawerOverlayLayout] No overlay active, skipping`);
            return;
        }
        if (!drawers) {
            LoggerService.log(this, `[RuleDrawerOverlayLayout] No drawer type set, skipping`);
            return;
        }
        LoggerService.log(this, `[RuleDrawerOverlayLayout] Executing for drawers: ${drawers}`, {
            flutingType
        });
        this._applyVisibility(drawers);
        this._applyStretch(drawers);
        this._applyMove(drawers);
    }
    _applyVisibility(drawers) {
        const cfg = this.drawerConfig.visibility.values;
        let appliedCount = 0;
        Object.keys(cfg).forEach((baseName)=>{
            const entities = SceneEntityHelper.collectByPredicate(this.context.entity, (e)=>e.name.includes(baseName));
            const state = cfg[baseName][drawers];
            if (!state) return;
            entities.forEach((entity)=>{
                SceneTransformHelper.setVisibleByState(entity, state);
                appliedCount++;
            });
        });
        LoggerService.log(this, `[RuleDrawerOverlayLayout] Visibility applied`, {
            drawers,
            appliedCount
        });
    }
    _applyStretch(drawers) {
        const cfg = this.drawerConfig.stretch.values;
        let appliedCount = 0;
        Object.keys(cfg).forEach((baseName)=>{
            const entities = SceneEntityHelper.collectByPredicate(this.context.entity, (e)=>e.name.includes(baseName));
            const value = cfg[baseName][drawers];
            if (!value) return;
            entities.forEach((entity)=>{
                SceneTransformHelper.setStretch(entity, value);
                appliedCount++;
            });
        });
        LoggerService.log(this, `[RuleDrawerOverlayLayout] Stretch applied`, {
            drawers,
            appliedCount
        });
    }
    _applyMove(drawers) {
        const cfg = this.drawerConfig.move.values;
        let appliedCount = 0;
        Object.keys(cfg).forEach((baseName)=>{
            const entities = SceneEntityHelper.collectByPredicate(this.context.entity, (e)=>e.name.includes(baseName));
            const value = cfg[baseName][drawers];
            if (!value) return;
            entities.forEach((entity)=>{
                SceneTransformHelper.setLocalPosition(entity, value);
                appliedCount++;
            });
        });
        LoggerService.log(this, `[RuleDrawerOverlayLayout] Move applied`, {
            drawers,
            appliedCount
        });
    }
    constructor(context){
        super({
            name: 'DrawerOverlayLayout',
            watchAttributes: [
                'Drawers',
                'GrainDirection',
                'DrawerPanelFluting'
            ],
            priority: 57 // After RuleDrawerPanelFluting (56)
        });
        this.context = context;
        this.drawerConfig = {
            visibility: MeshRuleConfigBuilder.create().meshes([
                'TopDrawer_Overlay_Point'
            ]).breakpoints([
                '1D',
                '2D',
                '1DWID'
            ]).values({
                '1D': 'Disable',
                '2D': 'Enable',
                '1DWID': 'Enable'
            }).meshes([
                'TopHandleMove_Overlay_Point'
            ]).breakpoints([
                '1D',
                '2D',
                '1DWID'
            ]).values({
                '1D': 'Disable',
                '2D': 'Enable',
                '1DWID': 'Disable'
            }).build(),
            stretch: MeshRuleConfigBuilder.create().meshes([
                'HandleNoCut_Bot_Overlay',
                'HandleTopCut_Bot_Overlay'
            ]).breakpoints([
                '1D',
                '2D',
                '1DWID'
            ]).values({
                '1D': {
                    y: 0.25
                },
                '2D': {
                    y: 0
                },
                '1DWID': {
                    y: 0.25
                }
            }).build(),
            move: MeshRuleConfigBuilder.create().meshes([
                'BotHandleMove_Overlay_Point'
            ]).breakpoints([
                '1D',
                '2D',
                '1DWID'
            ]).values({
                '1D': {
                    y: 0.125
                },
                '2D': {
                    y: 0
                },
                '1DWID': {
                    y: 0.125
                }
            }).build()
        };
    }
}

export { RuleDrawerOverlayLayout };
