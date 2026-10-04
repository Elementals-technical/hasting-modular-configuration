uniform sampler2D tri_diffuseTex;
uniform float tri_hasDiffuse;

uniform sampler2D tri_aoTex;
uniform float tri_hasAO;
uniform float tri_aoIntensity;

#ifndef TRI_DETAIL_PARAMS
#define TRI_DETAIL_PARAMS
    uniform float tri_detailTiling;
#endif

#ifndef TRI_PLANAR_COMMON
#define TRI_PLANAR_COMMON

    uniform float tri_scale;
    uniform float tri_rotation;
    uniform vec3 material_diffuse;
    
    #ifndef MATRIX_MODEL_DEFINED
    uniform mat4 matrix_model;
    #endif

    vec2 rotateUV(vec2 uv, float rotation) {
        float s = sin(rotation);
        float c = cos(rotation);
        return vec2(uv.x * c - uv.y * s, uv.x * s + uv.y * c);
    }

#endif

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
    blend /= (dot(blend, vec3(1.0)) + 0.0001);

    float sX = (tri_scale > 0.001) ? tri_scale : 1.0;
    
    vec2 uvX = -vec2(localPos.z, localPos.y) / sX;
    vec2 uvY = -vec2(localPos.x, localPos.z) / sX;
    vec2 uvZ = -vec2(localPos.x, localPos.y) / sX;

    vec2 r_uvX = rotateUV(uvX, tri_rotation);
    vec2 r_uvY = rotateUV(uvY, tri_rotation);
    vec2 r_uvZ = rotateUV(uvZ, tri_rotation);

    if (tri_hasDiffuse > 0.5) {
        vec3 cx = texture2D(tri_diffuseTex, r_uvX).rgb;
        vec3 cy = texture2D(tri_diffuseTex, r_uvY).rgb;
        vec3 cz = texture2D(tri_diffuseTex, r_uvZ).rgb;

        vec3 triColor = cx * blend.x + cy * blend.y + cz * blend.z;
        dAlbedo *= triColor;
    }

    if (tri_hasAO > 0.5) {
        vec2 aoUVX = r_uvX * tri_detailTiling;
        vec2 aoUVY = r_uvY * tri_detailTiling;
        vec2 aoUVZ = r_uvZ * tri_detailTiling;

        float aoX = texture2D(tri_aoTex, aoUVX).r;
        float aoY = texture2D(tri_aoTex, aoUVY).r;
        float aoZ = texture2D(tri_aoTex, aoUVZ).r;

        float combinedAO = aoX * blend.x + aoY * blend.y + aoZ * blend.z;
        float finalAO = mix(1.0, combinedAO, tri_aoIntensity);

        dAlbedo *= vec3(finalAO);
    }
}