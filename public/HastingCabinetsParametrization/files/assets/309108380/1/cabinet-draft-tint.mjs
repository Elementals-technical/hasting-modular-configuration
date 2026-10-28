import * as pc from 'playcanvas';

/**
 * 3D tint of a placement draft: the draft's visible meshes are drawn a second time with one
 * translucent, unlit colour (World layer, transparent pass, depth-tested, no depth write), so the
 * cabinet keeps its look under a green / red veil. Only the draft's own entity is touched: no
 * committed material, no render component and no hierarchy change (bounds, picking and rules
 * see exactly what they saw before).
 *
 * The overlay instances share the draft's meshes. Detach BEFORE the draft entity (and a mesh it
 * owns) is destroyed — the local runtime calls the overlay's release() before disposing a preview.
 *
 * Borrowed meshes: the tint never owns a mesh. (1) Releasing an overlay instance only drops its
 * reference — pc.MeshInstance#destroy() would destroy a mesh whose refCount reaches 0, e.g. the
 * MeshBoolean source / SmartStretch clone after the CSG swapped it out of the draft. (2) A CSG
 * rebuild replaces the source instance's mesh and destroys the previous generated one; every frame
 * (before render) the tint rebuilds its instances when a source mesh changed, so it never draws a
 * destroyed mesh (WebglGraphicsDevice.draw: "Cannot read properties of undefined (reading 'device')").
 */

/** '#RRGGBB' | '#RGB' | [r,g,b] (0..1) -> [r,g,b] (0..1). */
export function parseTintColor(value) {
    if (Array.isArray(value) && value.length >= 3 && value.slice(0, 3).every(v => Number.isFinite(v) && v >= 0 && v <= 1)) {
        return value.slice(0, 3);
    }
    if (typeof value === 'string') {
        let hex = value.trim().replace(/^#/, '');
        if (/^[0-9a-f]{3}$/i.test(hex)) hex = [...hex].map(ch => ch + ch).join('');
        if (/^[0-9a-f]{6}$/i.test(hex)) return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
    }
    throw new TypeError(`Invalid tint colour: ${JSON.stringify(value)}`);
}

/** PlayCanvas port. `lib` is injectable for Node tests. */
export function createPlayCanvasTintGraphics(app, lib = pc) {
    const layer = () => app?.scene?.layers?.getLayerById?.(lib.LAYERID_WORLD ?? 0)
        ?? app?.scene?.layers?.getLayerByName?.('World') ?? null;
    return Object.freeze({
        createMaterial() {
            const material = new lib.StandardMaterial();
            material.name = 'cabinet-draft-tint';
            material.useLighting = false;
            material.useSkybox = false;
            material.useFog = false;
            material.useTonemap = false;
            material.diffuse = new lib.Color(0, 0, 0);
            material.emissive = new lib.Color(1, 1, 1);
            material.opacity = 0.35;
            material.blendType = lib.BLEND_NORMAL;
            material.depthWrite = false;
            material.update();
            return Object.freeze({
                material,
                set({ rgb, opacity }) {
                    material.emissive = new lib.Color(rgb[0], rgb[1], rgb[2]);
                    material.opacity = opacity;
                    material.update();
                },
                destroy() { material.destroy?.(); }
            });
        },
        createInstance(source, handle) {
            const instance = new lib.MeshInstance(source.mesh, handle.material, source.node);
            instance.castShadow = false;
            instance.receiveShadow = false;
            return instance;
        },
        add(instances) { layer()?.addMeshInstances(instances); },
        remove(instances) { layer()?.removeMeshInstances(instances); },
        /** Drop the borrowed mesh and the tint material; never MeshInstance#destroy() (it may destroy the mesh). */
        destroyInstance(instance) {
            instance.mesh = null;
            instance.material = null;
        },
        /** Called before every render (app 'prerender'); returns the unsubscribe. */
        onFrame(callback) {
            if (typeof app?.on !== 'function') return () => {};
            app.on('prerender', callback);
            return () => app.off?.('prerender', callback);
        }
    });
}

/** Visible mesh instances of an enabled subtree (render and model components). */
export function collectTintSources(root) {
    const sources = [];
    const visit = node => {
        if (!node || node.enabled === false) return;
        for (const component of [node.render, node.model]) {
            if (!component || component.enabled === false) continue;
            for (const meshInstance of component.meshInstances ?? []) {
                if (meshInstance?.mesh && meshInstance.node && meshInstance.visible !== false) sources.push(meshInstance);
            }
        }
        for (const child of node.children ?? []) visit(child);
    };
    visit(root);
    return sources;
}

export function createCabinetDraftTint({ graphics } = {}) {
    if (!['createMaterial', 'createInstance', 'add', 'remove'].every(name => typeof graphics?.[name] === 'function')) {
        throw new TypeError('Draft tint requires a graphics port');
    }
    // pairs: { source, mesh (the source's mesh when the instance was made), instance }
    let entity = null, handle = null, pairs = [], offFrame = null;
    const release = previous => {
        try { if (previous.length) graphics.remove(previous.map(pair => pair.instance)); }
        finally { for (const { instance } of previous) { try { graphics.destroyInstance?.(instance); } catch { /* best effort */ } } }
    };
    const build = () => {
        pairs = collectTintSources(entity).map(source => ({ source, mesh: source.mesh, instance: graphics.createInstance(source, handle) }));
        if (pairs.length) graphics.add(pairs.map(pair => pair.instance));
    };
    const detach = () => {
        const previous = pairs;
        pairs = [];
        entity = null;
        try { offFrame?.(); } catch { /* best effort */ }
        offFrame = null;
        try { release(previous); }
        finally {
            const material = handle;
            handle = null;
            material?.destroy();
        }
    };
    /** Re-make the overlay instances when a source mesh was replaced (CSG rebuild) or released. */
    const sync = () => {
        if (!entity || !handle || !pairs.some(pair => pair.source.mesh !== pair.mesh)) return false;
        const previous = pairs;
        pairs = [];
        release(previous);
        build();
        return true;
    };
    const onFrame = () => {
        try { sync(); } catch { try { detach(); } catch { /* never break the render loop */ } }
    };
    return Object.freeze({
        get entity() { return entity; },
        get instanceCount() { return pairs.length; },
        attach(root, { rgb, opacity }) {
            if (root === entity) { sync(); return; }
            detach();
            if (!root) return;
            handle = graphics.createMaterial();
            handle.set({ rgb, opacity });
            entity = root;
            build();
            offFrame = graphics.onFrame?.(onFrame) ?? null;
        },
        set({ rgb, opacity }) { handle?.set({ rgb, opacity }); },
        sync,
        detach
    });
}
