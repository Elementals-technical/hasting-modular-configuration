uniform sampler2D tri_normalTex;
uniform float tri_bumpiness;

uniform sampler2D tri_detailNormalTex;
uniform float tri_hasDetailNormal;
uniform float tri_detailBumpiness;
uniform float tri_surfaceGradientNormals;

#ifndef TRI_DETAIL_PARAMS
#define TRI_DETAIL_PARAMS
    uniform float tri_detailTiling;
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

vec3 triUnpack(vec4 n) {
    return n.rgb * 2.0 - 1.0;
}

// Convert tangent normal to slopes, then undo UV mirroring and rotation.
// A neutral normal contributes zero; base and detail slopes add without
// adding extra forward normals that dilute the relief.
vec2 triPatternSlope(vec3 n, float strength, vec2 rotatedUV) {
    vec2 slope = n.xy * strength / max(n.z, 0.05);
    if (grain_mode > 0.5) {
        float axis = grain_mode < 1.5 ? rotatedUV.x : rotatedUV.y;
        if (mod(floor(axis / max(grain_stripWidth, 0.001)), 2.0) > 0.5) {
            if (grain_mode < 1.5) slope.x = -slope.x;
            else slope.y = -slope.y;
        }
    }
    return rotateUV(slope, -tri_rotation);
}

void getNormal() {
    vec3 offset = matrix_model[3].xyz;
    vec3 axisX = normalize(matrix_model[0].xyz);
    vec3 axisY = normalize(matrix_model[1].xyz);
    vec3 axisZ = normalize(matrix_model[2].xyz);
    mat3 rotationMatrix = mat3(axisX, axisY, axisZ);
    vec3 localPos = (vPositionW - offset) * rotationMatrix;

    vec3 worldNormal = normalize(vNormalW);
    vec3 localNormal = normalize(worldNormal * rotationMatrix);
    vec3 blend = vec3(abs(localNormal.x), abs(localNormal.y), abs(localNormal.z));
    blend /= (dot(blend, vec3(1.0)) + 0.0001);

    float sX = (tri_scale > 0.001) ? tri_scale : 1.0;
    
    vec2 uvX = -vec2(localPos.z, localPos.y) / sX;
    vec2 uvY = -vec2(localPos.x, localPos.z) / sX;
    vec2 uvZ = -vec2(localPos.x, localPos.y) / sX;

    vec2 r_uvX = rotateUV(uvX, tri_rotation);
    vec2 r_uvY = rotateUV(uvY, tri_rotation);
    vec2 r_uvZ = rotateUV(uvZ, tri_rotation);

    // — GRAIN FLIP
    r_uvX = applyGrainFlip(r_uvX);
    r_uvY = applyGrainFlip(r_uvY);
    r_uvZ = applyGrainFlip(r_uvZ);

    if (tri_surfaceGradientNormals > 0.5) {
        // Use pre-flip coordinates for the derivative sign of mirrored strips.
        vec2 pX = rotateUV(uvX, tri_rotation);
        vec2 pY = rotateUV(uvY, tri_rotation);
        vec2 pZ = rotateUV(uvZ, tri_rotation);
        vec2 slopeX = triPatternSlope(triUnpack(texture2D(tri_normalTex, r_uvX)), tri_bumpiness, pX);
        vec2 slopeY = triPatternSlope(triUnpack(texture2D(tri_normalTex, r_uvY)), tri_bumpiness, pY);
        vec2 slopeZ = triPatternSlope(triUnpack(texture2D(tri_normalTex, r_uvZ)), tri_bumpiness, pZ);
        if (tri_hasDetailNormal > 0.5) {
            slopeX += triPatternSlope(triUnpack(texture2D(tri_detailNormalTex, r_uvX * tri_detailTiling)), tri_detailBumpiness, pX);
            slopeY += triPatternSlope(triUnpack(texture2D(tri_detailNormalTex, r_uvY * tri_detailTiling)), tri_detailBumpiness, pY);
            slopeZ += triPatternSlope(triUnpack(texture2D(tri_detailNormalTex, r_uvZ * tri_detailTiling)), tri_detailBumpiness, pZ);
        }
        // All projection UVs have a minus sign. Convert slopes into local
        // coordinates and remove their component along the geometric normal.
        vec3 perturbation = vec3(0.0, -slopeX.y, -slopeX.x) * blend.x
            + vec3(-slopeY.x, 0.0, -slopeY.y) * blend.y
            + vec3(-slopeZ.x, -slopeZ.y, 0.0) * blend.z;
        perturbation -= localNormal * dot(localNormal, perturbation);
        dNormalW = normalize(rotationMatrix * (localNormal + perturbation));
        return;
    }

    vec3 nX = triUnpack(texture2D(tri_normalTex, r_uvX));
    nX = vec3(nX.z, nX.y, nX.x); 
    vec3 nY = triUnpack(texture2D(tri_normalTex, r_uvY));
    nY = vec3(nY.x, nY.z, nY.y);
    vec3 nZ = triUnpack(texture2D(tri_normalTex, r_uvZ));
    nZ = vec3(nZ.x, nZ.y, nZ.z);

    vec3 mainNormal = nX * blend.x + nY * blend.y + nZ * blend.z;
    mainNormal.xy *= tri_bumpiness;

    vec3 detailNormal = vec3(0.0);
    
    if (tri_hasDetailNormal > 0.5) {
        vec2 dUVX = r_uvX * tri_detailTiling;
        vec2 dUVY = r_uvY * tri_detailTiling;
        vec2 dUVZ = r_uvZ * tri_detailTiling;

        vec3 dnX = triUnpack(texture2D(tri_detailNormalTex, dUVX));
        dnX = vec3(dnX.z, dnX.y, dnX.x); 

        vec3 dnY = triUnpack(texture2D(tri_detailNormalTex, dUVY));
        dnY = vec3(dnY.x, dnY.z, dnY.y);

        vec3 dnZ = triUnpack(texture2D(tri_detailNormalTex, dUVZ));
        dnZ = vec3(dnZ.x, dnZ.y, dnZ.z);

        vec3 combinedDetail = dnX * blend.x + dnY * blend.y + dnZ * blend.z;
        combinedDetail.xy *= tri_detailBumpiness;
        
        detailNormal = combinedDetail;
    }

    dNormalW = normalize(worldNormal + mainNormal + detailNormal);
}
