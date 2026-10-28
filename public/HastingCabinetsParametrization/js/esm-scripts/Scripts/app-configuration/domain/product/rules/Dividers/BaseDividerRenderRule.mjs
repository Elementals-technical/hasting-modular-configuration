import { BaseProductRule } from '../base-product-rule.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { DividerDefinitions } from '../../../../services/drawer-divider/core/DividerDefinitions.mjs';
import { DividerDebugLogger } from '../../../../services/drawer-divider/diagnostics/DividerDebugLogger.mjs';

/**
 * @typedef {Object} DividerRenderConfig
 * @property {string} name                 - Назва правила (BaseProductRule)
 * @property {string[]} watchAttributes    - Атрибути-тригери (BaseProductRule)
 * @property {number} priority             - Пріоритет виконання (BaseProductRule)
 * @property {string} stateKey             - Ключ конфігу зі слотами ('TopDrawerDividers'|'BotDrawerDividers')
 * @property {string} drawerPointName      - Scene-нода шухляди ('TopDrawer_Point'|'BotDrawer_Point')
 * @property {string} openClosePointName   - Нода анімації, під яку чіпляється контейнер дивайдерів
 * @property {string[]} zoneNames          - Зони для рендеру (['main'] | ['siphon_left','siphon_right'])
 * @property {Object<number,number>|null} heightOffsets - Таблиця Y-offset по Height; null = не застосовувати
 * @property {string} traceLabel           - Префікс traceId для діагностики
 * @property {string} logTag               - Тег для людських логів ('TopDrawer'|'BotDrawer'|'TopFullDrawer')
 */ /**
 * BaseDividerRenderRule — спільний скелет рендеру дивайдерів для всіх шухляд.
 *
 * Сила, яку гасить: рендер-логіка (wiring контейнера, вибір depth-групи 46/50,
 * clear+spawn зі стану слотів) була ДУБЛЬОВАНА 1:1 у трьох правилах
 * (Top/Bot/TopFull). База тримає інваріантний скелет; підкласи дають ЛИШЕ дані,
 * що варіюються, через config у super({...}).
 *
 * Що НЕ робить: не рахує позиції слотів (це SlotEngine/Calculator), не пише в
 * store (це DividerFacade), не змінює формат даних. Читає готові слоти зі стану
 * і спавнить меші у slot.position.center.
 */ class BaseDividerRenderRule extends BaseProductRule {
    onInitialize() {
        const drawerPoint = this.entity.findByName(this._cfg.drawerPointName);
        if (drawerPoint) {
            this._dividersContainer = drawerPoint.findByName('DividersUni_Point_Clone');
        }
    }
    execute({ currentState }) {
        const traceId = DividerDebugLogger.nextTraceId(this._cfg.traceLabel);
        const slots = currentState.get(this._cfg.stateKey) || [];
        const height = currentState.get('Height');
        const depth = currentState.get('Depth');
        const width = currentState.get('Width'); // Ширина кабінету в см
        DividerDebugLogger.log(`${this.name}.execute`, 'Rendering drawer dividers', {
            traceId,
            cabinetId: this.entity?.name,
            width,
            height,
            depth,
            slots: DividerDebugLogger.summarizeDrawerConfig(slots)
        });
        // Відстежуємо зміну Width
        if (this._previousWidth !== null && this._previousWidth !== width) {
            this._handleWidthChange(this._previousWidth, width);
        }
        this._previousWidth = width;
        const drawerPoint = this.entity.findByName(this._cfg.drawerPointName);
        if (!drawerPoint) {
            DividerDebugLogger.warn(`${this.name}.execute`, 'Drawer point not found', {
                traceId,
                cabinetId: this.entity?.name,
                drawerPointName: this._cfg.drawerPointName
            });
            return;
        }
        if (!this._dividersContainer) {
            // Клонуємо під OpenClose_Point — дівайдери автоматично рухаються з анімацією шухляди
            const openClosePoint = drawerPoint.findByName(this._cfg.openClosePointName);
            this._dividersContainer = this._cloneDividersContainer(openClosePoint || drawerPoint);
        }
        if (!this._dividersContainer) {
            DividerDebugLogger.warn(`${this.name}.execute`, 'Dividers container is not available', {
                traceId,
                cabinetId: this.entity?.name
            });
            return;
        }
        if (this._cfg.heightOffsets) {
            this._applyHeightOffset(height);
        }
        const depthGroup = DividerDefinitions.getDepthGroup(depth);
        const group46 = this._dividersContainer.findByName('Dividers46_Point');
        const group50 = this._dividersContainer.findByName('Dividers50_Point');
        if (group46) group46.enabled = depthGroup === '46';
        if (group50) group50.enabled = depthGroup === '50';
        const activeGroup = depthGroup === '46' ? group46 : group50;
        if (!activeGroup) {
            DividerDebugLogger.warn(`${this.name}.execute`, 'Active divider depth group not found', {
                traceId,
                cabinetId: this.entity?.name,
                depth,
                depthGroup,
                hasGroup46: Boolean(group46),
                hasGroup50: Boolean(group50)
            });
            return;
        }
        this._clearGeneratedDividers(activeGroup);
        const zones = slots.zones || {};
        for (const zoneName of this._cfg.zoneNames){
            const zone = zones[zoneName] || {
                slots: []
            };
            zone.slots.forEach((slot, index)=>{
                const value = typeof slot === 'string' ? slot : slot.value;
                if (value === 'empty' || value === 'none') return;
                this._spawnDivider(activeGroup, value, slot.position.center, depthGroup, index);
            });
        }
        DividerDebugLogger.log(`${this.name}.execute`, 'Drawer divider rendering completed', {
            traceId,
            cabinetId: this.entity?.name,
            depthGroup,
            renderedChildren: activeGroup.children.filter((child)=>child.name.includes('_Generated')).map((child)=>child.name)
        });
    }
    _cloneDividersContainer(parent) {
        const template = this.app.root.findByName('DrawersDividers');
        if (!template) return null;
        const templatePoint = template.findByName('DividersUni_Point');
        if (!templatePoint) return null;
        const clone = templatePoint.clone();
        clone.name = 'DividersUni_Point_Clone';
        clone.enabled = true;
        parent.addChild(clone);
        clone.setLocalPosition(0, 0, 0);
        this._dividersContainer = clone;
        return clone;
    }
    _clearGeneratedDividers(group) {
        [
            ...group.children
        ].forEach((child)=>{
            if (child.name.includes('_Generated')) child.destroy();
        });
        [
            'A',
            'B',
            'C'
        ].forEach((type)=>{
            const depthSuffix = group.name.includes('46') ? '46' : '50';
            const tpl = group.findByName(`Divider_${type}_${depthSuffix}`);
            if (tpl) tpl.enabled = false;
        });
    }
    _spawnDivider(group, type, x, depthSuffix, index) {
        const templateName = `Divider_${type}_${depthSuffix}`;
        const template = group.findByName(templateName);
        if (!template) {
            DividerDebugLogger.warn(`${this.name}._spawnDivider`, 'Divider template not found', {
                cabinetId: this.entity?.name,
                templateName,
                type,
                x,
                depthSuffix,
                index,
                group: group?.name
            });
            return;
        }
        template.enabled = false;
        const clone = template.clone();
        clone.name = `${templateName}_Generated_${index}`;
        clone.enabled = true;
        group.addChild(clone);
        clone.setLocalPosition(x, 0, 0);
        DividerDebugLogger.log(`${this.name}._spawnDivider`, 'Divider entity spawned', {
            cabinetId: this.entity?.name,
            templateName,
            cloneName: clone.name,
            type,
            x,
            depthSuffix,
            index
        });
    }
    _applyHeightOffset(height) {
        const yOffset = this._cfg.heightOffsets?.[height];
        if (yOffset !== undefined && this._dividersContainer) {
            const currentPos = this._dividersContainer.getLocalPosition();
            this._dividersContainer.setLocalPosition(currentPos.x, yOffset, currentPos.z);
        }
    }
    /**
     * Обробка зміни Width тумби.
     * Фактичний перерахунок дівайдерів відбувається в setConfig → DividerFacade.recalculateOnResize().
     * Rule отримує вже перераховані слоти через updatedConfig.
     */ _handleWidthChange(oldWidth, newWidth) {
        LoggerService.log(this, `🔄 [${this._cfg.logTag}] Width changed: ${oldWidth}cm → ${newWidth}cm. Dividers recalculated by DividerFacade.`);
    }
    /**
     * @param {DividerRenderConfig} cfg
     */ constructor(cfg){
        super({
            name: cfg.name,
            watchAttributes: cfg.watchAttributes,
            priority: cfg.priority
        });
        this._cfg = cfg;
        this._dividersContainer = null;
        this._previousWidth = null; // Для відстеження змін Width
    }
}

export { BaseDividerRenderRule };
