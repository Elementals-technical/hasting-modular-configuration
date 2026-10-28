var ArGround = pc.createScript('ar-ground');
ArGround.attributes.add('material', { type: 'asset' });
ArGround.attributes.add('intensity', { type: 'number', min: 0, max: 1, default: 1 });

ArGround.prototype.initialize = function () {
    // Attach a shader to a material that makes it appear transparent while still receiving shadows.
    const materialResource = this.material.resource;
    materialResource.chunks.APIVersion = pc.CHUNKAPI_1_62;
    materialResource.chunks.endPS = `
            litArgs_opacity = mix(light0_shadowIntensity, 0.0, shadow0);
            gl_FragColor.rgb = vec3(0.0);
        `;

    materialResource.blendType = pc.BLEND_PREMULTIPLIED;
    materialResource.update();
};