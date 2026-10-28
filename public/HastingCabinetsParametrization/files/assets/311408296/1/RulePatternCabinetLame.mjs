import { BaseProductRule } from '../base-product-rule.mjs';
import { SceneEntityHelper } from '../../../../helpers/scene-entity-helper.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';

/** Detail texture patterns on Lame fluted drawer fronts, following Overlay's Triplanar workflow. */
export class RulePatternCabinetLame extends BaseProductRule {
    constructor() {
        super({ name: 'RulePatternCabinetLame', watchAttributes: ['CabinetPattern', 'CabinetColor'], priority: 70 });
        this.entityNames = ['Lame_Top_Drawer_Flut', 'Lame_Bot_Drawer_Flut', 'Lame_SidePanel_Flut'];
        this.valuesCabinetPattern = ['Galles', 'Gessatto', 'Oxford', 'Piquet', 'Plisse'];
        this.dataRule = {
            Galles: { normal: 'Galles_Pattern_N_1K.jpg', ao: 'Galles_Pattern_AO_1K', tiling: 32, tilingV: 32, bumpiness: 1.2, intensity: 1.2 },
            Gessatto: { normal: 'Gessatto_Pattern_N_1K.jpg', ao: 'Gessatto_Pattern_AO_1K.jpg', tiling: 60, tilingV: 60, bumpiness: 1, intensity: 1 },
            Oxford: { normal: 'Oxford_Pattern_N_1K.jpg', ao: 'Oxford_Pattern_AO_1K.jpg', tiling: 30, tilingV: 18, bumpiness: 1, intensity: 1 },
            Piquet: { normal: 'Piquet_Pattern_N_1K.jpg', ao: 'Piquet_Pattern_AO_1K.jpg', tiling: 32, tilingV: 20, bumpiness: 1, intensity: 1 },
            Plisse: { normal: 'Plisse_Pattern_N_1K.jpg', ao: 'Plisse_Pattern_AO_1K.jpg', tiling: 240, tilingV: 240, bumpiness: 0.9, intensity: 1 },
        };
        this._defaults = new WeakMap();
        this._applied = false;
    }

    shouldExecute(changes, currentState, previousState) {
        return this.enabled && (!this._applied || super.shouldExecute(changes, currentState, previousState));
    }

    async execute({ currentState }) {
        const pattern = currentState.get('CabinetPattern');
        if (!this.valuesCabinetPattern.includes(pattern)) {
            LoggerService.warn(this, 'Unsupported Lame cabinet pattern', { pattern });
            return;
        }
        this._applied = false;
        if (!this.context || this.entity?._destroyed) return;
        const entities = SceneEntityHelper.collectByNames(this.entity, this.entityNames);
        // The side panel is an optional separate asset, not part of every cabinet.
        // An absent or unready target must not block the ready drawer fronts.
        const requiredNames = ['Lame_Top_Drawer_Flut', 'Lame_Bot_Drawer_Flut'];
        const ready = entities.filter(entity => {
            if (entity.script?.triPlanarMapping) return true;
            LoggerService.warn(this, 'Lame pattern triPlanarMapping is not ready', { entityName: entity.name });
            return false;
        });
        const missingRequired = requiredNames.filter(name => !ready.some(entity => entity.name === name));
        if (missingRequired.length) {
            LoggerService.warn(this, 'Lame pattern drawer targets are not ready', { entityNames: missingRequired });
        }
        if (!ready.length) return;
        const config = this.dataRule[pattern];
        const textures = config ? await Promise.all([
            this._loadTexture(config.normal), this._loadTexture(config.ao),
        ]) : null;
        for (const entity of ready) this._applyConfig(entity.script.triPlanarMapping, config, textures);
        this._applied = missingRequired.length === 0 && ready.length === entities.length;
    }

    _applyConfig(script, config, textures) {
        if (!this._defaults.has(script)) {
            this._defaults.set(script, {
                detailNormalMap: script.detailNormalMap, aoMap: script.aoMap,
                detailTiling: script.detailTiling, detailTilingV: script.detailTilingV, detailBumpiness: script.detailBumpiness, aoIntensity: script.aoIntensity,
                surfaceGradientNormals: script.surfaceGradientNormals ?? false,
            });
        }
        const values = config ? {
            detailNormalMap: textures[0], aoMap: textures[1], detailTiling: config.tiling, detailTilingV: config.tilingV,
            detailBumpiness: config.bumpiness, aoIntensity: config.intensity,
            surfaceGradientNormals: true,
            // LAME ONLY: isolate pattern Normal/AO from CabinetColor UV settings.
            lamePattern: true,
        } : this._defaults.get(script);
        // Keep pattern parameters isolated from other entities sharing the color material.
        script.makeUnique = true;
        Object.assign(script, values);
        script.refreshMaterials();
    }

    _loadTexture(name) {
        const app = this.context.app;
        const asset = app?.assets.find(name, 'texture')
            || (name === 'Galles_Pattern_AO_1K' ? app?.assets.find(name + '.jpg', 'texture') : null);
        if (!asset) return Promise.reject(new Error(`Lame pattern texture asset not found: ${name}`));
        if (asset.resource) return Promise.resolve(asset);
        return new Promise((resolve, reject) => {
            const ready = () => {
                asset.off('error', failed);
                asset.resource ? resolve(asset) : reject(new Error(`Lame pattern texture has no resource: ${name}`));
            };
            const failed = error => { asset.off('load', ready); reject(new Error(`Lame texture load failed: ${name}: ${error}`)); };
            asset.once('load', ready);
            asset.once('error', failed);
            app.assets.load(asset);
        });
    }

    destroy() {
        this._defaults = new WeakMap();
        this._applied = false;
        super.destroy();
    }
}
