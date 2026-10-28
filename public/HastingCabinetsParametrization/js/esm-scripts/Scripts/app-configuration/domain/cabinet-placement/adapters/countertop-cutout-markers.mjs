import * as playcanvasStable_min from '../../../../../../playcanvas-stable.min.mjs';

/**
 * Cutout markers (Andriy 23.10): while a top follows a dragged sink base it shows its uncut slab (no CSG per pointer
 * move, countertop-split-preview.mjs), so where its basins are cut is drawn instead: one flat green translucent box per
 * cutter, lying on the slab's top face over the cutter's footprint — the same veil as the dragged cabinet's tint
 * (draft-overlay-presentation.mjs: '#39D080', opacity 0.35). Presentation only: own entities, never picked or measured.
 *
 *   show(boxes)  boxes: [{ minM, maxM }] world footprints (X/Z used) and `surfaceY` (the slab's top face)
 *   hide()       markers hidden (kept for the next show)
 *   destroy()
 *
 * cutterFootprint(cutter) — the world box of a BoolB_ cutter from its mesh's local AABB and its world transform (a
 * cutter is hidden after a cut, so its mesh instance AABB is not kept up to date).
 */ const CUTOUT_MARKER_STYLE = Object.freeze({
    color: [
        0x39 / 255,
        0xD0 / 255,
        0x80 / 255
    ],
    opacity: 0.35,
    thicknessM: 0.003
});
function cutterFootprint(cutter, lib = playcanvasStable_min) {
    const mesh = (cutter?.render?.meshInstances ?? cutter?.model?.meshInstances ?? [])[0]?.mesh ?? null;
    const aabb = mesh?.aabb;
    const world = cutter?.getWorldTransform?.();
    if (!aabb || !world) return null;
    const c = aabb.center, h = aabb.halfExtents, min = [
        Infinity,
        Infinity,
        Infinity
    ], max = [
        -Infinity,
        -Infinity,
        -Infinity
    ];
    const point = new lib.Vec3(), out = new lib.Vec3();
    for (const sx of [
        -1,
        1
    ])for (const sy of [
        -1,
        1
    ])for (const sz of [
        -1,
        1
    ]){
        point.set(c.x + sx * h.x, c.y + sy * h.y, c.z + sz * h.z);
        world.transformPoint(point, out);
        [
            out.x,
            out.y,
            out.z
        ].forEach((v, i)=>{
            min[i] = Math.min(min[i], v);
            max[i] = Math.max(max[i], v);
        });
    }
    return {
        minM: {
            x: min[0],
            y: min[1],
            z: min[2]
        },
        maxM: {
            x: max[0],
            y: max[1],
            z: max[2]
        }
    };
}
function createCutoutMarkers(app, { lib = playcanvasStable_min, style = CUTOUT_MARKER_STYLE } = {}) {
    let material = null;
    const entities = [];
    const materialOf = ()=>{
        if (material) return material;
        material = new lib.StandardMaterial();
        material.name = 'countertop-cutout-marker';
        material.useLighting = false;
        material.useSkybox = false;
        material.useFog = false;
        material.useTonemap = false;
        material.diffuse = new lib.Color(0, 0, 0);
        material.emissive = new lib.Color(style.color[0], style.color[1], style.color[2]);
        material.opacity = style.opacity;
        material.blendType = lib.BLEND_NORMAL;
        material.depthWrite = false;
        material.update();
        return material;
    };
    const entityAt = (index)=>{
        while(entities.length <= index){
            const entity = new lib.Entity(`countertop-cutout-marker-${entities.length}`);
            entity.addComponent('render', {
                type: 'box',
                castShadows: false,
                receiveShadows: false
            });
            entity.render.material = materialOf();
            app.root.addChild(entity);
            entities.push(entity);
        }
        return entities[index];
    };
    return {
        show (boxes, surfaceY) {
            const list = (boxes ?? []).filter(Boolean);
            list.forEach((box, index)=>{
                const entity = entityAt(index);
                const sizeX = Math.max(box.maxM.x - box.minM.x, 0.001), sizeZ = Math.max(box.maxM.z - box.minM.z, 0.001);
                entity.setLocalScale(sizeX, style.thicknessM, sizeZ);
                entity.setPosition((box.minM.x + box.maxM.x) / 2, surfaceY + style.thicknessM / 2, (box.minM.z + box.maxM.z) / 2);
                entity.enabled = true;
            });
            for(let i = list.length; i < entities.length; i++)entities[i].enabled = false;
        },
        hide () {
            entities.forEach((entity)=>{
                entity.enabled = false;
            });
        },
        destroy () {
            entities.splice(0).forEach((entity)=>{
                try {
                    entity.destroy();
                } catch  {}
            });
            try {
                material?.destroy?.();
            } catch  {}
            material = null;
        }
    };
}

export { createCutoutMarkers, cutterFootprint };
