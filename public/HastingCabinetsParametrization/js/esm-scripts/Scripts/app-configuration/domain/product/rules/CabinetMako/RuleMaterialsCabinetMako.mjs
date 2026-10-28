import { BaseProductRule } from '../base-product-rule.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { SceneEntityHelper } from '../../../../helpers/scene-entity-helper.mjs';
import { MaterialService } from '../../../../services/material/material-service.mjs';

/** Materials for Mako-side-cabinet. All asset and entity names are exact. */ class RuleMaterialsCabinetMako extends BaseProductRule {
    shouldExecute(changes, currentState, previousState) {
        // Apply fixed materials on creation even when no color was supplied.
        return this.enabled && (!this._hasAppliedMaterials || super.shouldExecute(changes, currentState, previousState));
    }
    onInitialize() {
        LoggerService.log(this, `[Mako materials] Initialized for "${this.productId}"`);
    }
    async execute({ currentState }) {
        const cabinet = this._materialName(currentState.get("CabinetColor"));
        const handle = this._materialName(currentState.get("HandleColor"));
        const leg = this._materialName(currentState.get("LegColor")) ?? cabinet;
        for (const [group, materialName] of [
            [
                "cabinet",
                cabinet
            ],
            [
                "handle",
                handle
            ],
            [
                "leg",
                leg
            ],
            ...Object.entries(this.fixedMaterials)
        ]){
            if (!materialName) continue;
            await this._applyGroup(group, materialName);
        }
        this._hasAppliedMaterials = true;
    }
    _materialName(value) {
        const name = String(value ?? "").trim();
        return !name || name === "None" ? null : name;
    }
    _meshInstances(entity) {
        return [
            ...entity.render?.meshInstances || [],
            ...entity.model?.meshInstances || []
        ];
    }
    /**
     * Застосовує матеріал до однієї групи нод поточного продукту.
     * group — ключ у materialTargets: cabinet, handle, leg або група постійного матеріалу.
     * materialName — точна назва material asset у PlayCanvas.
     * Метод не визначає, який атрибут змінився: групу вибирає execute().
     */ async _applyGroup(group, materialName) {
        // 1. Беремо перелік назв нод цієї групи та шукаємо їх лише всередині
        // поточної тумби. Пошук рекурсивний, за точними назвами, включає
        // вимкнені ноди: приховані шухляди також повинні отримати матеріал.
        const names = this.materialTargets[group];
        const entities = SceneEntityHelper.collectByNames(this.entity, names);
        // 2. Перевіряємо, чи всі назви з конфігурації є в моделі.
        // Відсутня нода дає попередження, але не зупиняє обробку знайдених.
        const foundNames = new Set(entities.map((entity)=>entity.name));
        for (const name of names){
            if (!foundNames.has(name)) {
                LoggerService.warn(this, "[Mako materials] Entity not found", {
                    productId: this.productId,
                    entityName: name,
                    group
                });
            }
        }
        // 3. Залишаємо лише ноди з mesh instances у render або model.
        // Порожньому контейнеру матеріал призначити не можна; його дочірні
        // ноди автоматично не стають цілями цього методу.
        const targets = entities.filter((entity)=>{
            if (this._meshInstances(entity).length > 0) return true;
            LoggerService.warn(this, "[Mako materials] Entity has no mesh instances", {
                productId: this.productId,
                entityName: entity.name,
                group
            });
            return false;
        });
        // Якщо придатних нод немає, навіть не завантажуємо матеріал.
        if (targets.length === 0) return;
        // 4. Отримуємо ресурс матеріалу за назвою через спільний сервіс.
        // Сервіс використовує свій кеш або завантажує asset. Помилка
        // завантаження перерве метод і буде оброблена виконавцем правил.
        const material = await MaterialService.loadMaterial(materialName);
        // 5. Відбираємо ноди, яким справді потрібне нанесення матеріалу.
        // Це захищає від зайвого оновлення Triplanar та інших скриптів.
        const pending = targets.filter((entity)=>{
            const meshes = this._meshInstances(entity);
            // Якщо кожен mesh уже посилається на потрібний ресурс,
            // цю ноду пропускаємо без перевірки локального кешу.
            if (meshes.every((mi)=>mi.material === material)) return false;
            // Triplanar може замінити ресурс його копією для конкретної ноди.
            // Тому звіряємо фактичний стан із записом після минулого нанесення.
            // Повторюємо нанесення, якщо запису немає, змінилася назва чи
            // вихідний ресурс, кількість/порядок mesh instances, сам instance
            // або посилання на його матеріал. Параметри шейдера та геометрію
            // всередині незмінного instance ця перевірка не порівнює.
            const applied = this._appliedMaterials.get(entity);
            return !applied || applied.materialName !== materialName || applied.source !== material || applied.meshes.length !== meshes.length || meshes.some((mi, index)=>applied.meshes[index].instance !== mi || applied.meshes[index].material !== mi.material);
        });
        // Усі ноди вже мають потрібний стан — нічого не перезастосовуємо.
        if (pending.length === 0) return;
        // 6. Призначаємо матеріал лише відібраним нодам через MaterialService.
        // Сервіс також викликає оновлення пов'язаних скриптів, якщо вони є:
        // triPlanarMapping, smartStretch та meshBoolean.
        await MaterialService.applyMaterialByName(materialName, pending);
        // 7. Після завершення виклику сервісу запам'ятовуємо фактичні
        // посилання на meshes і матеріали, зокрема копії від Triplanar.
        // Це локальний кеш стану нод для кроку 5, а не кеш material assets.
        // Якщо applyMaterialByName кине помилку, цей блок не виконається.
        for (const entity of pending){
            this._appliedMaterials.set(entity, {
                materialName,
                source: material,
                meshes: this._meshInstances(entity).map((mi)=>({
                        instance: mi,
                        material: mi.material
                    }))
            });
        }
    }
    destroy() {
        this._appliedMaterials = new WeakMap();
        this._hasAppliedMaterials = false;
        super.destroy();
    }
    constructor(){
        super({
            name: "RuleMaterialsCabinetMako",
            watchAttributes: [
                "CabinetColor",
                "HandleColor",
                "LegColor"
            ],
            priority: 50
        });
        this.materialTargets = {
            cabinet: [
                "CLMa_Cabinet_Walls",
                "CLMa_Cabinet_Floor",
                "Mako_Top_Drawer_Wall",
                "Mako_Bot_Drawer_Wall",
                "Mako_Cabinet_HBracket"
            ],
            handle: [
                "Mako_Top_Handle_G57",
                "Mako_Bot_Handle_G57",
                "Mako_Top_Handle_BaseG50",
                "Mako_Bot_Handle_Base"
            ],
            leg: [
                "Mako_Cabinet_M_Legs"
            ],
            stones: [
                "Mako_Top_Handle_StonesG50",
                "Mako_Bot_Handle_StonesG50"
            ],
            metal: [
                "Mako_Top_DrawerHinge",
                "Mako_Bot_DrawerHinge"
            ],
            drawer: [
                "Mako_Top_DrawerWalls",
                "Mako_Top_DrawerPlumFraming",
                "Mako_Bot_DrawerWalls",
                "Mako_Bot_DrawerFramingDD"
            ],
            boolean: [
                "Mako_Cabinet_SBBoolBox"
            ]
        };
        this.fixedMaterials = {
            stones: "GlasStonesMat",
            metal: "SimpleMetalMat",
            drawer: "Antracite Matte OCF",
            boolean: "BoolMat"
        };
        this._appliedMaterials = new WeakMap();
        this._hasAppliedMaterials = false;
    }
}

export { RuleMaterialsCabinetMako };
