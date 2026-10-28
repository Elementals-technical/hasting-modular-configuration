import { LoggerService } from '../../services/logger/logger-service.mjs';

/**
 * AR Export Plugin для ConfiguratorAPI.
 *
 * Інкапсулює всі AR export методи Bridge API.
 * Методи доступні через ConfiguratorAPI.*
 */ class ARExportPlugin {
    /**
   * @param {{ app: object, bridge: object }} ctx
   * @returns {object} Об'єкт з AR export методами
   */ static create(ctx) {
        const { app, bridge } = ctx;
        /** Helper: повертає ARExportService або null */ const _svc = (level = 'error')=>{
            if (!app.arExportService) {
                LoggerService[level](bridge, '[Bridge] ARExportService not initialized');
                return null;
            }
            return app.arExportService;
        };
        return {
            /**
       * Exports the composition to AR formats (GLB and/or USDZ)
       * @param {string} format - 'glb', 'usdz', or 'both' (default: 'both')
       * @param {Object} options - Export options
       * @param {number} [options.scaleToMeters=0.01]
       * @param {number} [options.metersPerUnit=0.01]
       * @param {string} [options.upAxis='Y']
       * @param {number} [options.maxTextureSize=1024]
       * @returns {Promise<{glb?: Blob, usdz?: Blob}>}
       */ exportToAR: async (format = 'both', options = {})=>{
                const svc = _svc();
                if (!svc) throw new Error('AR Export Service is not available');
                try {
                    const result = await svc.exportToAR(format, options);
                    LoggerService.log(bridge, `[Bridge] AR export completed, format: ${format}`);
                    return result;
                } catch (error) {
                    LoggerService.error(bridge, '[Bridge] AR export failed:', error);
                    throw error;
                }
            },
            /**
       * Exports and downloads AR files
       * @param {string} format - 'glb', 'usdz', or 'both' (default: 'both')
       * @param {Object} options
       * @returns {Promise<boolean>}
       */ downloadARFiles: async (format = 'both', options = {})=>{
                const svc = _svc();
                if (!svc) return false;
                try {
                    const success = await svc.downloadARFiles(format, options);
                    if (success) {
                        LoggerService.log(bridge, `[Bridge] AR files downloaded, format: ${format}`);
                    }
                    return success;
                } catch (error) {
                    LoggerService.error(bridge, '[Bridge] AR download failed:', error);
                    return false;
                }
            },
            /**
       * Gets export preview information without generating files
       * @returns {Object} Preview information including stats and bounds
       */ getARExportPreview: ()=>{
                const svc = _svc('warn');
                if (!svc) return {
                    available: false,
                    error: 'AR Export Service not available'
                };
                return svc.getExportPreview();
            },
            /**
       * Validates that the scene can be exported to AR
       * @returns {Object} Validation result with errors and warnings
       */ validateARExport: ()=>{
                const svc = _svc('warn');
                if (!svc) return {
                    valid: false,
                    errors: [
                        'AR Export Service not available'
                    ],
                    warnings: []
                };
                return svc.validate();
            }
        };
    }
}

export { ARExportPlugin };
