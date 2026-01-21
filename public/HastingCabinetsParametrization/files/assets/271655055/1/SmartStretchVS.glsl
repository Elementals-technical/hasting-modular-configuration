// Uniforms now are vec3 to handle X, Y, Z independently
uniform vec3 uStretchAmount;
uniform vec3 uMargin;
uniform vec3 uOriginalHalfSize;

// Helper function to process a single axis
float processAxis(float val, float amount, float margin, float halfSize) {
    // Optimization: Skip if no stretch or size is invalid
    if (abs(amount) < 0.001 || halfSize < 0.001) return val;

    float absVal = abs(val);
    float signVal = sign(val);
    
    // 9-Slice Logic
    float splitPoint = max(halfSize - margin, 0.0);
    float halfStretch = amount * 0.5;

    if (absVal >= splitPoint) {
        // Edge: Shift
        return val + (signVal * halfStretch);
    } else {
        // Center: Scale
        float scale = (splitPoint + halfStretch) / max(splitPoint, 0.001);
        return val * scale;
    }
}

vec4 getPosition() {
    dModelMatrix = matrix_model;
    vec3 localPos = vertex_position.xyz;

    // Process each axis independently
    localPos.x = processAxis(localPos.x, uStretchAmount.x, uMargin.x, uOriginalHalfSize.x);
    localPos.y = processAxis(localPos.y, uStretchAmount.y, uMargin.y, uOriginalHalfSize.y);
    localPos.z = processAxis(localPos.z, uStretchAmount.z, uMargin.z, uOriginalHalfSize.z);

    // Transform to World Space
    vec4 posW = dModelMatrix * vec4(localPos, 1.0);
    dPositionW = posW.xyz;
    
    return matrix_viewProjection * posW;
}

vec3 getWorldPosition() {
    return dPositionW;
}