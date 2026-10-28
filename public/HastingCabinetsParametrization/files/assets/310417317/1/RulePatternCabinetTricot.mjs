import { BaseProductRule } from '../base-product-rule.mjs';
import { SceneEntityHelper } from '../../../../helpers/scene-entity-helper.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';

/** Detail texture patterns on Tricot fluted drawer fronts, following Overlay's Triplanar workflow. */
export class RulePatternCabinetTricot extends BaseProductRule {
    constructor() {
        super({ name: 'RulePatternCabinetTricot', watchAttributes: ['CabinetPattern', 'CabinetColor'], priority: 70 });
        this.entityNames = ['Tricot_Top_Drawer_Handle_Flut', 'Tricot_Bot_Drawer_Handle_Flut'];
        this.valuesCabinetPattern = ['Cannette', 'Gessatto', 'Loden', 'Twill', 'Satin'];
        this.dataRule = {
            Cannette: { normal: 'Cannette_Pattern_N_1K.jpg', ao: 'Cannette_Pattern_AO_1K.jpg', tiling: 85, bumpiness: 1, intensity: 1.1 },
            Gessatto: { normal: 'Gessatto_Pattern_N_1K.jpg', ao: 'Gessatto_Pattern_AO_1K.jpg', tiling: 30, bumpiness: 1, intensity: 0.8 },
            Loden: { normal: 'Loden_Pattern_N_1K.jpg', ao: 'Loden_Pattern_AO_1K.jpg', tiling: 36, bumpiness: 1, intensity: 0.3 },
            Twill: { normal: 'Twill_Pattern_N_1K.jpg', ao: 'Twill_Pattern_AO_1K.jpg', tiling: 29, bumpiness: 1, intensity: 0.34 },
            Satin: null,
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
            LoggerService.warn(this, 'Unsupported Tricot cabinet pattern', { pattern });
            return;
        }
        this._applied = false;
        const entities = SceneEntityHelper.collectByNames(this.entity, this.entityNames);
        if (this.entityNames.some(name => !entities.some(entity => entity.name === name)) ||
            entities.some(entity => !entity.script?.triPlanarMapping)) {
            LoggerService.warn(this, 'Tricot pattern entities or triPlanarMapping scripts are not ready');
            return;
        }
        const config = this.dataRule[pattern];
        const textures = config ? await Promise.all([
            this._loadTexture(config.normal), this._loadTexture(config.ao),
        ]) : null;
        for (const entity of entities) this._applyConfig(entity.script.triPlanarMapping, config, textures);
        this._applied = true;
    }

    _applyConfig(script, config, textures) {
        if (!this._defaults.has(script)) {
            this._defaults.set(script, {
                detailNormalMap: script.detailNormalMap, aoMap: script.aoMap,
                detailTiling: script.detailTiling, detailBumpiness: script.detailBumpiness, aoIntensity: script.aoIntensity,
                surfaceGradientNormals: script.surfaceGradientNormals ?? false,
            });
        }
        const values = config ? {
            detailNormalMap: textures[0], aoMap: textures[1], detailTiling: config.tiling,
            detailBumpiness: config.bumpiness, aoIntensity: config.intensity,
            surfaceGradientNormals: true,
        } : this._defaults.get(script);
        // Keep pattern parameters isolated from other entities sharing the color material.
        script.makeUnique = true;
        Object.assign(script, values);
        script.refreshMaterials();
    }

    _loadTexture(name) {
        const app = this.context.app;
        const asset = app?.assets.find(name, 'texture');
        if (!asset) return Promise.reject(new Error(`Tricot pattern texture asset not found: ${name}`));
        if (asset.resource) return Promise.resolve(asset);
        return new Promise((resolve, reject) => {
            const ready = () => {
                asset.off('error', failed);
                asset.resource ? resolve(asset) : reject(new Error(`Tricot pattern texture has no resource: ${name}`));
            };
            const failed = error => { asset.off('load', ready); reject(new Error(`Tricot texture load failed: ${name}: ${error}`)); };
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
