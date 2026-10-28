import { createSnapshotMemoryPlan } from './snapshot-memory-policy.mjs';

const detectPlatformCapabilities = ()=>{
    const navigatorRef = globalThis.navigator;
    const userAgent = navigatorRef?.userAgent || '';
    const ios = /iPad|iPhone|iPod/.test(userAgent) || navigatorRef?.platform === 'MacIntel' && navigatorRef?.maxTouchPoints > 1;
    const mobile = ios || navigatorRef?.userAgentData?.mobile === true || /Android|Mobile|IEMobile|Opera Mini/.test(userAgent);
    return {
        ios,
        mobile
    };
};
const DEFAULT_HQ_SNAPSHOT_PRESETS = [
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
];
const DEFAULT_HQ_SNAPSHOT_CONFIG = {
    azimuth: 35,
    elevation: 25,
    margin: 1.12,
    sharpness: 0.25,
    superSample: 0,
    aabbExclude: []
};
/**
 * High-quality offscreen snapshot renderer.
 *
 * It intentionally does not replace the existing canvas/tag based snapshot API.
 * Consumers can call it through ConfiguratorAPI.camera.hqSnapshot or attach the
 * optional hqSnapshot PlayCanvas script to a camera entity.
 */ class HQSnapshotService {
    configure(config = {}) {
        this.presets = HQSnapshotService.clonePresets(config.presets || DEFAULT_HQ_SNAPSHOT_PRESETS);
        this.azimuth = config.azimuth ?? DEFAULT_HQ_SNAPSHOT_CONFIG.azimuth;
        this.elevation = config.elevation ?? DEFAULT_HQ_SNAPSHOT_CONFIG.elevation;
        this.margin = config.margin ?? DEFAULT_HQ_SNAPSHOT_CONFIG.margin;
        this.sharpness = config.sharpness ?? DEFAULT_HQ_SNAPSHOT_CONFIG.sharpness;
        this.superSample = config.superSample ?? DEFAULT_HQ_SNAPSHOT_CONFIG.superSample;
        if (Object.prototype.hasOwnProperty.call(config, 'platformCapabilities')) {
            this.platformCapabilities = config.platformCapabilities || detectPlatformCapabilities();
        } else if (this.platformCapabilities === undefined) {
            this.platformCapabilities = detectPlatformCapabilities();
        }
        if (Object.prototype.hasOwnProperty.call(config, 'memoryPolicy')) {
            this.memoryPolicy = config.memoryPolicy || {};
        } else if (this.memoryPolicy === undefined) {
            this.memoryPolicy = {};
        }
        if (Object.prototype.hasOwnProperty.call(config, 'cameraResolver')) {
            this.cameraResolver = typeof config.cameraResolver === 'function' ? config.cameraResolver : null;
        } else if (this.cameraResolver === undefined) {
            this.cameraResolver = null;
        }
        this.aabbExclude = Array.isArray(config.aabbExclude) ? [
            ...config.aabbExclude
        ] : [
            ...DEFAULT_HQ_SNAPSHOT_CONFIG.aabbExclude
        ];
        this.cameraEntity = config.cameraEntity || null;
    }
    getPresets() {
        return HQSnapshotService.clonePresets(this.presets);
    }
    getMemoryPlan(presetOrOptions = 'page', runtimeOptions = {}) {
        const cameraEntity = runtimeOptions.cameraEntity || this.cameraEntity || this._findCameraEntity();
        if (runtimeOptions.preferAttachedScript !== false) {
            const script = this._findAttachedSnapshotScript(cameraEntity);
            if (script?.getMemoryPlan) {
                return script.getMemoryPlan(presetOrOptions);
            }
            if (script) {
                const fallbackService = new HQSnapshotService(this.app, this._createConfigFromSnapshotScript(script, cameraEntity));
                return fallbackService.getMemoryPlan(presetOrOptions, {
                    cameraEntity,
                    preferAttachedScript: false
                });
            }
        }
        const device = this.app?.graphicsDevice;
        if (!device) {
            throw new Error('HQSnapshotService: graphics device is not available');
        }
        return createSnapshotMemoryPlan(this._resolveOptions(presetOrOptions), this.platformCapabilities, {
            maxTextureSize: device.maxTextureSize
        }, this.memoryPolicy).metadata;
    }
    /**
   * @param {string|object} presetOrOptions - Preset name or option overrides.
   * Use mode/view/cameraMode: 'current' to capture the user's current camera angle.
   * Use hideEntities: ['Room1_Point'] to leave entities out of this capture: they are
   * disabled for the render frames and switched back on right after the GPU readback.
   * Use fitToContent: true (current mode) to move the camera along its view axis until the
   * content fills the frame; fitExclude: ['Room1_Point'] keeps the room in the picture but
   * out of the fitted box.
   * @param {object} [runtimeOptions]
   * @param {object} [runtimeOptions.cameraEntity]
   * @param {boolean} [runtimeOptions.preferAttachedScript=true]
   * @returns {Promise<{blob: Blob, width: number, height: number, format: string, dataUrl: string}>}
   */ async capture(presetOrOptions = 'page', runtimeOptions = {}) {
        const cameraEntity = runtimeOptions.cameraEntity || this.cameraEntity || this._findCameraEntity();
        const wantsCurrentView = HQSnapshotService.isCurrentViewRequest(presetOrOptions);
        if (runtimeOptions.preferAttachedScript !== false) {
            const script = this._findAttachedSnapshotScript(cameraEntity);
            if (script && (!wantsCurrentView || script.supportsCurrentView === true)) {
                return script.capture(presetOrOptions);
            }
            if (script && wantsCurrentView) {
                const fallbackService = new HQSnapshotService(this.app, this._createConfigFromSnapshotScript(script, cameraEntity));
                return fallbackService.capture(presetOrOptions, {
                    cameraEntity,
                    preferAttachedScript: false
                });
            }
        }
        if (this._busy) {
            throw new Error('HQSnapshotService: capture already in progress');
        }
        this._busy = true;
        try {
            return await this._capture(this._resolveOptions(presetOrOptions), cameraEntity);
        } finally{
            this._busy = false;
        }
    }
    _resolveOptions(presetOrOptions) {
        var _opts, _opts1, _opts2, _opts3, _opts4, _opts5, _opts6;
        const byName = (name)=>this.presets.find((preset)=>preset.name === name);
        let opts;
        if (typeof presetOrOptions === 'string') {
            opts = byName(presetOrOptions);
            if (!opts) {
                throw new Error(`HQSnapshotService: preset "${presetOrOptions}" not found`);
            }
            opts = {
                ...opts
            };
        } else {
            const options = presetOrOptions || {};
            const basePreset = byName(options.preset || 'page') || {};
            opts = {
                ...basePreset,
                ...options
            };
        }
        (_opts = opts).azimuth ?? (_opts.azimuth = this.azimuth);
        (_opts1 = opts).elevation ?? (_opts1.elevation = this.elevation);
        (_opts2 = opts).margin ?? (_opts2.margin = this.margin);
        (_opts3 = opts).sharpness ?? (_opts3.sharpness = this.sharpness);
        opts.mode = HQSnapshotService._normalizeMode(opts.mode ?? opts.view ?? opts.cameraMode);
        (_opts4 = opts).ss ?? (_opts4.ss = (opts.superSample ?? this.superSample) || null);
        if (Number(opts.ss) === 0) {
            opts.ss = null;
        }
        (_opts5 = opts).aabbExclude ?? (_opts5.aabbExclude = this.aabbExclude);
        (_opts6 = opts).format || (_opts6.format = 'image/png');
        opts.quality = HQSnapshotService._clampQuality(opts.quality ?? 0.92);
        this._resolveOutputSize(opts);
        return opts;
    }
    _resolveOutputSize(opts) {
        const explicitWidth = opts.width !== undefined;
        const explicitHeight = opts.height !== undefined;
        const out = HQSnapshotService._positiveInt(opts.out ?? opts.size ?? opts.width ?? opts.height ?? 2048, 2048);
        const preserveCanvasAspect = opts.mode === 'current' && opts.preserveCanvasAspect !== false;
        if (preserveCanvasAspect && (!explicitWidth || !explicitHeight)) {
            const aspect = this._getCanvasAspect();
            if (explicitWidth && !explicitHeight) {
                opts.width = HQSnapshotService._positiveInt(opts.width, out);
                opts.height = HQSnapshotService._positiveInt(opts.width / aspect, Math.max(1, Math.round(out / aspect)));
                return;
            }
            if (!explicitWidth && explicitHeight) {
                opts.height = HQSnapshotService._positiveInt(opts.height, out);
                opts.width = HQSnapshotService._positiveInt(opts.height * aspect, Math.max(1, Math.round(out * aspect)));
                return;
            }
            if (aspect >= 1) {
                opts.width = out;
                opts.height = Math.max(1, Math.round(out / aspect));
            } else {
                opts.width = Math.max(1, Math.round(out * aspect));
                opts.height = out;
            }
            return;
        }
        opts.width = HQSnapshotService._positiveInt(opts.width ?? out, out);
        opts.height = HQSnapshotService._positiveInt(opts.height ?? opts.out ?? out, out);
    }
    _computeAABB(excludeNames = []) {
        const exclude = new Set(excludeNames);
        const root = this.app?.root;
        const components = [
            ...root?.findComponents?.('render') || [],
            ...root?.findComponents?.('model') || []
        ];
        let box = null;
        const visitedMeshInstances = new Set();
        for (const component of components){
            const entity = component.entity;
            // The engine keeps the hierarchy state in `_enabledInHierarchy` (no public getter in 2.20);
            // without it, children of a hidden parent (e.g. the room during a capture) widen the box.
            const enabledInHierarchy = entity?.enabledInHierarchy ?? entity?._enabledInHierarchy;
            if (!entity || entity.enabled === false || enabledInHierarchy === false || exclude.has(entity.name)) {
                continue;
            }
            const meshInstances = component.meshInstances || component.model?.meshInstances || [];
            for (const meshInstance of meshInstances){
                if (!meshInstance?.aabb || meshInstance.visible === false || visitedMeshInstances.has(meshInstance)) {
                    continue;
                }
                visitedMeshInstances.add(meshInstance);
                if (!box) {
                    box = meshInstance.aabb.clone();
                } else {
                    box.add(meshInstance.aabb);
                }
            }
        }
        return box;
    }
    _fitDistance(box, dir, fovRad, aspectRatio, horizontalFov, margin) {
        const pcLib = this._pc();
        const halfExtents = box.halfExtents;
        const forward = dir.clone().mulScalar(-1);
        const worldUp = pcLib.Vec3.UP;
        const right = new pcLib.Vec3().cross(worldUp, forward).normalize();
        const up = new pcLib.Vec3().cross(forward, right).normalize();
        const tanPrimary = Math.tan(fovRad / 2);
        const tanX = horizontalFov ? tanPrimary : tanPrimary * aspectRatio;
        const tanY = horizontalFov ? tanPrimary / aspectRatio : tanPrimary;
        let distance = 0;
        for(let sx = -1; sx <= 1; sx += 2){
            for(let sy = -1; sy <= 1; sy += 2){
                for(let sz = -1; sz <= 1; sz += 2){
                    const corner = new pcLib.Vec3(sx * halfExtents.x, sy * halfExtents.y, sz * halfExtents.z);
                    const x = corner.dot(right);
                    const y = corner.dot(up);
                    const z = corner.dot(dir);
                    distance = Math.max(distance, z + Math.abs(x) / tanX, z + Math.abs(y) / tanY);
                }
            }
        }
        return distance * margin;
    }
    static disableScripts(entity) {
        if (entity.script) {
            entity.script.enabled = false;
        }
        for (const child of entity.children || []){
            HQSnapshotService.disableScripts(child);
        }
    }
    /**
   * Disables the named entities for one capture, e.g. the room behind the product.
   * The live camera renders the same frames, so they vanish from the viewport too —
   * only until _restoreEntities (right after the readback, ~2 frames).
   * @param {string[]} [names] - entity names; every entity with that name is hidden.
   * @returns {object[]} the entities this call switched off. Entities that were already off
   *   are not returned, so the restore never switches on something the scene had off.
   * @example
   *   _hideEntities(['Room1_Point']) // → [Room1_Point]; [] in builds without a room
   */ _hideEntities(names) {
        // Not a list (undefined, a single string by mistake): nothing to hide.
        if (!Array.isArray(names)) return [];
        const hidden = [];
        for (const name of names){
            const matches = this.app?.root?.find?.('name', name) || [];
            for (const entity of matches){
                // Already off in the scene: leave it off and do not restore it later.
                if (entity.enabled === false) continue;
                entity.enabled = false;
                hidden.push(entity);
            }
        }
        return hidden;
    }
    /**
   * Current-view capture with `fitToContent`: keeps the camera's angle and moves it along its
   * view axis so the content's box fills the frame (opts.margin around it).
   * Entities in opts.fitExclude (the room) stay in the picture but do not count towards the box:
   * they are switched off only while the box is measured, with no frame rendered in between.
   * @returns {boolean} false when there is no content to fit: the camera stays where it was.
   * @example
   *   _fitCameraToContent(clone, clone.camera, { fitExclude: ['Room1_Point'], margin: 1.05 }, 2)
   */ _fitCameraToContent(cameraClone, captureCamera, opts, aspectRatio) {
        const excluded = this._hideEntities(opts.fitExclude);
        let box;
        try {
            box = this._computeAABB(opts.aabbExclude);
        } finally{
            this._restoreEntities(excluded);
        }
        if (!box) return false;
        const towardCamera = cameraClone.forward.clone().mulScalar(-1);
        const fovRad = (captureCamera.fov ?? 45) * Math.PI / 180;
        const distance = this._fitDistance(box, towardCamera, fovRad, aspectRatio, Boolean(captureCamera.horizontalFov), opts.margin);
        cameraClone.setPosition(box.center.clone().add(towardCamera.mulScalar(distance)));
        return true;
    }
    /** Switches back on the entities returned by _hideEntities. */ _restoreEntities(entities) {
        for (const entity of entities){
            entity.enabled = true;
        }
    }
    async _capture(opts, cameraEntity) {
        const pcLib = this._pc();
        const app = this.app;
        const device = app?.graphicsDevice;
        if (!device) {
            throw new Error('HQSnapshotService: graphics device is not available');
        }
        if (!cameraEntity?.camera) {
            throw new Error('HQSnapshotService: camera entity is not available');
        }
        const memoryPlan = createSnapshotMemoryPlan(opts, this.platformCapabilities, {
            maxTextureSize: device.maxTextureSize
        }, this.memoryPolicy);
        opts = memoryPlan.options;
        const width = opts.width;
        const height = opts.height;
        const renderWidth = memoryPlan.renderWidth;
        const renderHeight = memoryPlan.renderHeight;
        const aspectRatio = width / height;
        let renderTarget = null;
        let colorBuffer = null;
        let cameraClone = null;
        let cameraFrame = null;
        // Entities left out of this capture (opts.hideEntities); see _hideEntities.
        let hiddenEntities = [];
        // True when opts.fitToContent moved the camera so the content fills the frame.
        let fittedToContent = false;
        try {
            hiddenEntities = this._hideEntities(opts.hideEntities);
            // Reported in the result, so callers know the frame shows none of these entities.
            const hiddenEntityNames = hiddenEntities.map((entity)=>entity.name);
            colorBuffer = new pcLib.Texture(device, {
                name: 'hq-snapshot',
                width: renderWidth,
                height: renderHeight,
                format: pcLib.PIXELFORMAT_RGBA8,
                mipmaps: false
            });
            renderTarget = new pcLib.RenderTarget({
                colorBuffer,
                depth: true,
                samples: 1
            });
            cameraClone = cameraEntity.clone();
            app.root.addChild(cameraClone);
            HQSnapshotService.disableScripts(cameraClone);
            const sourceCamera = cameraEntity.camera;
            const captureCamera = cameraClone.camera;
            captureCamera.aspectRatioMode = pcLib.ASPECT_MANUAL;
            captureCamera.aspectRatio = aspectRatio;
            captureCamera.renderTarget = renderTarget;
            captureCamera.priority = (sourceCamera.priority ?? 0) + 10;
            captureCamera.enabled = true;
            if (opts.mode === 'current') {
                cameraClone.setPosition(cameraEntity.getPosition());
                cameraClone.setRotation(cameraEntity.getRotation());
                if (opts.fitToContent === true) {
                    fittedToContent = this._fitCameraToContent(cameraClone, captureCamera, opts, aspectRatio);
                }
            } else {
                const box = this._computeAABB(opts.aabbExclude);
                if (box) {
                    const azimuth = opts.azimuth * Math.PI / 180;
                    const elevation = opts.elevation * Math.PI / 180;
                    const dir = new pcLib.Vec3(Math.cos(elevation) * Math.sin(azimuth), Math.sin(elevation), Math.cos(elevation) * Math.cos(azimuth)).normalize();
                    const fovRad = (captureCamera.fov ?? 45) * Math.PI / 180;
                    const distance = this._fitDistance(box, dir, fovRad, aspectRatio, Boolean(captureCamera.horizontalFov), opts.margin);
                    cameraClone.setPosition(box.center.clone().add(dir.clone().mulScalar(distance)));
                    cameraClone.lookAt(box.center, pcLib.Vec3.UP);
                } else {
                    cameraClone.setPosition(cameraEntity.getPosition());
                    cameraClone.setRotation(cameraEntity.getRotation());
                }
            }
            if (opts.cameraFrame && pcLib.CameraFrame) {
                cameraFrame = new pcLib.CameraFrame(app, captureCamera);
                if (cameraFrame.rendering) {
                    cameraFrame.rendering.toneMapping = opts.toneMapping ?? pcLib.TONEMAP_NEUTRAL;
                    cameraFrame.rendering.samples = 1;
                    cameraFrame.rendering.sharpness = opts.sharpness;
                }
                if (cameraFrame.ssao) {
                    cameraFrame.ssao.type = opts.ssao ? pcLib.SSAOTYPE_LIGHTING : pcLib.SSAOTYPE_NONE;
                    cameraFrame.ssao.samples = opts.ssaoSamples ?? 32;
                }
                if (cameraFrame.bloom) {
                    cameraFrame.bloom.intensity = opts.bloom ?? 0;
                }
                cameraFrame.update?.();
            }
            await this._waitForRenderedFrames(2);
            const pixels = await colorBuffer.read(0, 0, renderWidth, renderHeight, {
                renderTarget
            });
            // The frame is on the CPU now: give the hidden entities back to the live view
            // before the slow canvas/PNG work.
            this._restoreEntities(hiddenEntities);
            hiddenEntities = [];
            const bigCanvas = this._pixelsToCanvas(pixels, renderWidth, renderHeight);
            const finalCanvas = this._downscaleCanvas(bigCanvas, width, height, opts);
            const blob = await HQSnapshotService.canvasToBlob(finalCanvas, opts.format, opts.quality);
            return HQSnapshotService.createResult({
                blob,
                canvas: finalCanvas,
                width,
                height,
                format: opts.format,
                quality: opts.quality,
                source: 'service',
                memoryGuard: memoryPlan.metadata,
                hiddenEntities: hiddenEntityNames,
                fittedToContent
            });
        } finally{
            // Failed before the readback: the hidden entities still come back.
            this._restoreEntities(hiddenEntities);
            try {
                cameraFrame?.destroy?.();
            } catch (error) {}
            try {
                cameraClone?.destroy?.();
            } catch (error) {}
            try {
                renderTarget?.destroy?.();
            } catch (error) {}
            try {
                colorBuffer?.destroy?.();
            } catch (error) {}
        }
    }
    _pixelsToCanvas(pixels, width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const image = ctx.createImageData(width, height);
        const pixelBytes = pixels instanceof Uint8Array ? pixels : new Uint8Array(pixels);
        const rowSize = width * 4;
        for(let y = 0; y < height; y++){
            image.data.set(pixelBytes.subarray((height - 1 - y) * rowSize, (height - 1 - y) * rowSize + rowSize), y * rowSize);
        }
        ctx.putImageData(image, 0, 0);
        return canvas;
    }
    _downscaleCanvas(sourceCanvas, width, height, opts) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const isJpeg = (opts.format || 'image/png') === 'image/jpeg';
        const bg = opts.bg ?? (isJpeg ? '#ffffff' : null);
        if (bg) {
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, width, height);
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(sourceCanvas, 0, 0, width, height);
        return canvas;
    }
    async _waitForRenderedFrames(count) {
        for(let i = 0; i < count; i++){
            if ('renderNextFrame' in this.app) {
                this.app.renderNextFrame = true;
            }
            await new Promise((resolve)=>{
                if (this.app?.once) {
                    this.app.once('frameend', resolve);
                    return;
                }
                requestAnimationFrame(resolve);
            });
        }
    }
    _findCameraEntity() {
        const resolvedCamera = this.cameraResolver?.(this.app);
        if (resolvedCamera?.camera) {
            return resolvedCamera;
        }
        const controllerCamera = this.app?.cameraController?.getCameraEntity?.();
        if (controllerCamera?.camera) {
            return controllerCamera;
        }
        const namedCamera = this.app?.root?.findByName?.('Camera');
        if (namedCamera?.camera) {
            return namedCamera;
        }
        const cameraComponents = this.app?.root?.findComponents?.('camera') || [];
        const activeCamera = cameraComponents.find((component)=>{
            const entity = component.entity;
            return component.enabled !== false && entity?.enabled !== false && entity?.enabledInHierarchy !== false;
        });
        return activeCamera?.entity || null;
    }
    _findAttachedSnapshotScript(cameraEntity) {
        const script = cameraEntity?.script?.hqSnapshot;
        return script && typeof script.capture === 'function' ? script : null;
    }
    _createConfigFromSnapshotScript(script, cameraEntity) {
        return {
            cameraEntity,
            presets: Array.isArray(script.presets) ? script.presets : this.presets,
            azimuth: script.azimuth ?? this.azimuth,
            elevation: script.elevation ?? this.elevation,
            margin: script.margin ?? this.margin,
            sharpness: script.sharpness ?? this.sharpness,
            superSample: script.superSample ?? this.superSample,
            aabbExclude: Array.isArray(script.aabbExclude) ? script.aabbExclude : this.aabbExclude,
            platformCapabilities: this.platformCapabilities,
            memoryPolicy: this.memoryPolicy,
            cameraResolver: this.cameraResolver
        };
    }
    _getCanvasAspect() {
        const canvas = this.app?.graphicsDevice?.canvas;
        const width = canvas?.width || canvas?.clientWidth || 1;
        const height = canvas?.height || canvas?.clientHeight || 1;
        return width > 0 && height > 0 ? width / height : 1;
    }
    _pc() {
        const pcLib = this.app?.pc || globalThis.pc;
        if (!pcLib) {
            throw new Error('HQSnapshotService: PlayCanvas namespace is not available');
        }
        return pcLib;
    }
    static clonePresets(presets) {
        return (presets || []).map((preset)=>({
                ...preset
            }));
    }
    static createResult({ blob, canvas, width, height, format, quality, source, memoryGuard, hiddenEntities, fittedToContent = false }) {
        return {
            blob,
            width,
            height,
            format,
            quality,
            source,
            memoryGuard,
            // Names of entities left out of this frame (opts.hideEntities); [] when none were hidden.
            // Builds before entity hiding do not set it at all.
            hiddenEntities,
            // True when opts.fitToContent moved the camera to the content; builds before it do not set it.
            fittedToContent,
            get dataUrl () {
                const dataUrl = canvas.toDataURL(format, quality);
                Object.defineProperty(this, 'dataUrl', {
                    value: dataUrl,
                    enumerable: true,
                    configurable: true
                });
                return dataUrl;
            }
        };
    }
    static async canvasToBlob(canvas, format, quality) {
        if (canvas.toBlob) {
            return new Promise((resolve, reject)=>{
                canvas.toBlob((blob)=>blob ? resolve(blob) : reject(new Error('HQSnapshotService: toBlob failed')), format, quality);
            });
        }
        return HQSnapshotService.dataUrlToBlob(canvas.toDataURL(format, quality));
    }
    static dataUrlToBlob(dataUrl) {
        const [header, data] = dataUrl.split(',');
        const mimeMatch = header.match(/data:([^;]+)/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
        const bytes = atob(data);
        const buffer = new Uint8Array(bytes.length);
        for(let i = 0; i < bytes.length; i++){
            buffer[i] = bytes.charCodeAt(i);
        }
        return new Blob([
            buffer
        ], {
            type: mimeType
        });
    }
    static extensionForFormat(format = 'image/png') {
        if (format === 'image/jpeg') return 'jpg';
        if (format === 'image/webp') return 'webp';
        return 'png';
    }
    static _normalizeMode(mode) {
        if (mode === 'current' || mode === 'currentView' || mode === 'viewport') {
            return 'current';
        }
        return 'framed';
    }
    static isCurrentViewRequest(presetOrOptions) {
        if (!presetOrOptions || typeof presetOrOptions !== 'object') {
            return false;
        }
        return HQSnapshotService._normalizeMode(presetOrOptions.mode ?? presetOrOptions.view ?? presetOrOptions.cameraMode) === 'current';
    }
    static _positiveInt(value, fallback) {
        const number = Number(value);
        return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
    }
    static _clampQuality(value) {
        const number = Number(value);
        if (!Number.isFinite(number)) return 0.92;
        return Math.max(0, Math.min(1, number));
    }
    /**
   * @param {object} app - PlayCanvas app instance
   * @param {object} [config]
   * @param {(app: object) => object|null} [config.cameraResolver] - Resolves the camera entity for this project.
   */ constructor(app, config = {}){
        this.app = app;
        this._busy = false;
        this.configure(config);
    }
}

export { DEFAULT_HQ_SNAPSHOT_CONFIG, DEFAULT_HQ_SNAPSHOT_PRESETS, HQSnapshotService };
