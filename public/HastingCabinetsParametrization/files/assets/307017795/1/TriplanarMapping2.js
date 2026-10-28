var TriplanarMaterial = pc.createScript('triplanarMaterial');

// -------- STATIC DUMMY TEXTURES (спільні для всіх інстансів) --------
TriplanarMaterial.dummyCreated = false;
TriplanarMaterial.dummyDiffuse = null;
TriplanarMaterial.dummyNormal = null;
TriplanarMaterial.dummyRoughness = null;

TriplanarMaterial.prototype._createDummyTextures = function () {
    if (TriplanarMaterial.dummyCreated) return;

    var device = this.app.graphicsDevice;

    function makeTex() {
        return new pc.Texture(device, {
            width: 1,
            height: 1,
            format: pc.PIXELFORMAT_R8_G8_B8_A8,
            mipmaps: false
        });
    }

    // Білий дифуз
    var diff = makeTex();
    // Фейкові дані нам не критичні – важливо просто мати прив’язаний текстурний об’єкт
    // Тому навіть без setSource ок.

    // Плоска нормаль (0.5, 0.5, 1) – умовно, але можна теж залишити порожньою
    var norm = makeTex();

    // Roughness 1 (білий)
    var rough = makeTex();

    TriplanarMaterial.dummyDiffuse = diff;
    TriplanarMaterial.dummyNormal = norm;
    TriplanarMaterial.dummyRoughness = rough;
    TriplanarMaterial.dummyCreated = true;
};

// -------- ATTRIBUTES --------

// Текстури
TriplanarMaterial.attributes.add('diffuseMap', {
    type: 'asset',
    assetType: 'texture',
    title: 'Diffuse'
});

TriplanarMaterial.attributes.add('normalMap', {
    type: 'asset',
    assetType: 'texture',
    title: 'Normal'
});

TriplanarMaterial.attributes.add('roughnessMap', {
    type: 'asset',
    assetType: 'texture',
    title: 'Roughness'
});

// Масштаб тайлінгу
TriplanarMaterial.attributes.add('tileScale', {
    type: 'vec2',
    default: [1, 1],
    title: 'Tile Scale'
});

// GLSL фрагментний шейдер (TEXT asset)
TriplanarMaterial.attributes.add('fragmentShader', {
    type: 'asset',
    assetType: 'text',
    title: 'Fragment Shader (GLSL)'
});

TriplanarMaterial.prototype.initialize = function () {
    var app = this.app;
    var device = app.graphicsDevice;

    // створюємо запасні текстури раз на всю апку
    this._createDummyTextures();

    // Знаходимо render або model
    var renderComp = this.entity.render || this.entity.model;
    if (!renderComp || !renderComp.meshInstances || renderComp.meshInstances.length === 0) {
        console.warn('[TriplanarMaterial] No render/model with meshInstances on entity:', this.entity.name);
        return;
    }

    if (!this.fragmentShader) {
        console.error('[TriplanarMaterial] No fragmentShader asset assigned on entity:', this.entity.name);
        return;
    }

    // ---------- VERTEX GLSL ----------
    var vertexGLSL = [
        "attribute vec3 aPosition;",
        "attribute vec3 aNormal;",

        "uniform mat4 matrix_model;",
        "uniform mat4 matrix_viewProjection;",

        "varying vec3 vWorldPos;",
        "varying vec3 vWorldNormal;",

        "void main(void) {",
        "    vec4 worldPos = matrix_model * vec4(aPosition, 1.0);",
        "    vWorldPos = worldPos.xyz;",
        "    vWorldNormal = normalize((matrix_model * vec4(aNormal, 0.0)).xyz);",
        "    gl_Position = matrix_viewProjection * worldPos;",
        "}"
    ].join("\n");

    // ---------- FRAGMENT GLSL (з TEXT-asset’а) ----------
    var fragmentGLSL = this.fragmentShader.resource; // string

    // ---------- СТВОРЮЄМО ShaderMaterial (новий API 2.12.4) ----------
    var shaderDesc = {
        uniqueName: 'TriplanarMaterial_' + this.entity.getGuid(),
        attributes: {
            aPosition: pc.SEMANTIC_POSITION,
            aNormal: pc.SEMANTIC_NORMAL
        },
        vertexGLSL: vertexGLSL,
        fragmentGLSL: fragmentGLSL
    };

    var material = new pc.ShaderMaterial(shaderDesc);

    // Параметри текстур – якщо не вказані в атрибутах, ставимо dummy
    var diffuseTex   = this.diffuseMap   ? this.diffuseMap.resource   : TriplanarMaterial.dummyDiffuse;
    var normalTex    = this.normalMap    ? this.normalMap.resource    : TriplanarMaterial.dummyNormal;
    var roughnessTex = this.roughnessMap ? this.roughnessMap.resource : TriplanarMaterial.dummyRoughness;

    material.setParameter('uDiffuseMap', diffuseTex);
    material.setParameter('uNormalMap', normalTex);
    material.setParameter('uRoughnessMap', roughnessTex);

    // Параметр тайлінгу
    material.setParameter('uTile', this.tileScale.data);

    material.update();

    // ---------- ВІШАЄМО НА ВСІ МЕШІ ЕНТІТІ ----------
    var meshInstances = renderComp.meshInstances;
    for (var i = 0; i < meshInstances.length; i++) {
        meshInstances[i].material = material;
    }

    console.log('[TriplanarMaterial] Triplanar ShaderMaterial applied on', this.entity.name);
};
