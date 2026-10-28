import { LoggerService } from '../../../services/logger/logger-service.mjs';

/**
 * Post-Clone Hook: розв'язує MeshBoolean cutter references після клонування template.
 *
 * Проблема: PlayCanvas при template.clone() НЕ перемаплює entity references
 * в script attributes. MeshBoolean.cutters залишається порожнім → boolean
 * операції не виконуються → cutter mesh видимий.
 *
 * Рішення: після клонування знаходимо всі MeshBoolean скрипти з порожніми
 * cutters і призначаємо їм відповідні BoolBox entities з того ж hierarchy.
 */ /**
 * Знаходить і призначає cutters для всіх MeshBoolean скриптів у клонованому entity.
 *
 * @param {pc.Entity} clonedEntity - корінь клонованого template
 */ function resolveMeshBooleanCutters(clonedEntity) {
    if (!clonedEntity) return;
    // 1. Знайти всі entities з meshBoolean скриптом
    const meshBooleanEntities = [];
    _traverse(clonedEntity, (entity)=>{
        if (entity.script?.meshBoolean) {
            meshBooleanEntities.push(entity);
        }
    });
    if (meshBooleanEntities.length === 0) return;
    // 2. Для кожного — resolve cutters
    let resolvedCount = 0;
    meshBooleanEntities.forEach((entity)=>{
        const mb = entity.script.meshBoolean;
        // Пропускаємо якщо cutters вже є
        if (mb._cutters && mb._cutters.length > 0) return;
        const cutters = _findCuttersForEntity(entity);
        if (cutters.length > 0) {
            mb._cutters = cutters;
            resolvedCount++;
            LoggerService.log('PostCloneHooks', `[PostClone] Resolved ${cutters.length} cutter(s) for "${entity.name}"`, {
                cutters: cutters.map((c)=>c.name)
            });
        }
    });
    if (resolvedCount > 0) {
        LoggerService.log('PostCloneHooks', `[PostClone] Resolved cutters for ${resolvedCount}/${meshBooleanEntities.length} MeshBoolean entities`);
    }
}
const CABINET_SHADOW_BLOCKED_TEMPLATES = new Set([
    'Vessel_Aquarius'
]);
/**
 * Вимикає castShadows для basin templates, чия shadow-map тінь падає на фасад cabinet.
 *
 * Це не змінює геометрію, visibility, transform або матеріали. Mesh лишається видимим
 * і все ще отримує lighting/SSAO; вимикається тільки участь у shadow caster pass.
 *
 * @param {pc.Entity} clonedEntity - корінь клонованого template
 * @param {string} templateName - ім'я template asset
 */ function disableCabinetShadowCasters(clonedEntity, templateName) {
    if (!clonedEntity || !CABINET_SHADOW_BLOCKED_TEMPLATES.has(templateName)) {
        return;
    }
    let disabledCount = 0;
    _traverse(clonedEntity, (entity)=>{
        disabledCount += _disableCastShadows(entity.render);
        disabledCount += _disableCastShadows(entity.model);
    });
    if (disabledCount > 0) {
        LoggerService.log('PostCloneHooks', `[PostClone] Disabled castShadows on ${disabledCount} "${templateName}" render item(s)`);
    }
}
function _disableCastShadows(component) {
    if (!component) {
        return 0;
    }
    let count = 0;
    if (component.castShadows !== false) {
        component.castShadows = false;
        count++;
    }
    const meshInstances = component.meshInstances || [];
    for (const meshInstance of meshInstances){
        if (meshInstance && meshInstance.castShadow !== false) {
            meshInstance.castShadow = false;
            count++;
        }
    }
    return count;
}
/**
 * Шукає cutter entities (BoolBox) для конкретного MeshBoolean entity.
 *
 * Стратегія пошуку:
 * 1. Шукаємо серед siblings (parent.children) — найближчий scope
 * 2. Якщо не знайшли — розширюємо до parent.parent
 * 3. Фільтруємо: має render component + "Bool" в імені + не сам entity
 *
 * @param {pc.Entity} entity - entity з MeshBoolean скриптом
 * @param {pc.Entity} clonedRoot - корінь клонованого template
 * @returns {pc.Entity[]} знайдені cutter entities
 * @private
 */ function _findCuttersForEntity(entity, clonedRoot) {
    const searchScopes = [
        entity.parent,
        entity.parent?.parent,
        entity.parent?.parent?.parent
    ].filter(Boolean);
    for (const scope of searchScopes){
        const cutters = [];
        _traverse(scope, (node)=>{
            if (node === entity) return;
            if (!node.name.includes('Bool')) return;
            if (!node.render && !node.model) return;
            const mi = node.render?.meshInstances || node.model?.meshInstances;
            if (mi && mi.length > 0) {
                cutters.push(node);
            }
        });
        if (cutters.length > 0) return cutters;
    }
    return [];
}
/**
 * Простий traverse по entity hierarchy.
 * @param {pc.Entity} entity
 * @param {Function} callback
 * @private
 */ function _traverse(entity, callback) {
    callback(entity);
    for (const child of entity.children){
        _traverse(child, callback);
    }
}

export { disableCabinetShadowCasters, resolveMeshBooleanCutters };
