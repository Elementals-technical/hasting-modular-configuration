uniform sampler2D tri_normalTex;
uniform float tri_bumpiness;

uniform sampler2D tri_detailNormalTex;
uniform float tri_hasDetailNormal;
uniform float tri_detailBumpiness;

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

vec3 triUnpack(vec4 n) {
    return n.rgb * 2.0 - 1.0;
}

void getNormal() {
    vec3 offset = matrix_model[3].xyz;
    vec3 axisX = normalize(matrix_model[0].xyz);
    vec3 axisY = normalize(matrix_model[1].xyz);
    vec3 axisZ = normalize(matrix_model[2].xyz);
    mat3 rotationMatrix = mat3(axisX, axisY, axisZ);
    vec3 localPos = (vPositionW - offset) * rotationMatrix;

    vec3 fdx = dFdx(vPositionW);
    vec3 fdy = dFdy(vPositionW);
    vec3 worldNormal = normalize(cross(fdx, fdy)); 

    vec3 lFdx = dFdx(localPos);
    vec3 lFdy = dFdy(localPos);
    vec3 localNormal = normalize(cross(lFdx, lFdy));
    vec3 blend = vec3(abs(localNormal.x), abs(localNormal.y), abs(localNormal.z));
    blend /= (dot(blend, vec3(1.0)) + 0.0001);

    float sX = (tri_scale > 0.001) ? tri_scale : 1.0;
    
    vec2 uvX = -vec2(localPos.z, localPos.y) / sX;
    vec2 uvY = -vec2(localPos.x, localPos.z) / sX;
    vec2 uvZ = -vec2(localPos.x, localPos.y) / sX;

    vec2 r_uvX = rotateUV(uvX, tri_rotation);
    vec2 r_uvY = rotateUV(uvY, tri_rotation);
    vec2 r_uvZ = rotateUV(uvZ, tri_rotation);

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