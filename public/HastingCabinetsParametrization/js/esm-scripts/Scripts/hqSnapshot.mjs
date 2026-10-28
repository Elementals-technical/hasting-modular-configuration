import { Script } from '../../playcanvas-stable.min.mjs';
import { HQSnapshotService } from './app-configuration/services/snapshot/hq-snapshot-service.mjs';
import './app-configuration/services/snapshot/snapshot-memory-policy.mjs';

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
/**
 * PlayCanvas script wrapper for the high-quality snapshot service.
 *
 * Attach to an entity with a camera component when you want editable presets in
 * the PlayCanvas Inspector. The ConfiguratorAPI fallback works without this
 * script, so this does not replace the existing canvas snapshot API.
 */ class HqSnapshot extends Script {
    initialize() {
        this._service = new HQSnapshotService(this.app, this._config());
    }
    /**
   * @param {string|object} presetOrOptions
   * @returns {Promise<{blob: Blob, width: number, height: number, format: string, dataUrl: string}>}
   */ async capture(presetOrOptions = 'page') {
        this._syncService();
        return this._service.capture(presetOrOptions, {
            cameraEntity: this.entity,
            preferAttachedScript: false
        });
    }
    getMemoryPlan(presetOrOptions = 'page') {
        this._syncService();
        return this._service.getMemoryPlan(presetOrOptions, {
            cameraEntity: this.entity,
            preferAttachedScript: false
        });
    }
    getPresets() {
        this._syncService();
        return this._service.getPresets();
    }
    _syncService() {
        if (!this._service) {
            this._service = new HQSnapshotService(this.app, this._config());
            return;
        }
        this._service.configure(this._config());
    }
    _config() {
        return {
            cameraEntity: this.entity,
            presets: this.presets,
            azimuth: this.azimuth,
            elevation: this.elevation,
            margin: this.margin,
            sharpness: this.sharpness,
            superSample: this.superSample,
            aabbExclude: this.aabbExclude
        };
    }
    constructor(...args){
        super(...args), _define_property(this, "supportsCurrentView", true), /**
   * @attribute
   * @type {object[]}
   */ _define_property(this, "presets", [
            {
                name: 'hero',
                out: 4096,
                format: 'image/png',
                quality: 1.0,
                bg: '#ffffff',
                cameraFrame: true,
                ssao: true,
                ssaoSamples: 48
            },
            {
                name: 'page',
                out: 2048,
                format: 'image/jpeg',
                quality: 0.9,
                bg: '#ffffff',
                cameraFrame: true,
                ssao: true,
                ssaoSamples: 32
            },
            {
                name: 'thumb',
                out: 1024,
                format: 'image/jpeg',
                quality: 0.85,
                bg: '#ffffff',
                cameraFrame: false,
                ssao: false,
                ssaoSamples: 0
            }
        ]), /**
   * @attribute
   * @range [0, 360]
   */ _define_property(this, "azimuth", 35), /**
   * @attribute
   * @range [0, 89]
   */ _define_property(this, "elevation", 25), /**
   * @attribute
   * @range [1.0, 2.0]
   */ _define_property(this, "margin", 1.12), /**
   * @attribute
   * @range [0, 1]
   */ _define_property(this, "sharpness", 0.25), /**
   * @attribute
   * @range [0, 4]
   */ _define_property(this, "superSample", 0), /**
   * @attribute
   * @type {string[]}
   */ _define_property(this, "aabbExclude", []);
    }
}
_define_property(HqSnapshot, "scriptName", 'hqSnapshot');

export { HqSnapshot };
