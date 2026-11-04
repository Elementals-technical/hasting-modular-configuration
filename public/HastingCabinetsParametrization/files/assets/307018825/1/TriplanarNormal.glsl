
uniform float tri_normalPacked;
uniform float tri_detailNormalPacked;
uniform float tri_normalSRGB;
uniform float tri_detailNormalSRGB;
uniform sampler2D tri_normalTex;
uniform float tri_bumpiness;
uniform float tri_hasNormal;

uniform sampler2D tri_detailNormalTex;
uniform float tri_hasDetailNormal;
uniform float tri_detailBumpiness;
// Both values of the legacy surfaceGradientNormals setting now use this safe path.

#ifndef TRI_DETAIL_PARAMS
#define TRI_DETAIL_PARAMS
    uniform float tri_detailTiling;
    // === LAME ONLY: disabled for all existing collection rules ===
    uniform float tri_lamePattern;
    uniform vec2 tri_lamePatternTiling;
    // === END LAME ONLY ===
#endif

#ifndef TRI_PLANAR_COMMON
#define TRI_PLANAR_COMMON
    uniform float tri_scale;
    uniform float tri_rotation;
    #ifndef MATRIX_MODEL_DEFINED
    uniform mat4 matrix_model;
    #endif
    vec2 rotateUV(vec2 uv, float rotation) {
        float s = sin(rotation);
        float c = cos(rotation);
        return vec2(uv.x * c - uv.y * s, uv.x * s + uv.y * c);
    }
#endif

// ==================== GRAIN DIRECTION ====================
#ifndef GRAIN_FLIP_COMMON
#define GRAIN_FLIP_COMMON
    uniform float grain_mode;
    uniform float grain_stripWidth;

    vec2 applyGrainFlip(vec2 uv) {
        if (grain_mode < 0.5) return uv;
        float axis = (grain_mode < 1.5) ? uv.x : uv.y;
        float sw = max(grain_stripWidth, 0.001);
        float idx = floor(axis / sw);
        if (mod(idx, 2.0) > 0.5) {
            float local = axis - idx * sw;
            float mirrored = sw - local;
            if (grain_mode < 1.5) {
                uv.x = idx * sw + mirrored;
            } else {
                uv.y = idx * sw + mirrored;
            }
        }
        return uv;
    }
#endif
// =========================================================

// Standard RGB tangent-space normal textures, decoded as in the original chunk.
vec3 triDecode(vec4 value, float packed, float srgb) {
    if (packed > 0.5) {
        vec2 xy = value.ag * 2.0 - 1.0;
        return vec3(xy,sqrt(1.0-clamp(dot(xy,xy),0.0,1.0)));
    }
    // A normal map flagged sRGB in the Editor arrives gamma-decoded: its neutral 0.5
    // reads as 0.21, which tilts the whole surface. Restore the stored values.
    vec3 rgb = value.rgb;
    if (srgb > 0.5) {
        rgb = mix(rgb * 12.92, 1.055 * pow(rgb, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, rgb));
    }
    return rgb*2.0-1.0;
}
vec3 triUnpack(vec4 value) { return triDecode(value,tri_normalPacked,tri_normalSRGB); }
vec3 triUnpackDetail(vec4 value) { return triDecode(value,tri_detailNormalPacked,tri_detailNormalSRGB); }

// Extract only relief: a neutral tangent normal adds no projection-axis normal.
vec2 triNormalSlope(vec3 normalValue, float strength) {
    // The projection derives its basis from UVs on every mesh, as the engine's
    // derivative TBN does with -B, so imported vertex tangents change nothing here.
    // Apply this BEFORE UV rotation/mirroring; do not flip texture UVs.
    normalValue.y = -normalValue.y;

    // Above 1 the mix below would drive z through zero and blow the slope up.
    if (strength > 1.0) return strength * normalValue.xy / max(normalValue.z,0.05);

    // Match the engine's mix(neutral, sample, bumpiness) before resolving slope.
    vec3 scaled = mix(vec3(0.0,0.0,1.0),normalValue,strength);
    return scaled.xy / max(scaled.z,0.05);
}

// Undo the texture transform for the vector, using coordinates BEFORE grain flip.
vec2 triUndoPatternSlope(vec2 slope, vec2 rotatedUV) {
    if (grain_mode > 0.5) {
        float axis = grain_mode < 1.5 ? rotatedUV.x : rotatedUV.y;
        if (mod(floor(axis / max(grain_stripWidth, 0.001)), 2.0) > 0.5) {
            if (grain_mode < 1.5) slope.x = -slope.x;
            else slope.y = -slope.y;
        }
    }
    return rotateUV(slope, -tri_rotation);
}

vec2 triPatternSlope(vec3 n, float strength, vec2 uv) {
    return triUndoPatternSlope(triNormalSlope(n,strength),uv);
}
vec2 triMaterialSlope(vec3 n, float strength, vec2 uv, vec3 r0, vec3 r1) {
    return triUndoPatternSlope(triUndoMapSlope(triNormalSlope(n,strength),r0,r1),uv);
}
void getNormal() {
    // Engine shading normal, including imported split/custom normals and its
    // two-sided handling. Do not reconstruct this normal from projection axes.
    vec3 worldNormal = normalize(dVertexNormalW);
    // The script pattern REPLACES the material normal stack, even at strength 0.
    if (tri_materialNormalTriplanar < 0.5 && tri_hasDetailNormal < 0.5) {
        triNativeGetNormal();
        worldNormal = normalize(dNormalW);
    }
    dNormalW = worldNormal;

    bool useBase = tri_hasDetailNormal < 0.5 && tri_materialNormalTriplanar > 0.5 && tri_hasNormal > 0.5 && abs(tri_bumpiness) > 0.0;
    bool useDetail = tri_hasDetailNormal > 0.5 && abs(tri_detailBumpiness) > 0.0;
    // In particular, never sample the 8-bit dummy normal when no map exists.
    #ifdef STD_NORMALDETAIL_TEXTURE
    bool useMaterialDetail = tri_hasDetailNormal < 0.5 && tri_materialNormalTriplanar > 0.5 && abs(material_normalDetailMapBumpiness) > 0.0;
    #else
    bool useMaterialDetail = false;
    #endif
    if (!useBase && !useDetail && !useMaterialDetail) return;

    vec3 offset = matrix_model[3].xyz;
    vec3 axisX = normalize(matrix_model[0].xyz);
    vec3 axisY = normalize(matrix_model[1].xyz);
    vec3 axisZ = normalize(matrix_model[2].xyz);
    mat3 projectionAxes = mat3(axisX, axisY, axisZ);
    vec3 localPos = (vPositionW - offset) * projectionAxes;

    vec3 projectionNormal = normalize(normalize(vNormalW) * projectionAxes);
    vec3 blend = abs(projectionNormal);
    blend /= max(dot(blend, vec3(1.0)), 0.000001);

    float size = tri_scale > 0.001 ? tri_scale : 1.0;
    vec2 uvX = vec2(localPos.z, -localPos.y) / size;
    vec2 uvY = vec2(localPos.x, -localPos.z) / size;
    vec2 uvZ = vec2(localPos.x, -localPos.y) / size;
    vec2 pX = rotateUV(uvX, tri_rotation);
    vec2 pY = rotateUV(uvY, tri_rotation);
    vec2 pZ = rotateUV(uvZ, tri_rotation);
    vec2 rX = applyGrainFlip(pX);
    vec2 rY = applyGrainFlip(pY);
    vec2 rZ = applyGrainFlip(pZ);

    vec2 slopeX = vec2(0.0);
    vec2 slopeY = vec2(0.0);
    vec2 slopeZ = vec2(0.0);
    if (useBase) {
        slopeX = triMaterialSlope(triUnpack(texture2D(tri_normalTex, triMapUV(rX+tri_diffuseOffset,tri_normalRow0,tri_normalRow1))), tri_bumpiness, pX,tri_normalRow0,tri_normalRow1);
        slopeY = triMaterialSlope(triUnpack(texture2D(tri_normalTex, triMapUV(rY+tri_diffuseOffset,tri_normalRow0,tri_normalRow1))), tri_bumpiness, pY,tri_normalRow0,tri_normalRow1);
        slopeZ = triMaterialSlope(triUnpack(texture2D(tri_normalTex, triMapUV(rZ+tri_diffuseOffset,tri_normalRow0,tri_normalRow1))), tri_bumpiness, pZ,tri_normalRow0,tri_normalRow1);
    }


    #ifdef STD_NORMALDETAIL_TEXTURE
    if (tri_hasDetailNormal < 0.5 && tri_materialNormalTriplanar > 0.5) {
        vec3 nx = {STD_NORMALDETAIL_TEXTURE_DECODE}(texture2D({STD_NORMALDETAIL_TEXTURE_NAME},triMapUV(rX+tri_diffuseOffset,tri_normalDetailRow0,tri_normalDetailRow1)));
        vec3 ny = {STD_NORMALDETAIL_TEXTURE_DECODE}(texture2D({STD_NORMALDETAIL_TEXTURE_NAME},triMapUV(rY+tri_diffuseOffset,tri_normalDetailRow0,tri_normalDetailRow1)));
        vec3 nz = {STD_NORMALDETAIL_TEXTURE_DECODE}(texture2D({STD_NORMALDETAIL_TEXTURE_NAME},triMapUV(rZ+tri_diffuseOffset,tri_normalDetailRow0,tri_normalDetailRow1)));
        slopeX += triMaterialSlope(nx,material_normalDetailMapBumpiness,pX,tri_normalDetailRow0,tri_normalDetailRow1);
        slopeY += triMaterialSlope(ny,material_normalDetailMapBumpiness,pY,tri_normalDetailRow0,tri_normalDetailRow1);
        slopeZ += triMaterialSlope(nz,material_normalDetailMapBumpiness,pZ,tri_normalDetailRow0,tri_normalDetailRow1);
    }
    #endif

    if (useDetail) {
        if (tri_lamePattern > 0.5) {
            // Independent object-aligned detail pattern; no base rotation/grain.
            vec3 nX = triUnpackDetail(texture2D(tri_detailNormalTex, vec2(localPos.z, -localPos.y) * tri_lamePatternTiling));
            vec3 nY = triUnpackDetail(texture2D(tri_detailNormalTex, vec2(localPos.x, -localPos.z) * tri_lamePatternTiling));
            vec3 nZ = triUnpackDetail(texture2D(tri_detailNormalTex, vec2(localPos.x, -localPos.y) * tri_lamePatternTiling));
            slopeX += triNormalSlope(nX, tri_detailBumpiness);
            slopeY += triNormalSlope(nY, tri_detailBumpiness);
            slopeZ += triNormalSlope(nZ, tri_detailBumpiness);
        } else {
            slopeX += triPatternSlope(triUnpackDetail(texture2D(tri_detailNormalTex, rX * tri_detailTiling)), tri_detailBumpiness, pX);
            slopeY += triPatternSlope(triUnpackDetail(texture2D(tri_detailNormalTex, rY * tri_detailTiling)), tri_detailBumpiness, pY);
            slopeZ += triPatternSlope(triUnpackDetail(texture2D(tri_detailNormalTex, rZ * tri_detailTiling)), tri_detailBumpiness, pZ);
        }
    }

    // The UV definitions above have positive U and negative V. Convert their slopes
    // to world vectors, then project onto the ORIGINAL shading tangent plane.
    vec3 perturbationLocal = vec3(0.0, -slopeX.y, slopeX.x) * blend.x
        + vec3(slopeY.x, 0.0, -slopeY.y) * blend.y
        + vec3(slopeZ.x, -slopeZ.y, 0.0) * blend.z;
    vec3 perturbationWorld = projectionAxes * perturbationLocal;
    perturbationWorld -= worldNormal * dot(worldNormal, perturbationWorld);

    // Keep the base in world space: a round trip through normalized model
    // columns is not an identity when a transform hierarchy introduces shear.
    dNormalW = normalize(worldNormal + perturbationWorld);
}
