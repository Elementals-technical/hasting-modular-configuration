import * as playcanvasStable_min from '../../playcanvas-stable.min.mjs';
import { Script, app, Texture, FILTER_NEAREST, PIXELFORMAT_R8_G8_B8_A8 } from '../../playcanvas-stable.min.mjs';
import triplanarDiffuseChunk from './chunks/TriplanarDiffuse.mjs';
import triplanarNormalChunk from './chunks/TriplanarNormal.mjs';
import triplanarGlossChunk from './chunks/TriplanarGloss.mjs';

function _define_property(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else {
        obj[key] = value;
    }
    return obj;
}
class TriPlanarMapping extends Script {
    // === DEBUG: де в triplanar-скриптах яке значення Use Material Tiling ===
    // Виклик з консолі: TriPlanarMapping.dumpUseMaterialScale()
    // Показує всі entity з triPlanarMapping і їхній useMaterialScale (ON-и окремо).
    static dumpUseMaterialScale() {
        if (typeof playcanvasStable_min === "undefined" || !app) {
            console.warn("[TriPlanar] pc.app недоступний");
            return [];
        }
        const rows = [];
        const walk = (e)=>{
            const t = e.script && e.script.triPlanarMapping;
            if (t) {
                const mi = e.render && e.render.meshInstances && e.render.meshInstances[0] || e.model && e.model.meshInstances && e.model.meshInstances[0] || null;
                rows.push({
                    entity: e.name,
                    enabled: e.enabled,
                    useMaterialScale: !!t.useMaterialScale,
                    size: t.textureSize,
                    material: mi && mi.material ? mi.material.name : null,
                    tilingX: mi && mi.material && mi.material.diffuseMapTiling ? mi.material.diffuseMapTiling.x : null
                });
            }
            e.children.forEach(walk);
        };
        walk(app.root);
        const on = rows.filter((r)=>r.useMaterialScale);
        console.log(`[TriPlanar] ${rows.length} triplanar entity | Use Material Tiling = ON у ${on.length}`);
        if (console.table) console.table(rows);
        if (on.length && console.table) {
            console.warn(`[TriPlanar] ON у цих ${on.length}:`);
            console.table(on);
        }
        if (typeof window !== "undefined") window.__triUMS = rows;
        return rows;
    }
    static _watchEnabled() {
        if (TriPlanarMapping.DEBUG_WATCH) return true;
        if (typeof window === "undefined") return false;
        if (window.__TRIPLANAR_WATCH__ === true) return true;
        const host = window.location && window.location.hostname || ""; // hostname → без порта
        return /launch\.playcanvas\.com/.test(host);
    }
    initialize() {
        if (!triplanarDiffuseChunk?.length) {
            console.error("TriPlanarMapping: Diffuse Chunk is missing!");
            return;
        }
        this._initialized = true;
        // DEBUG: доступ до класу з консолі (TriPlanarMapping.dumpUseMaterialScale())
        if (typeof window !== "undefined") window.TriPlanarMapping = TriPlanarMapping;
        this.activeMaterials = [];
        this.applyTriplanar();
        this.on('attr', ()=>this.updateUniforms());
        this.on('attr:aoMap', ()=>this.applyTriplanar());
        this.on('attr:detailNormalMap', ()=>this.applyTriplanar());
        if (this.activeMaterials.length === 0) this.ensureModelReady();
    }
    // --- GETTERS & SETTERS ---
    /** @attribute
   * @title Use Material Tiling
   * @type {boolean}
   * @default false
   * */ // ON  → масштаб береться з Texture Transform → Tiling матеріалу (diffuseMapTiling).
    // OFF → масштаб береться зі слайдера Size (Meters), tiling матеріалу ігнорується.
    get useMaterialScale() {
        return this._useMaterialScale;
    }
    set useMaterialScale(value) {
        this._useMaterialScale = value;
        this.updateUniforms();
    }
    /** @attribute
   * @title Size (Meters)
   * @range [0.01, 100.0]
   * @default 0.5
   * */ get textureSize() {
        return this._textureSize;
    }
    set textureSize(value) {
        this._textureSize = value;
        this.updateUniforms();
    }
    /** @attribute
   * @title Rotation (Degrees)
   * @range [-360.0, 360.0]
   * */ get rotationAngle() {
        return this._rotationAngle;
    }
    set rotationAngle(value) {
        this._rotationAngle = value;
        this.updateUniforms();
    }
    /** @attribute
   * @title Make Unique
   * @type {boolean}
   * */ get makeUnique() {
        return this._makeUnique;
    }
    set makeUnique(value) {
        this._makeUnique = value;
        // Attribute assignment before initialize() (template instancing, entity.clone()): only
        // record the value; initialize() applies it once the entity is in the scene. See _initialized.
        if (!this._initialized) return;
        this.applyTriplanar();
    }
    /** @attribute
   * @title Override Mat Params
   * @type {boolean}
   * */ get overrideParams() {
        return this._overrideParams;
    }
    set overrideParams(value) {
        this._overrideParams = value;
        this.updateUniforms();
    }
    /** @attribute
   * @title Glossiness
   * @range [0, 100]
   * */ get glossiness() {
        return this._glossiness;
    }
    set glossiness(value) {
        this._glossiness = value;
        if (this._overrideParams) this.updateUniforms();
    }
    /** @attribute
   * @title Bumpiness
   * @range [0, 2]
   * */ get bumpiness() {
        return this._bumpiness;
    }
    set bumpiness(value) {
        this._bumpiness = value;
        if (this._overrideParams) this.updateUniforms();
    }
    // === GRAIN DIRECTION API ===
    /**
   * Set grain direction mode and strip width.
   * @param {number} mode - 0=None, 1=FlipU (horizontal grain), 2=FlipV (vertical grain)
   * @param {number} [stripWidth] - strip width in UV space
   * @param {string} [target] - ім'я матеріалу для індивідуального налаштування.
   *                            Без target застосовується глобально до всього entity.
   */ setGrainDirection(mode, stripWidth, target) {
        const width = stripWidth !== undefined ? stripWidth : this._grainStripWidth;
        if (target) {
            this._grainOverrides.set(target, {
                mode,
                stripWidth: width
            });
        } else {
            this._grainMode = mode;
            this._grainStripWidth = width;
        }
        this.updateUniforms();
    }
    /** Get current grain mode (0, 1, or 2). З target — повертає mode конкретного матеріалу. */ getGrainMode(target) {
        if (target && this._grainOverrides.has(target)) {
            return this._grainOverrides.get(target).mode;
        }
        return this._grainMode;
    }
    /** Resolve per-material grain: override по імені матеріалу, інакше глобальний default. */ _resolveGrain(material) {
        if (this._grainOverrides.size) {
            const base = material.name.replace('_triplanar_unique', '');
            const o = this._grainOverrides.get(material.name) || this._grainOverrides.get(base);
            if (o) return o;
        }
        return {
            mode: this._grainMode,
            stripWidth: this._grainStripWidth
        };
    }
    ensureModelReady() {
        const onLoaded = ()=>this.applyTriplanar();
        if (this.entity.model && !this.entity.model.model) {
            this.entity.model.on("model:loaded", onLoaded, this);
        }
        if (this.entity.render && this.entity.render.asset) {
            const asset = this.app.assets.get(this.entity.render.asset);
            if (asset && !asset.loaded) asset.once("load", onLoaded);
        }
    }
    get dummyWhite() {
        if (!this._dummyWhite) {
            const device = this.app.graphicsDevice;
            this._dummyWhite = new Texture(device, {
                width: 1,
                height: 1,
                format: PIXELFORMAT_R8_G8_B8_A8,
                minFilter: FILTER_NEAREST,
                magFilter: FILTER_NEAREST
            });
            const pixels = this._dummyWhite.lock();
            pixels.set([
                255,
                255,
                255,
                255
            ]); // Белый
            this._dummyWhite.unlock();
        }
        return this._dummyWhite;
    }
    get dummyNormal() {
        if (!this._dummyNormal) {
            const device = this.app.graphicsDevice;
            this._dummyNormal = new Texture(device, {
                width: 1,
                height: 1,
                format: PIXELFORMAT_R8_G8_B8_A8,
                minFilter: FILTER_NEAREST,
                magFilter: FILTER_NEAREST
            });
            const pixels = this._dummyNormal.lock();
            pixels.set([
                128,
                128,
                255,
                255
            ]); // Сиреневый (Нормаль вверх)
            this._dummyNormal.unlock();
        }
        return this._dummyNormal;
    }
    update(dt) {
        // Лише в дебаг/редакторі: зміна diffuseMapTiling / diffuseMapRotation НА МАТЕРІАЛІ
        // не кидає події в скрипт. Тут щокадрово звіряємо ефективні значення з тим, що вже
        // на меші, і переписуємо лише при реальній зміні (дешево — кілька float-порівнянь).
        if (!TriPlanarMapping._watchEnabled()) return;
        const meshes = this.activeMeshInstances;
        if (!meshes || meshes.length === 0) return;
        for (const mesh of meshes){
            const m = mesh.material;
            if (!m) continue;
            const size = this._effectiveScale(m);
            const rad = this._effectiveRotationRad(m);
            const p = mesh.parameters;
            const curS = p && p.tri_scale ? p.tri_scale.data : undefined;
            const curR = p && p.tri_rotation ? p.tri_rotation.data : undefined;
            if (curS !== size) mesh.setParameter("tri_scale", size);
            if (curR !== rad) mesh.setParameter("tri_rotation", rad);
        }
    }
    refreshMaterials() {
        this.applyTriplanar();
    }
    // Збір усіх mesh instances entity (render + model).
    _collectMeshInstances() {
        const out = [];
        const renders = this.entity.findComponents("render");
        renders.forEach((c)=>{
            if (c.meshInstances) out.push(...c.meshInstances);
        });
        const models = this.entity.findComponents("model");
        models.forEach((c)=>{
            if (c.model && c.model.meshInstances) out.push(...c.model.meshInstances);
        });
        return out;
    }
    applyTriplanar() {
        this.activeMaterials = [];
        this.activeMeshInstances = [];
        const meshInstancesToUpdate = this._collectMeshInstances();
        if (meshInstancesToUpdate.length === 0) return;
        const materialCache = new Map();
        for (const mesh of meshInstancesToUpdate){
            let sourceMat = this.mat && this.mat.resource ? this.mat.resource : mesh.material;
            if (!sourceMat) continue;
            let finalMat;
            if (this.makeUnique) {
                if (materialCache.has(sourceMat.id)) {
                    finalMat = materialCache.get(sourceMat.id);
                } else {
                    // === LAME ONLY: a name suffix does not prove material ownership.
                    // Template clones can share an already named _triplanar_unique material.
                    // Each pattern script must own its instance so another cabinet/script
                    // cannot overwrite its textures and pattern uniforms on refresh.
                    if (this.lamePattern) {
                        if (this._lameOwnedMaterials.has(sourceMat)) {
                            finalMat = sourceMat;
                        } else {
                            finalMat = this._lameMaterialClones.get(sourceMat);
                            if (!finalMat) {
                                finalMat = sourceMat.clone();
                                finalMat.name = sourceMat.name.includes('_triplanar_unique') ? sourceMat.name : sourceMat.name + '_triplanar_unique';
                                this._lameOwnedMaterials.add(finalMat);
                                this._lameMaterialClones.set(sourceMat, finalMat);
                            }
                        }
                    // === END LAME ONLY; original behavior for other collections ===
                    } else if (sourceMat.name.includes("_triplanar_unique")) {
                        finalMat = sourceMat;
                    } else {
                        finalMat = sourceMat.clone();
                        finalMat.name = sourceMat.name + "_triplanar_unique";
                    }
                    materialCache.set(sourceMat.id, finalMat);
                }
                mesh.material = finalMat;
            } else {
                finalMat = sourceMat;
            }
            this.setupMaterial(finalMat);
            if (!this.activeMaterials.includes(finalMat)) this.activeMaterials.push(finalMat);
            // per-mesh: зберігаємо сам mesh instance для meshInstance.setParameter
            if (!this.activeMeshInstances.includes(mesh)) this.activeMeshInstances.push(mesh);
        }
        this.updateUniforms();
    }
    setupMaterial(material) {
        {
            material.chunks.diffusePS = triplanarDiffuseChunk;
        }
        {
            material.chunks.normalMapPS = triplanarNormalChunk;
        }
        {
            material.chunks.glossPS = triplanarGlossChunk;
        }
        let textureResource = null;
        if (this.texture_0 && this.texture_0.resource) textureResource = this.texture_0.resource;
        else if (material.diffuseMap) textureResource = material.diffuseMap;
        let hasDiffuse = 0.0;
        if (textureResource) {
            material.setParameter("tri_diffuseTex", textureResource);
            hasDiffuse = 1.0;
        } else {
            material.setParameter("tri_diffuseTex", this.dummyWhite);
            hasDiffuse = 0.0;
        }
        material.setParameter("tri_hasDiffuse", hasDiffuse);
        {
            let nMap = material.normalMap ? material.normalMap : this.dummyNormal;
            material.setParameter("tri_normalTex", nMap);
        }
        {
            let glossMap = material.glossMap || material.metalnessMap || this.dummyWhite;
            material.setParameter("tri_glossTex", glossMap);
        }
        if (this.aoMap && this.aoMap.resource) {
            material.setParameter("tri_aoTex", this.aoMap.resource);
            material.setParameter("tri_hasAO", 1.0);
        } else {
            material.setParameter("tri_aoTex", this.dummyWhite);
            material.setParameter("tri_hasAO", 0.0);
        }
        if (this.detailNormalMap && this.detailNormalMap.resource) {
            material.setParameter("tri_detailNormalTex", this.detailNormalMap.resource);
            material.setParameter("tri_hasDetailNormal", 1.0);
        } else {
            material.setParameter("tri_detailNormalTex", this.dummyNormal);
            material.setParameter("tri_hasDetailNormal", 0.0);
        }
        if (!this._overrideParams) {
            if (material.gloss !== undefined) this._glossiness = material.gloss * 100.0;
            if (material.bumpiness !== undefined) this._bumpiness = material.bumpiness;
        }
        material.update();
    }
    updateUniforms() {
        // 1) Матеріальний рівень: gloss/bumpiness/detail/has-флаги/текстури (спільне для матеріалу)
        if (this.activeMaterials) {
            for (const mat of this.activeMaterials){
                this.updateMaterialUniforms(mat);
                mat.update();
            }
        }
        // 2) Per-mesh рівень: tri_scale/tri_rotation/grain_* — на кожен mesh instance окремо.
        //    Перебиває параметр матеріалу, тож меші, що ділять матеріал, НЕ десинхронізуються.
        //    mat.update() тут не потрібен.
        if (this.activeMeshInstances) {
            for (const mesh of this.activeMeshInstances){
                this.updateMeshInstanceUniforms(mesh);
            }
        }
    }
    // === MATERIAL-LEVEL uniforms ===
    // Тільки те, що логічно належить матеріалу: gloss/bumpiness/detail/has-флаги.
    // scale/rotation/grain перенесено на mesh instance (див. updateMeshInstanceUniforms).
    updateMaterialUniforms(material) {
        if (this._overrideParams) {
            material.setParameter("tri_bumpiness", this._bumpiness);
            material.setParameter("tri_glossiness", this._glossiness / 100.0);
            material.setParameter("tri_glossInvert", 0.0);
        } else {
            if (material.bumpiness !== undefined) material.setParameter("tri_bumpiness", material.bumpiness);
            if (material.gloss !== undefined) material.setParameter("tri_glossiness", material.gloss);
            const invertVal = material.glossInvert ? 1.0 : 0.0;
            material.setParameter("tri_glossInvert", invertVal);
        }
        material.setParameter("tri_detailTiling", this.detailTiling);
        // === LAME ONLY: keep sampler bindings in sync with the flags below.
        // Material clones/asset reloads can leave a stale dummy or previous texture.
        // setupMaterial alone is insufficient: later updateUniforms calls must bind
        // the current resources as well as tri_hasDetailNormal / tri_hasAO.
        if (this.lamePattern) {
            material.setParameter("tri_detailNormalTex", this.detailNormalMap?.resource || this.dummyNormal);
            material.setParameter("tri_aoTex", this.aoMap?.resource || this.dummyWhite);
        }
        // === END LAME ONLY ===
        // === LAME ONLY: independent pattern density in object-aligned metres ===
        material.setParameter("tri_lamePattern", this.lamePattern ? 1.0 : 0.0);
        material.setParameter("tri_lamePatternTiling", [
            this.detailTiling,
            this.detailTilingV > 0 ? this.detailTilingV : this.detailTiling
        ]);
        // === END LAME ONLY ===
        material.setParameter("tri_aoIntensity", this.aoIntensity);
        material.setParameter("tri_detailBumpiness", this.detailBumpiness);
        material.setParameter("tri_surfaceGradientNormals", this.surfaceGradientNormals ? 1.0 : 0.0);
        const hasAO = this.aoMap && this.aoMap.resource ? 1.0 : 0.0;
        const hasDetailNormal = this.detailNormalMap && this.detailNormalMap.resource ? 1.0 : 0.0;
        material.setParameter("tri_hasAO", hasAO);
        material.setParameter("tri_hasDetailNormal", hasDetailNormal);
    }
    // Ефективний масштаб для матеріалу:
    //   useMaterialScale ON  → з material.diffuseMapTiling.x (per-material)
    //   useMaterialScale OFF → зі слайдера Size (Meters), tiling ігнорується
    // Ефективний масштаб для triplanar.
    //
    // Важлива legacy-сумісність:
    // До появи useMaterialScale матеріали з diffuseMapTiling.x === 1 не трактувались
    // як явно заданий triplanar scale. Старий код вважав 1 дефолтним значенням
    // PlayCanvas material tiling і залишав fallback зі скрипта: textureSize = 0.5.
    //
    // Після ввімкнення useMaterialScale ми почали читати material tiling буквально:
    //   tri_scale = 1 / diffuseMapTiling.x
    //
    // Для legacy-матеріалів з tiling.x === 1 це змінило scale:
    //   було: tri_scale = 0.5
    //   стало: tri_scale = 1 / 1 = 1
    //
    // Shader рахує UV як:
    //   uv = localPos / tri_scale
    //
    // Тому перехід 0.5 -> 1 дав у 2 рази менше повторів текстури,
    // і старі матеріали візуально стали у 2 рази більшими.
    //
    // Поки всі старі матеріали не будуть промігрені в реальні material tiling values,
    // tiling.x === 1 для useMaterialScale лишаємо legacy fallback-ом на textureSize.
    // Після міграції матеріалів це можна буде прибрати, а матеріали, які мають
    // виглядати як старий textureSize 0.5, повинні мати diffuseMapTiling.x = 2.
    _effectiveScale(material) {
        let size = this.textureSize;
        if (this._useMaterialScale) {
            const tiling = material?.diffuseMapTiling;
            const tilingX = tiling && tiling.x > 0 ? tiling.x : 1.0;
            const legacyDefaultTiling = Math.abs(tilingX - 1.0) < 0.0001;
            if (legacyDefaultTiling) {
                // Legacy material: tiling 1 used to mean "not configured",
                // so keep the old script-level scale instead of treating it as scale 1.
                size = this.textureSize;
            } else {
                // New material behavior: material tiling is the source of truth.
                // Tiling 2 -> tri_scale 0.5, Tiling 4 -> tri_scale 0.25, etc.
                size = 1.0 / tilingX;
            }
        }
        return size < 0.001 ? 1.0 : size;
    }
    // Ефективний поворот (рад): кут скрипта + власний diffuseMapRotation матеріалу
    _effectiveRotationRad(material) {
        let deg = this.rotationAngle;
        if (typeof material.diffuseMapRotation === "number") deg += material.diffuseMapRotation;
        return deg * (Math.PI / 180.0);
    }
    // === PER-MESH-INSTANCE uniforms ===
    // tri_scale / tri_rotation / grain_* — на КОЖЕН mesh instance окремо.
    // Перебиває однойменний параметр матеріалу → меші, що ділять матеріал, більше НЕ
    // десинхронізуються (фікс кореня bleed для tri_rotation/tri_scale на спільних клонах).
    updateMeshInstanceUniforms(mesh) {
        if (!mesh || !mesh.material) return;
        const material = mesh.material;
        const grain = this._resolveGrain(material);
        mesh.setParameter("tri_scale", this._effectiveScale(material));
        mesh.setParameter("tri_rotation", this._effectiveRotationRad(material));
        mesh.setParameter("grain_mode", grain.mode);
        mesh.setParameter("grain_stripWidth", grain.stripWidth);
    }
    constructor(...args){
        super(...args), // --- OVERRIDES ---
        /** @attribute
   * @type {Asset}
   * @resource material
   * @title Override Material
   * */ _define_property(this, "mat", void 0), /** @attribute
   * @type {Asset}
   * @resource texture
   * @title Override Texture
   * */ _define_property(this, "texture_0", void 0), // --- DETAIL SETTINGS ---
        /** @attribute
   * @type {Asset}
   * @resource texture
   * @title Detail AO Map
   * */ _define_property(this, "aoMap", void 0), /** @attribute
   * @type {Asset}
   * @resource texture
   * @title Detail Normal Map
   * */ _define_property(this, "detailNormalMap", void 0), /** @attribute
   * @title Detail Tiling
   * @default 1.0
   * */ _define_property(this, "detailTiling", 1.0), // === LAME ONLY: independent Normal/AO pattern coordinates ===
        // Opt-in is set by RulePatternCabinetLame; existing collections stay disabled.
        _define_property(this, "lamePattern", false), _define_property(this, "_lameOwnedMaterials", new WeakSet()), _define_property(this, "_lameMaterialClones", new WeakMap()), _define_property(this, "detailTilingV", 0), // === END LAME ONLY ===
        /** @attribute
   * @title AO Intensity
   * @range [0, 2]
   * @default 1.0
   * */ _define_property(this, "aoIntensity", 1.0), /** @attribute
   * @title Detail Bumpiness
   * @range [0, 2]
   * @default 1.0
   * */ _define_property(this, "detailBumpiness", 1.0), /** @attribute
   * @title Surface Gradient Normals
   * @type {boolean}
   * @default false
   */ _define_property(this, "surfaceGradientNormals", false), // --- INTERNAL STATE ---
        _define_property(this, "_textureSize", 0.5), _define_property(this, "_rotationAngle", 0.0), _define_property(this, "_makeUnique", true), _define_property(this, "_useMaterialScale", false) // true: масштаб із material.diffuseMapTiling; false: зі слайдера Size (Meters)
        , _define_property(this, "_overrideParams", false), _define_property(this, "_glossiness", 100.0), _define_property(this, "_bumpiness", 1.0), _define_property(this, "_dummyWhite", null), _define_property(this, "_dummyNormal", null), // Set by initialize(). Until then the entity is outside the scene, e.g. a clone that
        // PositionBuilder makes only to measure a layout. Such a clone shares the mesh materials of
        // the cabinet it was cloned from (named "_triplanar_unique", so applyTriplanar reuses them),
        // and its attributes are the authored defaults, without the pattern a rule set at runtime.
        // Writing them would wipe that cabinet's pattern, so nothing touches materials before this.
        _define_property(this, "_initialized", false), _define_property(this, "activeMaterials", []), _define_property(this, "activeMeshInstances", []) // per-mesh: tri_scale/tri_rotation/grain_* ставляться через meshInstance.setParameter
        , // --- GRAIN DIRECTION STATE ---
        _define_property(this, "_grainMode", 0.0) // 0=None, 1=FlipU, 2=FlipV (глобальний default для entity)
        , _define_property(this, "_grainStripWidth", 0.15) // strip width in UV space
        , _define_property(this, "_grainOverrides", new Map()) // per-material grain: materialName -> { mode, stripWidth }
        ;
    }
}
_define_property(TriPlanarMapping, "scriptName", "triPlanarMapping");
// Realtime-watcher (update) потрібен лише при налагодженні — щоб бачити зміни
// diffuseMapTiling/diffuseMapRotation матеріалу наживо. У продакшені tiling
// матеріалу в рантаймі не змінюється, тож щокадрова перевірка вимкнена.
// Вмикається: в редакторі (launch.playcanvas.com) або вручну
//   window.__TRIPLANAR_WATCH__ = true   /   TriPlanarMapping.DEBUG_WATCH = true
_define_property(TriPlanarMapping, "DEBUG_WATCH", false);

export { TriPlanarMapping };
