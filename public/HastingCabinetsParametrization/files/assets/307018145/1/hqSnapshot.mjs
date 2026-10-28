import { Script } from 'playcanvas';
import { HQSnapshotService } from './app-configuration/services/snapshot/index.mjs';

/**
 * PlayCanvas script wrapper for the high-quality snapshot service.
 *
 * Attach to an entity with a camera component when you want editable presets in
 * the PlayCanvas Inspector. The ConfiguratorAPI fallback works without this
 * script, so this does not replace the existing canvas snapshot API.
 */
export class HqSnapshot extends Script {
  static scriptName = 'hqSnapshot';
  supportsCurrentView = true;

  /**
   * @attribute
   * @type {object[]}
   */
  presets = [
    { name: 'hero', out: 4096, format: 'image/png', quality: 1.0, bg: '#ffffff', cameraFrame: true, ssao: true, ssaoSamples: 48 },
    { name: 'page', out: 2048, format: 'image/jpeg', quality: 0.9, bg: '#ffffff', cameraFrame: true, ssao: true, ssaoSamples: 32 },
    { name: 'thumb', out: 1024, format: 'image/jpeg', quality: 0.85, bg: '#ffffff', cameraFrame: false, ssao: false, ssaoSamples: 0 }
  ];

  /**
   * @attribute
   * @range [0, 360]
   */
  azimuth = 35;

  /**
   * @attribute
   * @range [0, 89]
   */
  elevation = 25;

  /**
   * @attribute
   * @range [1.0, 2.0]
   */
  margin = 1.12;

  /**
   * @attribute
   * @range [0, 1]
   */
  sharpness = 0.25;

  /**
   * @attribute
   * @range [0, 4]
   */
  superSample = 0;

  /**
   * @attribute
   * @type {string[]}
   */
  aabbExclude = [];

  initialize() {
    this._service = new HQSnapshotService(this.app, this._config());
  }

  /**
   * @param {string|object} presetOrOptions
   * @returns {Promise<{blob: Blob, width: number, height: number, format: string, dataUrl: string}>}
   */
  async capture(presetOrOptions = 'page') {
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
}
