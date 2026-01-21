uniform sampler2D tri_glossTex;
uniform float tri_glossiness;
uniform float tri_glossInvert;
// --- COMMON LOGIC ---
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
// --------------------

void getGlossiness() {
    vec3 offset = matrix_model[3].xyz;
    vec3 axisX = normalize(matrix_model[0].xyz);
    vec3 axisY = normalize(matrix_model[1].xyz);
    vec3 axisZ = normalize(matrix_model[2].xyz);
    mat3 rotationMatrix = mat3(axisX, axisY, axisZ);
    
    vec3 localPos = (vPositionW - offset) * rotationMatrix;

    vec3 lFdx = dFdx(localPos);
    vec3 lFdy = dFdy(localPos);
    vec3 localNormal = normalize(cross(lFdx, lFdy));
    vec3 blend = vec3(abs(localNormal.x), abs(localNormal.y), abs(localNormal.z));
    blend /= (dot(blend, vec3(1.0)) + 0.0001);

    float sX = (tri_scale > 0.001) ? tri_scale : 1.0;

    vec2 uvX = vec2(localPos.z, localPos.y) / sX;
    vec2 uvY = vec2(localPos.x, localPos.z) / sX;
    vec2 uvZ = vec2(localPos.x, localPos.y) / sX;

    uvX = rotateUV(uvX, tri_rotation);
    uvY = rotateUV(uvY, tri_rotation);
    uvZ = rotateUV(uvZ, tri_rotation);

    float gX = texture2D(tri_glossTex, uvX).r;
    float gY = texture2D(tri_glossTex, uvY).r;
    float gZ = texture2D(tri_glossTex, uvZ).r;

    float textureVal = gX * blend.x + gY * blend.y + gZ * blend.z;

    if (tri_glossInvert > 0.5) {
        textureVal = 1.0 - textureVal;
    }

    dGlossiness = textureVal * tri_glossiness * 5.0;
}