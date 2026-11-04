
#ifndef TRI_PLANAR_COMMON
#define TRI_PLANAR_COMMON
uniform float tri_scale;
uniform float tri_rotation;
#ifndef MATRIX_MODEL_DEFINED
uniform mat4 matrix_model;
#endif
vec2 rotateUV(vec2 uv, float r) {
    float c = cos(r), s = sin(r);
    return vec2(c*uv.x-s*uv.y,s*uv.x+c*uv.y);
}
#endif
#ifndef GRAIN_FLIP_COMMON
#define GRAIN_FLIP_COMMON
uniform float grain_mode;
uniform float grain_stripWidth;
vec2 applyGrainFlip(vec2 uv) {
    if (grain_mode < 0.5) return uv;
    float axis = grain_mode < 1.5 ? uv.x : uv.y;
    float sw = max(grain_stripWidth,0.001);
    float idx = floor(axis/sw);
    if (mod(idx,2.0)>0.5) {
        float value = idx*sw + sw - (axis-idx*sw);
        if (grain_mode<1.5) uv.x=value; else uv.y=value;
    }
    return uv;
}
#endif
#ifndef TRI_MATERIAL_MAPS
#define TRI_MATERIAL_MAPS
uniform vec2 tri_diffuseOffset;
uniform float tri_materialAOTriplanar;
uniform float tri_materialNormalTriplanar;
uniform vec3 tri_aoRow0;
uniform vec3 tri_aoRow1;
uniform vec3 tri_aoDetailRow0;
uniform vec3 tri_aoDetailRow1;
uniform vec3 tri_normalRow0;
uniform vec3 tri_normalRow1;
uniform vec3 tri_normalDetailRow0;
uniform vec3 tri_normalDetailRow1;
uniform vec3 tri_glossRow0;
uniform vec3 tri_glossRow1;
vec2 triMapUV(vec2 uv, vec3 r0, vec3 r1) {
    return vec2(dot(r0,vec3(uv,1.0)),dot(r1,vec3(uv,1.0)));
}
vec2 triUndoMapSlope(vec2 slope, vec3 r0, vec3 r1) {
    // A normal map stores a direction, so tiling changes frequency, not strength.
    vec2 u = r0.xy / max(length(r0.xy),0.000001);
    vec2 v = r1.xy / max(length(r1.xy),0.000001);
    return u*slope.x + v*slope.y;
}
vec4 triSampleProjected(sampler2D tex, vec3 r0, vec3 r1) {
    mat3 axes = mat3(normalize(matrix_model[0].xyz),normalize(matrix_model[1].xyz),normalize(matrix_model[2].xyz));
    vec3 p = (vPositionW-matrix_model[3].xyz)*axes;
    vec3 w = abs(normalize(vNormalW)*axes);
    w /= max(dot(w,vec3(1.0)),0.000001);
    float size = tri_scale>0.001 ? tri_scale : 1.0;
    vec2 x = applyGrainFlip(rotateUV(vec2(p.z,-p.y)/size,tri_rotation))+tri_diffuseOffset;
    vec2 y = applyGrainFlip(rotateUV(vec2(p.x,-p.z)/size,tri_rotation))+tri_diffuseOffset;
    vec2 z = applyGrainFlip(rotateUV(vec2(p.x,-p.y)/size,tri_rotation))+tri_diffuseOffset;
    return texture2D(tex,triMapUV(x,r0,r1))*w.x
        + texture2D(tex,triMapUV(y,r0,r1))*w.y
        + texture2D(tex,triMapUV(z,r0,r1))*w.z;
}
vec4 triSampleMaterialAO(sampler2D tex, vec2 nativeUv, vec3 r0, vec3 r1) {
    if (tri_materialAOTriplanar>0.5) return triSampleProjected(tex,r0,r1);
    return texture2D(tex,nativeUv);
}
#endif

uniform vec3 material_diffuse;
uniform sampler2D tri_diffuseTex;
uniform float tri_hasDiffuse;

uniform sampler2D tri_aoTex;
uniform float tri_hasAO;
uniform float tri_aoIntensity;

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

void getAlbedo() {
    dAlbedo = material_diffuse;

    vec3 offset = matrix_model[3].xyz;
    vec3 axisX = normalize(matrix_model[0].xyz);
    vec3 axisY = normalize(matrix_model[1].xyz);
    vec3 axisZ = normalize(matrix_model[2].xyz);
    mat3 rotationMatrix = mat3(axisX, axisY, axisZ);
    vec3 localPos = (vPositionW - offset) * rotationMatrix;

    vec3 localNormal = normalize(normalize(vNormalW) * rotationMatrix);
    vec3 blend = vec3(abs(localNormal.x), abs(localNormal.y), abs(localNormal.z));
    blend /= max(dot(blend, vec3(1.0)), 0.000001);

    float sX = (tri_scale > 0.001) ? tri_scale : 1.0;
    
    vec2 uvX = vec2(localPos.z, -localPos.y) / sX;
    vec2 uvY = vec2(localPos.x, -localPos.z) / sX;
    vec2 uvZ = vec2(localPos.x, -localPos.y) / sX;

    vec2 r_uvX = rotateUV(uvX, tri_rotation);
    vec2 r_uvY = rotateUV(uvY, tri_rotation);
    vec2 r_uvZ = rotateUV(uvZ, tri_rotation);

    // — GRAIN FLIP — after rotation, before sampling
    r_uvX = applyGrainFlip(r_uvX);
    r_uvY = applyGrainFlip(r_uvY);
    r_uvZ = applyGrainFlip(r_uvZ);

    if (tri_hasDiffuse > 0.5) {
        // The material offset moves the base maps only. The pattern AO below must
        // keep the coordinates of the pattern normal, or the two drift apart.
        vec3 cx = texture2D(tri_diffuseTex, r_uvX + tri_diffuseOffset).rgb;
        vec3 cy = texture2D(tri_diffuseTex, r_uvY + tri_diffuseOffset).rgb;
        vec3 cz = texture2D(tri_diffuseTex, r_uvZ + tri_diffuseOffset).rgb;

        vec3 triColor = cx * blend.x + cy * blend.y + cz * blend.z;
        dAlbedo *= triColor;
    }

    if (tri_hasAO > 0.5 && tri_aoIntensity > 0.0) {
        vec2 aoUVX = r_uvX * tri_detailTiling;
        vec2 aoUVY = r_uvY * tri_detailTiling;
        vec2 aoUVZ = r_uvZ * tri_detailTiling;
        // === LAME ONLY: AO ignores base material scale, rotation and grain ===
        if (tri_lamePattern > 0.5) {
            aoUVX = vec2(localPos.z, -localPos.y) * tri_lamePatternTiling;
            aoUVY = vec2(localPos.x, -localPos.z) * tri_lamePatternTiling;
            aoUVZ = vec2(localPos.x, -localPos.y) * tri_lamePatternTiling;
        }
        // === END LAME ONLY ===

        float aoX = texture2D(tri_aoTex, aoUVX).r;
        float aoY = texture2D(tri_aoTex, aoUVY).r;
        float aoZ = texture2D(tri_aoTex, aoUVZ).r;

        float combinedAO = clamp(aoX * blend.x + aoY * blend.y + aoZ * blend.z, 0.0, 1.0);
        // Preserve the original blend for intensity 0..1. For stronger AO use
        // contrast, not extrapolation that turns mid-gray into negative albedo.
        float finalAO = tri_aoIntensity <= 1.0
            ? mix(1.0, combinedAO, tri_aoIntensity)
            : pow(combinedAO, tri_aoIntensity);

        dAlbedo *= vec3(finalAO);
    }
}
