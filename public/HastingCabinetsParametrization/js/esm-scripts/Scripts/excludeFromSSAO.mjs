import { Script } from '../../playcanvas-stable.min.mjs';

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
 * ExcludeFromSSAO — виключає цю entity і всіх її нащадків з depth pass,
 * через що SSAO не "бачить" їх і не малює на них AO.
 *
 * Поставити на Sink_Point entity. Якщо raster-точок кілька (по одній на
 * кожну раковину), поставити на кожен Sink_Point.
 */ class ExcludeFromSSAO extends Script {
    initialize() {
        if (this.runOnInit) this.excludeNow();
    }
    /**
     * Public — call after a variant swap so the new mesh instances also
     * get removed from the depth layer.
     */ excludeNow() {
        const depthLayer = this.app.scene.layers.getLayerByName('Depth');
        if (!depthLayer) {
            if (this.verbose) console.warn('[ExcludeFromSSAO] No "Depth" layer found');
            return;
        }
        const renders = this.entity.findComponents('render');
        const models = this.entity.findComponents('model');
        let count = 0;
        for (const r of renders){
            if (r.meshInstances && r.meshInstances.length) {
                depthLayer.removeMeshInstances(r.meshInstances);
                count += r.meshInstances.length;
            }
        }
        for (const m of models){
            if (m.model && m.model.meshInstances) {
                depthLayer.removeMeshInstances(m.model.meshInstances);
                count += m.model.meshInstances.length;
            }
        }
        if (this.verbose) {
            console.log(`[ExcludeFromSSAO] Removed ${count} mesh instances ` + `from Depth layer (subtree of "${this.entity.name}")`);
        }
    }
    constructor(...args){
        super(...args), /** @attribute
     * @title Run On Initialize
     * @type {boolean}
     * @default true
     */ _define_property(this, "runOnInit", true), /** @attribute
     * @title Verbose Logging
     * @type {boolean}
     * @default false
     */ _define_property(this, "verbose", false);
    }
}
_define_property(ExcludeFromSSAO, "scriptName", 'excludeFromSSAO');

export { ExcludeFromSSAO };
