import { LoggerService } from '../services/logger/logger-service.mjs';
import { OperationType } from '../../mesh-boolean/core/MeshBooleanOperation.mjs';

/** Controls Boolean cuts without coupling their state to cutter visibility. */
export class SceneBooleanHelper {
    static getEnabled(entity) {
        const mb = entity?.script?.meshBoolean;
        return mb ? mb.booleanEnabled !== false : null;
    }

    static getCutters(entity) {
        return [...(entity?.script?.meshBoolean?.cutters || [])];
    }

    /**
     * Configure an existing meshBoolean script. Cutters are actual entities
     * from the current product clone; disabling retains their references.
     * Returns a promise for the scheduled rebuild, or null if no script exists.
     * Does not enable cutter parents: their visibility remains a product decision.
     */
    static configure(entity, { enabled, cutters, operation } = {}, options = {}) {
        const mb = entity?.script?.meshBoolean;
        if (!mb) {
            LoggerService.warn(this, 'SceneBooleanHelper: meshBoolean script is required', {
                entityName: entity?.name
            });
            return null;
        }
        if (enabled !== undefined && typeof enabled !== 'boolean') {
            throw new TypeError('Boolean enabled must be true or false');
        }
        if (cutters !== undefined && (!Array.isArray(cutters) || cutters.some(c => !c || c === entity))) {
            throw new TypeError('Cutters must be an array of entities other than the target');
        }
        if (operation !== undefined && !Object.values(OperationType).includes(operation)) {
            throw new TypeError('Unknown Boolean operation');
        }

        if (enabled !== undefined) mb.booleanEnabled = enabled;
        if (cutters !== undefined) mb.cutters = [...new Set(cutters)];
        // Hidden cutters still participate in CSG, and must not appear when disabled.
        for (const cutter of mb.cutters || []) {
            if (cutter) cutter.enabled = false;
        }
        if (operation !== undefined && mb.operation !== operation) mb.operation = operation;
        return this.rebuild(entity, options);
    }

    static setEnabled(entity, enabled, options = {}) {
        return this.configure(entity, { enabled }, options);
    }

    static setCutters(entity, cutters, options = {}) {
        return this.configure(entity, { cutters }, options);
    }

    static rebuild(entity, options = {}) {
        const mb = entity?.script?.meshBoolean;
        if (!mb) return null;
        // Restoration must execute even when every cutter parent is disabled.
        const request = typeof mb.requestBoolean === 'function'
            ? mb.requestBoolean({ ...options, skipWhenNoActiveCutters: false })
            : Promise.resolve().then(() => mb.performBoolean());
        request.catch(error => LoggerService.error(this, 'Boolean rebuild failed', error));
        return request;
    }
}
