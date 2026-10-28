import { LoggerService } from '../../services/logger/logger-service.mjs';
import { HQSnapshotService } from '../../services/snapshot/index.mjs';
import { ROOM_ROOT_NAME } from '../../domain/scene/room/room-offset.mjs';

/**
 * Camera Plugin для ConfiguratorAPI.
 *
 * Інкапсулює всі camera-related методи Bridge API.
 * Методи доступні через ConfiguratorAPI.camera.*
 */
export class CameraPlugin {
  /**
   * @param {{ app: object, bridge: object }} ctx
   * @returns {object} Об'єкт з camera методами для ConfiguratorAPI
   */
  static create(ctx) {
    const { app, bridge } = ctx;

    /** Helper: повертає CameraController або null з логуванням помилки */
    const _ctrl = () => {
      if (!app.cameraController) {
        LoggerService.error(bridge, '[Bridge] CameraController not initialized');
        return null;
      }
      return app.cameraController;
    };

    const _hqSnapshotService = () => {
      if (!app.hqSnapshotService) {
        app.hqSnapshotService = new HQSnapshotService(app);
      }
      return app.hqSnapshotService;
    };

    const _getHQSnapshotPresets = () => _hqSnapshotService().getPresets();
    const _getHQSnapshotMemoryPlan = (presetOrOptions = 'page') => {
      return _hqSnapshotService().getMemoryPlan(presetOrOptions);
    };

    /**
     * Project option `includeRoom: false` → the service's generic `hideEntities`,
     * so callers do not need to know scene entity names.
     * Preset names and options without `includeRoom: false` keep the room as the scene shows it.
     * @example
     *   _withRoomVisibility({ includeRoom: false, bg: null }) // → { bg: null, hideEntities: ['Room1_Point'] }
     *   _withRoomVisibility('page')                           // → 'page'
     */
    const _withRoomVisibility = (presetOrOptions) => {
      // A preset name carries no options: nothing to translate.
      if (!presetOrOptions || typeof presetOrOptions !== 'object') return presetOrOptions;

      const { includeRoom, ...options } = presetOrOptions;
      if (includeRoom !== false) return options;

      const hideEntities = Array.isArray(options.hideEntities) ? options.hideEntities : [];
      return { ...options, hideEntities: [...hideEntities, ROOM_ROOT_NAME] };
    };

    /**
     * Project option `fitToProduct: true` → the service's generic `fitToContent` with the room
     * in `fitExclude`: the camera keeps its angle and moves so the product fills the frame,
     * while the room stays in the picture behind it.
     * @example
     *   _withProductFit({ fitToProduct: true }) // → { fitToContent: true, fitExclude: ['Room1_Point'] }
     */
    const _withProductFit = (presetOrOptions) => {
      if (!presetOrOptions || typeof presetOrOptions !== 'object') return presetOrOptions;

      const { fitToProduct, ...options } = presetOrOptions;
      if (fitToProduct !== true) return options;

      const fitExclude = Array.isArray(options.fitExclude) ? options.fitExclude : [];
      return { ...options, fitToContent: true, fitExclude: [...fitExclude, ROOM_ROOT_NAME] };
    };

    const _captureHQSnapshot = async (presetOrOptions = 'page') => {
      try {
        const result = await _hqSnapshotService().capture(_withProductFit(_withRoomVisibility(presetOrOptions)));
        LoggerService.log(
          bridge,
          `[Bridge] HQ snapshot created (${result.width}x${result.height}, ${result.format})`
        );
        return result;
      } catch (error) {
        LoggerService.error(bridge, '[Bridge] Failed to create HQ snapshot:', error);
        throw error;
      }
    };

    const _hasSnapshotMode = (presetOrOptions) => {
      return presetOrOptions && typeof presetOrOptions === 'object' &&
        (
          Object.prototype.hasOwnProperty.call(presetOrOptions, 'mode') ||
          Object.prototype.hasOwnProperty.call(presetOrOptions, 'view') ||
          Object.prototype.hasOwnProperty.call(presetOrOptions, 'cameraMode')
        );
    };

    const _withSnapshotMode = (presetOrOptions = 'page', mode, force = false) => {
      if (typeof presetOrOptions === 'string') {
        return { preset: presetOrOptions, mode };
      }

      const options = presetOrOptions || {};
      if (!force && _hasSnapshotMode(options)) {
        return { ...options };
      }

      return { ...options, mode };
    };

    const _downloadHQSnapshot = async (presetOrOptions = 'page', filename = null) => {
      try {
        const result = await _captureHQSnapshot(_withSnapshotMode(presetOrOptions, 'current'));
        const finalFilename = filename || `hq-snapshot_${Date.now()}.${HQSnapshotService.extensionForFormat(result.format)}`;
        return CameraPlugin._downloadBlob(result.blob, finalFilename);
      } catch (error) {
        LoggerService.error(bridge, '[Bridge] Failed to download HQ snapshot:', error);
        return false;
      }
    };

    const _withCurrentViewMode = (presetOrOptions = 'page') => {
      return _withSnapshotMode(presetOrOptions, 'current', true);
    };

    const _captureCurrentViewHQSnapshot = async (presetOrOptions = 'page') => {
      return _captureHQSnapshot(_withCurrentViewMode(presetOrOptions));
    };

    const _downloadCurrentViewHQSnapshot = async (presetOrOptions = 'page', filename = null) => {
      return _downloadHQSnapshot(_withCurrentViewMode(presetOrOptions), filename);
    };

    const _downloadFramedHQSnapshot = async (presetOrOptions = 'page', filename = null) => {
      return _downloadHQSnapshot(_withSnapshotMode(presetOrOptions, 'framed', true), filename);
    };

    return {

      // ======================== Zoom ========================

      /**
       * Zoom in (наближення камери)
       * @param {number} [step] - Крок зуму
       * @returns {number|null} Нова відстань камери
       */
      zoomIn: (step) => {
        const ctrl = _ctrl();
        if (!ctrl) return null;

        const newDistance = ctrl.zoomIn(step);
        if (newDistance !== null) {
          LoggerService.log(bridge, `[Bridge] Zoom In - new distance: ${newDistance.toFixed(2)}`);
        }
        return newDistance;
      },

      /**
       * Zoom out (віддалення камери)
       * @param {number} [step] - Крок зуму
       * @returns {number|null} Нова відстань камери
       */
      zoomOut: (step) => {
        const ctrl = _ctrl();
        if (!ctrl) return null;

        const newDistance = ctrl.zoomOut(step);
        if (newDistance !== null) {
          LoggerService.log(bridge, `[Bridge] Zoom Out - new distance: ${newDistance.toFixed(2)}`);
        }
        return newDistance;
      },

      /**
       * Встановити конкретну відстань камери
       * @param {number} distance - Бажана відстань
       * @returns {number|null} Встановлена відстань
       */
      setZoom: (distance) => {
        const ctrl = _ctrl();
        if (!ctrl) return null;

        const newDistance = ctrl.setZoom(distance);
        if (newDistance !== null) {
          LoggerService.log(bridge, `[Bridge] Set Zoom - distance: ${newDistance.toFixed(2)}`);
        }
        return newDistance;
      },

      /**
       * Отримати поточну відстань камери
       * @returns {number|null}
       */
      getZoom: () => _ctrl()?.getZoom() ?? null,

      /**
       * Встановити крок зуму за замовчуванням
       * @param {number} step - Новий крок зуму
       */
      setZoomStep: (step) => {
        const ctrl = _ctrl();
        if (!ctrl) return;

        ctrl.setZoomStep(step);
        LoggerService.log(bridge, `[Bridge] Zoom step set to: ${step}`);
      },

      /**
       * Отримати крок зуму за замовчуванням
       * @returns {number}
       */
      getZoomStep: () => _ctrl()?.getZoomStep() ?? 0.2,

      /**
       * Встановити ліміти зуму камери
       * @param {number} min - Мінімальна відстань
       * @param {number} max - Максимальна відстань
       * @example
       * ConfiguratorAPI.camera.setZoomLimits(0.3, 5.0);
       */
      setZoomLimits: (min, max) => {
        const ctrl = _ctrl();
        if (!ctrl) return;

        ctrl.setZoomLimits(min, max);
      },

      // ======================== Camera Info & Position ========================

      /**
       * Отримати інформацію про камеру
       * @returns {object|null} { distance, pitch, yaw, pivotPoint, ... }
       */
      getCameraInfo: () => _ctrl()?.getCameraInfo() ?? null,

      /**
       * Встановити позицію камери з об'єкта getCameraInfo()
       * @param {object} cameraInfo - { distance, pitch, yaw, pivotPoint }
       * @returns {boolean}
       * @example
       * const saved = ConfiguratorAPI.camera.getCameraInfo();
       * ConfiguratorAPI.camera.setCameraPosition(saved);
       */
      setCameraPosition: (cameraInfo) => {
        const ctrl = _ctrl();
        if (!ctrl) return false;

        const result = ctrl.setCameraPosition(cameraInfo);
        if (result) {
          LoggerService.log(bridge, '[Bridge] Camera position set');
        }
        return result;
      },

      // ======================== Focus & Framing ========================

      /**
       * Фокусування камери на entity або на кабінети композиції
       * @param {object} [entity] - Entity для фокусування (без нього — фокус на кабінети)
       * @example
       * ConfiguratorAPI.camera.focusCamera();        // Фокус на кабінети
       * ConfiguratorAPI.camera.focusCamera(entity);   // Фокус на entity
       */
      focusCamera: (entity) => {
        const ctrl = _ctrl();
        if (!ctrl) return;

        if (entity) {
          ctrl.focus(entity);
        } else {
          // Fallback: фокус на кабінети (source of truth для позицій)
          const compositionManager = app.compositionManager;
          const cabinetEntities = compositionManager?.getProductEntitiesByCategory("cabinets") || [];

          if (cabinetEntities.length === 0) {
            LoggerService.warn(bridge, '[Bridge] No cabinets for camera focus');
            return;
          }

          const cameraEntity =
            app.root.findByName("Camera") ||
            app.root.findComponent("camera")?.entity;

          ctrl.focusOnEntities(cabinetEntities, cameraEntity, { force: true });
        }
        LoggerService.log(bridge, '[Bridge] Camera focused');
      },

      /**
       * Reset камери до початкового стану
       * @param {number} yaw
       * @param {number} pitch
       * @param {number} distance
       */
      resetCamera: (yaw, pitch, distance) => {
        const ctrl = _ctrl();
        if (!ctrl) return;

        ctrl.reset(yaw, pitch, distance);
        LoggerService.log(bridge, '[Bridge] Camera reset');
      },

      /**
       * Налаштувати параметри auto-framing камери
       * @param {object} config
       * @param {number} [config.paddingWide] - Множник для широких сцен (default: 1.2, більше = далі)
       * @param {number} [config.paddingTall] - Множник для вузьких сцен (default: 1.6, більше = далі)
       * @param {number} [config.minDistance] - Мінімальна відстань камери
       * @param {number} [config.maxDistance] - Максимальна відстань камери
       * @example
       * ConfiguratorAPI.camera.setFramingConfig({ paddingWide: 2.0, paddingTall: 2.5 });
       */
      setFramingConfig: (config) => {
        const ctrl = _ctrl();
        if (!ctrl) return;

        ctrl.configureFraming(config);
      },

      /**
       * Отримати поточну конфігурацію framing
       * @returns {object|null} { paddingWide, paddingTall, minDistance, maxDistance, autoFramingEnabled }
       */
      getFramingConfig: () => _ctrl()?.getFramingConfig() ?? null,

      /**
       * Увімкнути/вимкнути auto-framing при addProduct/removeProduct/preset
       * @param {boolean} enabled
       * @example
       * ConfiguratorAPI.camera.setAutoFraming(false);
       */
      setAutoFraming: (enabled) => {
        const ctrl = _ctrl();
        if (!ctrl) return;

        ctrl.setAutoFraming(enabled);
      },

      /**
       * Увімкнути/вимкнути debug mode для framing (червоний бокс)
       * @param {boolean} enabled
       */
      setFramingDebug: (enabled) => {
        const ctrl = _ctrl();
        if (!ctrl) return;

        ctrl.setFramingDebug(enabled);
        LoggerService.log(bridge, `[Bridge] Framing debug ${enabled ? 'enabled' : 'disabled'}`);
      },

      // ======================== State Export/Import ========================

      /**
       * Експортувати стан камери для збереження
       * @returns {object|null}
       */
      exportCameraState: () => _ctrl()?.exportState() ?? null,

      /**
       * Імпортувати збережений стан камери
       * @param {object} state
       */
      importCameraState: (state) => {
        const ctrl = _ctrl();
        if (!ctrl) return;

        ctrl.importState(state);
        LoggerService.log(bridge, '[Bridge] Camera state imported');
      },

      /**
       * Скинути cooldown manual control
       */
      resetManualCooldown: () => {
        const ctrl = _ctrl();
        if (!ctrl) return;

        ctrl.resetManualCooldown();
        LoggerService.log(bridge, '[Bridge] Manual cooldown reset');
      },

      // ======================== HQ Snapshot ========================

      /**
       * High-quality offscreen snapshots for PDF/quote/webshop integrations.
       * This API is parallel to takeSnapshot() and does not replace it.
       *
       * @example
       * const result = await ConfiguratorAPI.camera.hqSnapshot.capture('hero');
       * const custom = await ConfiguratorAPI.camera.captureHQSnapshot({ out: 3072, format: 'image/png' });
       */
      hqSnapshot: {
        getPresets: _getHQSnapshotPresets,
        plan: _getHQSnapshotMemoryPlan,
        capture: _captureHQSnapshot,
        download: _downloadHQSnapshot,
        captureCurrentView: _captureCurrentViewHQSnapshot,
        downloadCurrentView: _downloadCurrentViewHQSnapshot,
        downloadFramed: _downloadFramedHQSnapshot
      },

      /**
       * @returns {Array<object>} Copy of available HQ snapshot presets.
       */
      getHQSnapshotPresets: _getHQSnapshotPresets,

      /**
       * Resolves the device memory policy without allocating GPU resources.
       */
      getHQSnapshotMemoryPlan: _getHQSnapshotMemoryPlan,

      /**
       * @param {string|object} [presetOrOptions='page']
       * @returns {Promise<{blob: Blob, width: number, height: number, format: string, dataUrl: string}>}
       */
      captureHQSnapshot: _captureHQSnapshot,

      /**
       * Captures the user's current camera angle with HQ resolution.
       * Use this for client-facing perspective image downloads.
       * Pass `includeRoom: false` to leave the room (walls, floor) out of the image;
       * with `bg: null` the PNG then has a transparent background around the product.
       *
       * @param {string|object} [presetOrOptions='page']
       * @returns {Promise<{blob: Blob, width: number, height: number, format: string, dataUrl: string}>}
       */
      captureCurrentViewHQSnapshot: _captureCurrentViewHQSnapshot,

      /**
       * Downloads a current-view HQ snapshot by default.
       * This preserves the user's perspective for the Image Download workflow.
       * Pass mode/view/cameraMode: 'framed' to force fixed product framing.
       *
       * @param {string|object} [presetOrOptions='page']
       * @param {string|null} [filename]
       * @returns {Promise<boolean>}
       */
      downloadHQSnapshot: _downloadHQSnapshot,

      /**
       * Downloads the user's current camera angle with HQ resolution.
       * This preserves visible 3D dimension lines because the current camera is reused.
       *
       * @param {string|object} [presetOrOptions='page']
       * @param {string|null} [filename]
       * @returns {Promise<boolean>}
       */
      downloadCurrentViewHQSnapshot: _downloadCurrentViewHQSnapshot,

      /**
       * Downloads a fixed, auto-framed product render with HQ resolution.
       * Use this when the export must ignore the user's current camera angle.
       *
       * @param {string|object} [presetOrOptions='page']
       * @param {string|null} [filename]
       * @returns {Promise<boolean>}
       */
      downloadFramedHQSnapshot: _downloadFramedHQSnapshot,

      // ======================== Snapshot ========================

      /**
       * Зробити знімок поточного вигляду камери
       * @param {Object} [options]
       * @param {number} [options.width] - Ширина знімка
       * @param {number} [options.height] - Висота знімка
       * @param {string} [options.format='image/png'] - Формат ('image/png' або 'image/jpeg')
       * @param {number} [options.quality=0.92] - Якість для JPEG (0.0 - 1.0)
       * @param {boolean} [options.rerender=true] - Перерендерити сцену в новому розмірі
       * @returns {Promise<string|null>} Data URL знімка
       * @example
       * const snapshot = await ConfiguratorAPI.camera.takeSnapshot();
       * const hd = await ConfiguratorAPI.camera.takeSnapshot({ width: 1920, height: 1080 });
       */
      takeSnapshot: async (options = {}) => {
        if (!app.graphicsDevice) {
          LoggerService.error(bridge, '[Bridge] Graphics device not available');
          return null;
        }

        try {
          const canvas = app.graphicsDevice.canvas;
          const targetWidth = options.width || canvas.width;
          const targetHeight = options.height || canvas.height;
          const format = options.format || 'image/png';
          const quality = options.quality !== undefined ? options.quality : 0.92;
          const rerender = options.rerender !== false;

          // Розміри співпадають — просто захоплюємо
          if (targetWidth === canvas.width && targetHeight === canvas.height) {
            await new Promise(resolve => app.once('frameend', resolve));
            const dataUrl = canvas.toDataURL(format, quality);
            LoggerService.log(bridge, `[Bridge] Snapshot created (${targetWidth}x${targetHeight}, ${format})`);
            return dataUrl;
          }

          // Scale mode — масштабуємо існуючий рендер
          if (!rerender) {
            await new Promise(resolve => app.once('frameend', resolve));
            return CameraPlugin._scaleSnapshot(canvas, targetWidth, targetHeight, format, quality, bridge);
          }

          // Rerender mode — тимчасово змінюємо canvas
          return await CameraPlugin._rerenderSnapshot(app, canvas, targetWidth, targetHeight, format, quality, bridge);

        } catch (error) {
          LoggerService.error(bridge, '[Bridge] Failed to create snapshot:', error);
          return null;
        }
      }
    };
  }

  /**
   * Масштабує canvas в потрібний розмір без перерендерингу
   * @private
   */
  static _scaleSnapshot(canvas, targetWidth, targetHeight, format, quality, bridge) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = targetWidth;
    tempCanvas.height = targetHeight;
    const ctx = tempCanvas.getContext('2d');

    const sourceAspect = canvas.width / canvas.height;
    const targetAspect = targetWidth / targetHeight;

    let drawWidth, drawHeight, offsetX, offsetY;

    if (sourceAspect > targetAspect) {
      drawWidth = targetWidth;
      drawHeight = targetWidth / sourceAspect;
      offsetX = 0;
      offsetY = (targetHeight - drawHeight) / 2;
    } else {
      drawHeight = targetHeight;
      drawWidth = targetHeight * sourceAspect;
      offsetX = (targetWidth - drawWidth) / 2;
      offsetY = 0;
    }

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(canvas, offsetX, offsetY, drawWidth, drawHeight);

    const dataUrl = tempCanvas.toDataURL(format, quality);
    LoggerService.log(bridge, `[Bridge] Snapshot created (${targetWidth}x${targetHeight}, scaled, ${format})`);
    return dataUrl;
  }

  static _downloadBlob(blob, filename) {
    try {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.style.display = 'none';

      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return true;
    } catch (error) {
      LoggerService.error(CameraPlugin, '[Bridge] Snapshot blob download failed:', error);
      return false;
    }
  }

  /**
   * Перерендерює сцену в новому розмірі та захоплює знімок
   * @private
   */
  static async _rerenderSnapshot(app, canvas, targetWidth, targetHeight, format, quality, bridge) {
    // Зберігаємо оригінальні розміри
    const originalWidth = canvas.width;
    const originalHeight = canvas.height;
    const originalStyleWidth = canvas.style.width;
    const originalStyleHeight = canvas.style.height;

    // Зберігаємо aspect ratio камер
    const originalCameraAspects = [];
    const cameras = app.root.findComponents('camera');
    cameras.forEach(camera => {
      if (camera.camera) {
        originalCameraAspects.push({
          camera: camera.camera,
          aspect: camera.camera.aspectRatio
        });
      }
    });

    try {
      // Встановлюємо новий розмір
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      canvas.style.width = targetWidth + 'px';
      canvas.style.height = targetHeight + 'px';

      cameras.forEach(camera => {
        if (camera.camera) {
          camera.camera.aspectRatio = targetWidth / targetHeight;
        }
      });

      if (app.graphicsDevice.updateClientRect) {
        app.graphicsDevice.updateClientRect();
      }
      if (app.resizeCanvas) {
        app.resizeCanvas(targetWidth, targetHeight);
      }

      // Чекаємо 3 кадри для коректного рендерингу
      await new Promise(resolve => app.once('frameend', resolve));
      await new Promise(resolve => app.once('frameend', resolve));
      await new Promise(resolve => app.once('frameend', resolve));

      const dataUrl = canvas.toDataURL(format, quality);
      LoggerService.log(bridge, `[Bridge] Snapshot created (${targetWidth}x${targetHeight}, rerendered, ${format})`);
      return dataUrl;

    } finally {
      // Відновлюємо оригінальний розмір
      canvas.width = originalWidth;
      canvas.height = originalHeight;

      if (originalStyleWidth !== null && originalStyleWidth !== undefined && originalStyleWidth !== '') {
        canvas.style.width = originalStyleWidth;
      } else {
        canvas.style.removeProperty('width');
      }

      if (originalStyleHeight !== null && originalStyleHeight !== undefined && originalStyleHeight !== '') {
        canvas.style.height = originalStyleHeight;
      } else {
        canvas.style.removeProperty('height');
      }

      originalCameraAspects.forEach(item => {
        item.camera.aspectRatio = item.aspect;
      });

      if (app.graphicsDevice.updateClientRect) {
        app.graphicsDevice.updateClientRect();
      }
      if (app.resizeCanvas) {
        app.resizeCanvas(originalWidth, originalHeight);
      }

      await new Promise(resolve => app.once('frameend', resolve));
      await new Promise(resolve => app.once('frameend', resolve));

      LoggerService.log(bridge, `[Bridge] Canvas size restored to (${originalWidth}x${originalHeight})`);
    }
  }
}
