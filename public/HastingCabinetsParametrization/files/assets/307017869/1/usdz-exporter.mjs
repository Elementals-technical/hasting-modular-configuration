/**
 * @class USDZExporter
 * @classdesc Exports scene geometry to USDZ format using PlayCanvas built-in UsdzExporter
 */
export class USDZExporter {
    /**
     * Exports geometry data to USDZ format
     * @param {pc.Application} app - PlayCanvas application instance
     * @param {pc.Entity} rootEntity - Root entity to export
     * @param {Object} options - Export options
     * @returns {Promise<ArrayBuffer>} USDZ file data
     */
    static async export(app, rootEntity, options = {}) {
        const exporter = new USDZExporter(app);
        return exporter._export(rootEntity, options);
    }

    constructor(app) {
        this.app = app;
    }

    /**
     * Main export method using PlayCanvas UsdzExporter
     * @private
     */
    async _export(rootEntity, options) {
        // Use PlayCanvas built-in USDZ exporter
        const pc = window.pc || this.app.constructor;

        if (!pc.UsdzExporter) {
            throw new Error('PlayCanvas UsdzExporter not available. Make sure you are using a recent version of PlayCanvas.');
        }

        const exportOptions = {
            maxTextureSize: options.maxTextureSize || 1024,
            ...options
        };

        try {
            const usdzExporter = new pc.UsdzExporter();
            const arrayBuffer = await usdzExporter.build(rootEntity, exportOptions);
            return arrayBuffer;
        } catch (error) {
            throw error;
        }
    }

}
