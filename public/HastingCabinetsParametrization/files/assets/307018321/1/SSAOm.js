// ----------------- POST EFFECT CLASS ------------------ //

class SSAOEffect extends pc.PostEffect {
    /**
     * @param {pc.GraphicsDevice} graphicsDevice
     * @param {any} ssaoScript
     */
    constructor(graphicsDevice, ssaoScript) {
        super(graphicsDevice);

        this.ssaoScript = ssaoScript;
        this.needsDepthBuffer = true;

        const fSsao = [
            pc.ShaderChunks.get(graphicsDevice, pc.SHADERLANGUAGE_GLSL).get('screenDepthPS'),
            '',
            'varying vec2 vUv0;',
            '',
            'uniform vec4 uResolution;',
            'uniform float uAspect;',
            'uniform mat4 uProjection;',
            'uniform mat4 uInvProjection;',
            'uniform float uUseInvProjection;',
            'uniform float uNormalReconstructionMode;',
            'uniform float uSsaoNormalDebug;',
            'uniform sampler2D uSsaoNormalBuffer;',
            'uniform float uUseSsaoNormalBuffer;',
            'uniform float uSsaoCurvatureAttenuation;',
            '',
            '#define saturate(x) clamp(x,0.0,1.0)',
            '',
            'const float kSSCTLog2LodRate = 3.0;',
            '',
            'highp float getWFromProjectionMatrix(const mat4 p, const vec3 v) {',
            '    return -v.z;',
            '}',
            '',
            'highp float getViewSpaceZFromW(const mat4 p, const float w) {',
            '    return -w;',
            '}',
            '',
            'const float kLog2LodRate = 3.0;',
            '',
            'vec2 sq(const vec2 a) {',
            '    return a * a;',
            '}',
            '',
            'uniform float uInvFarPlane;',
            '',
            'vec2 pack(highp float depth) {',
            '    highp float z = clamp(depth * uInvFarPlane, 0.0, 1.0);',
            '    highp float t = floor(256.0 * z);',
            '    mediump float hi = t * (1.0 / 256.0);',
            '    mediump float lo = (256.0 * z) - t;',
            '    return vec2(hi, lo);',
            '}',
            '',
            'float random(const highp vec2 w) {',
            '    const vec3 m = vec3(0.06711056, 0.00583715, 52.9829189);',
            '    return fract(m.z * fract(dot(w, m.xy)));',
            '}',
            '',
            'highp vec2 getFragCoord() {',
            '    return gl_FragCoord.xy;',
            '}',
            '',
            'highp vec3 encodeNormal(highp vec3 normal) {',
            '    return normal * 0.5 + 0.5;',
            '}',
            '',
            'highp vec3 decodeNormal(highp vec3 encoded) {',
            '    return normalize(encoded * 2.0 - 1.0);',
            '}',
            '',
            'highp float sampleEyeDepth(highp vec2 uv) {',
            '    return max(getLinearScreenDepth(uv), 0.0);',
            '}',
            '',
            'highp float extrapolateDepth(highp float d1, highp float d2) {',
            '    if (camera_params.w != 0.0) {',
            '        return max(0.0, 2.0 * d1 - d2);',
            '    }',
            '',
            '    highp float denominator = 2.0 * d2 - d1;',
            '    return (d1 * d2) / max(1.0e-6, denominator);',
            '}',
            '',
            'highp vec3 computeViewSpacePositionApprox(highp vec2 uv, highp float eyeDepth) {',
            '    return vec3((uv - 0.5) * vec2(uAspect, 1.0) * eyeDepth, -eyeDepth);',
            '}',
            '',
            'highp float safeDivisor(highp float value) {',
            '    if (abs(value) < 1.0e-6) {',
            '        return value < 0.0 ? -1.0e-6 : 1.0e-6;',
            '    }',
            '',
            '    return value;',
            '}',
            '',
            'highp vec3 computeViewSpacePositionFromDepth(highp vec2 uv, highp float eyeDepth) {',
            '    if (uUseInvProjection < 0.5) {',
            '        return computeViewSpacePositionApprox(uv, eyeDepth);',
            '    }',
            '',
            '    highp vec4 projectedDepth = uProjection * vec4(0.0, 0.0, -eyeDepth, 1.0);',
            '    highp float clipDepth = projectedDepth.z / safeDivisor(projectedDepth.w);',
            '    highp vec4 clip = vec4(uv * 2.0 - 1.0, clipDepth, 1.0);',
            '    highp vec4 view = uInvProjection * clip;',
            '    return view.xyz / safeDivisor(view.w);',
            '}',
            '',
            'highp vec3 sampleViewSpacePosition(highp vec2 uv) {',
            '    return computeViewSpacePositionFromDepth(uv, sampleEyeDepth(uv));',
            '}',
            '',
            'highp vec3 faceNormal(highp vec3 dpdx, highp vec3 dpdy) {',
            '    return normalize(cross(dpdx, dpdy));',
            '}',
            '',
            'highp vec3 computeViewSpaceNormalDerivative(const highp vec3 position) {',
            '    return faceNormal(dFdx(position), dFdy(position));',
            '}',
            '',
            'highp vec3 computeViewSpaceNormalFiveTap(const highp vec3 centerPosition, const highp vec2 uv, const highp float centerDepth) {',
            '    highp vec2 texel = uResolution.zw;',
            '    highp vec2 uvL = uv - vec2(texel.x, 0.0);',
            '    highp vec2 uvR = uv + vec2(texel.x, 0.0);',
            '    highp vec2 uvD = uv - vec2(0.0, texel.y);',
            '    highp vec2 uvU = uv + vec2(0.0, texel.y);',
            '',
            '    highp float dL = sampleEyeDepth(uvL);',
            '    highp float dR = sampleEyeDepth(uvR);',
            '    highp float dD = sampleEyeDepth(uvD);',
            '    highp float dU = sampleEyeDepth(uvU);',
            '',
            '    highp vec3 pL = computeViewSpacePositionFromDepth(uvL, dL);',
            '    highp vec3 pR = computeViewSpacePositionFromDepth(uvR, dR);',
            '    highp vec3 pD = computeViewSpacePositionFromDepth(uvD, dD);',
            '    highp vec3 pU = computeViewSpacePositionFromDepth(uvU, dU);',
            '',
            '    highp vec3 hDeriv = abs(dL - centerDepth) < abs(dR - centerDepth) ? centerPosition - pL : pR - centerPosition;',
            '    highp vec3 vDeriv = abs(dD - centerDepth) < abs(dU - centerDepth) ? centerPosition - pD : pU - centerPosition;',
            '',
            '    return faceNormal(hDeriv, vDeriv);',
            '}',
            '',
            'highp vec3 computeViewSpaceNormalNineTap(const highp vec3 centerPosition, const highp vec2 uv, const highp float centerDepth) {',
            '    highp vec2 texel = uResolution.zw;',
            '    highp vec2 uvL1 = uv - vec2(texel.x, 0.0);',
            '    highp vec2 uvR1 = uv + vec2(texel.x, 0.0);',
            '    highp vec2 uvD1 = uv - vec2(0.0, texel.y);',
            '    highp vec2 uvU1 = uv + vec2(0.0, texel.y);',
            '    highp vec2 uvL2 = uv - vec2(texel.x * 2.0, 0.0);',
            '    highp vec2 uvR2 = uv + vec2(texel.x * 2.0, 0.0);',
            '    highp vec2 uvD2 = uv - vec2(0.0, texel.y * 2.0);',
            '    highp vec2 uvU2 = uv + vec2(0.0, texel.y * 2.0);',
            '',
            '    highp float dL1 = sampleEyeDepth(uvL1);',
            '    highp float dR1 = sampleEyeDepth(uvR1);',
            '    highp float dD1 = sampleEyeDepth(uvD1);',
            '    highp float dU1 = sampleEyeDepth(uvU1);',
            '    highp float dL2 = sampleEyeDepth(uvL2);',
            '    highp float dR2 = sampleEyeDepth(uvR2);',
            '    highp float dD2 = sampleEyeDepth(uvD2);',
            '    highp float dU2 = sampleEyeDepth(uvU2);',
            '',
            '    highp float errL = abs(extrapolateDepth(dL1, dL2) - centerDepth);',
            '    highp float errR = abs(extrapolateDepth(dR1, dR2) - centerDepth);',
            '    highp float errD = abs(extrapolateDepth(dD1, dD2) - centerDepth);',
            '    highp float errU = abs(extrapolateDepth(dU1, dU2) - centerDepth);',
            '',
            '    highp vec3 pL = computeViewSpacePositionFromDepth(uvL1, dL1);',
            '    highp vec3 pR = computeViewSpacePositionFromDepth(uvR1, dR1);',
            '    highp vec3 pD = computeViewSpacePositionFromDepth(uvD1, dD1);',
            '    highp vec3 pU = computeViewSpacePositionFromDepth(uvU1, dU1);',
            '',
            '    highp vec3 hDeriv = errL < errR ? centerPosition - pL : pR - centerPosition;',
            '    highp vec3 vDeriv = errD < errU ? centerPosition - pD : pU - centerPosition;',
            '',
            '    return faceNormal(hDeriv, vDeriv);',
            '}',
            '',
            'highp vec3 computeViewSpaceNormal(const highp vec3 centerPosition, const highp vec2 uv, const highp float centerDepth) {',
            '    if (uUseSsaoNormalBuffer > 0.5) {',
            '        highp vec4 normalSample = texture2D(uSsaoNormalBuffer, uv);',
            '        if (normalSample.a > 0.5) {',
            '            return decodeNormal(normalSample.rgb);',
            '        }',
            '    }',
            '',
            '    if (uNormalReconstructionMode < 0.5) {',
            '        return computeViewSpaceNormalDerivative(centerPosition);',
            '    }',
            '',
            '    if (uNormalReconstructionMode < 1.5) {',
            '        return computeViewSpaceNormalFiveTap(centerPosition, uv, centerDepth);',
            '    }',
            '',
            '    return computeViewSpaceNormalNineTap(centerPosition, uv, centerDepth);',
            '}',
            '',
            'uniform vec2 uSampleCount;',
            'uniform float uSpiralTurns;',
            '',
            '#define PI (3.14159)',
            '',
            'vec3 tapLocation(float i, const float noise) {',
            '    float offset = ((2.0 * PI) * 2.4) * noise;',
            '    float angle = ((i * uSampleCount.y) * uSpiralTurns) * (2.0 * PI) + offset;',
            '    float radius = (i + noise + 0.5) * uSampleCount.y;',
            '    return vec3(cos(angle), sin(angle), radius * radius);',
            '}',
            '',
            'highp vec2 startPosition(const float noise) {',
            '    float angle = ((2.0 * PI) * 2.4) * noise;',
            '    return vec2(cos(angle), sin(angle));',
            '}',
            '',
            'uniform vec2 uAngleIncCosSin;',
            '',
            'highp mat2 tapAngleStep() {',
            '    highp vec2 t = uAngleIncCosSin;',
            '    return mat2(t.x, t.y, -t.y, t.x);',
            '}',
            '',
            'vec3 tapLocationFast(float i, vec2 p, const float noise) {',
            '    float radius = (i + noise + 0.5) * uSampleCount.y;',
            '    return vec3(p, radius * radius);',
            '}',
            '',
            'uniform float uMaxLevel;',
            'uniform float uInvRadiusSquared;',
            'uniform float uMinHorizonAngleSineSquared;',
            'uniform float uBias;',
            'uniform float uPeak2;',
            '',
            'void computeAmbientOcclusionSAO(inout float occlusion, float i, float ssDiskRadius,',
            '        const highp vec2 uv,  const highp vec3 origin, const vec3 normal,',
            '        const vec2 tapPosition, const float noise) {',
            '',
            '    vec3 tap = tapLocationFast(i, tapPosition, noise);',
            '',
            '    float ssRadius = max(1.0, tap.z * ssDiskRadius);',
            '',
            '    vec2 uvSamplePos = uv + vec2(ssRadius * tap.xy) * uResolution.zw;',
            '',
            '    float level = clamp(floor(log2(ssRadius)) - kLog2LodRate, 0.0, float(uMaxLevel));',
            '    highp float occlusionDepth = sampleEyeDepth(uvSamplePos);',
            '    highp vec3 p = computeViewSpacePositionFromDepth(uvSamplePos, occlusionDepth);',
            '',
            '    vec3 v = p - origin;',
            '    float vv = dot(v, v);',
            '    float vn = dot(v, normal);',
            '',
            '    float w = max(0.0, 1.0 - vv * uInvRadiusSquared);',
            '    w = w*w;',
            '',
            '    w *= step(vv * uMinHorizonAngleSineSquared, vn * vn);',
            '',
            '    occlusion += w * max(0.0, vn - uBias) / (vv + uPeak2);',
            '}',
            '',
            'uniform float uProjectionScaleRadius;',
            'uniform float uIntensity;',
            '',
            'float scalableAmbientObscurance(highp vec2 uv, highp vec3 origin, vec3 normal) {',
            '    float noise = random(getFragCoord());',
            '    highp vec2 tapPosition = startPosition(noise);',
            '    highp mat2 angleStep = tapAngleStep();',
            '',
            '    float ssDiskRadius = -(uProjectionScaleRadius / origin.z);',
            '',
            '    float occlusion = 0.0;',
            '    for (float i = 0.0; i < uSampleCount.x; i += 1.0) {',
            '        computeAmbientOcclusionSAO(occlusion, i, ssDiskRadius, uv, origin, normal, tapPosition, noise);',
            '        tapPosition = angleStep * tapPosition;',
            '    }',
            '    return sqrt(occlusion * uIntensity);',
            '}',
            '',
            'uniform float uPower;',
            '',
            'void main() {',
            '    highp vec2 uv = vUv0;',
            '',
            '    highp float depth = sampleEyeDepth(vUv0);',
            '    highp vec3 origin = computeViewSpacePositionFromDepth(uv, depth);',
            '    vec3 normal = computeViewSpaceNormal(origin, uv, depth);',
            '',
            '    if (uSsaoNormalDebug > 0.5) {',
            '        gl_FragColor = vec4(encodeNormal(normal), 1.0);',
            '        return;',
            '    }',
            '',
            '    float occlusion = 0.0;',
            '',
            '    if (uIntensity > 0.0) {',
            '        occlusion = scalableAmbientObscurance(uv, origin, normal);',
            '    }',
            '',
            '    if (uSsaoCurvatureAttenuation > 0.0) {',
            '        float curvature = length(fwidth(normal));',
            '        occlusion *= 1.0 / (1.0 + uSsaoCurvatureAttenuation * curvature);',
            '    }',
            '',
            '    float aoVisibility = pow(saturate(1.0 - occlusion), uPower);',
            '',
            '    vec4 inCol = vec4(1.0, 1.0, 1.0, 1.0);',
            '',
            '    gl_FragColor = vec4(aoVisibility, 0.0, 0.0, 1.0);',
            '}'
        ].join('\n');

        const fNormalSmooth = [
            pc.ShaderChunks.get(graphicsDevice, pc.SHADERLANGUAGE_GLSL).get('screenDepthPS'),
            '',
            'varying vec2 vUv0;',
            '',
            'uniform sampler2D uRawNormalBuffer;',
            'uniform vec4 uResolution;',
            'uniform float uNormalSmoothStrength;',
            'uniform float uNormalSmoothDepthSigma;',
            'uniform float uNormalSmoothNormalCutoff;',
            '',
            'highp vec3 encodeNormal(highp vec3 normal) {',
            '    return normal * 0.5 + 0.5;',
            '}',
            '',
            'highp vec3 decodeNormal(highp vec3 encoded) {',
            '    return normalize(encoded * 2.0 - 1.0);',
            '}',
            '',
            'highp float sampleEyeDepth(highp vec2 uv) {',
            '    return max(getLinearScreenDepth(uv), 0.0);',
            '}',
            '',
            'void main(void) {',
            '    highp vec2 uv = vUv0;',
            '    highp vec3 centerN = decodeNormal(texture2D(uRawNormalBuffer, uv).rgb);',
            '    highp float centerD = sampleEyeDepth(uv);',
            '    highp vec3 acc = vec3(0.0);',
            '    highp float wsum = 0.0;',
            '    highp float depthSigma = max(uNormalSmoothDepthSigma, 1.0e-5);',
            '',
            '    for (int dy = -2; dy <= 2; dy++) {',
            '        for (int dx = -2; dx <= 2; dx++) {',
            '            highp vec2 offset = vec2(float(dx), float(dy)) * uResolution.zw;',
            '            highp vec2 sampleUv = uv + offset;',
            '            highp vec4 sampleNormal = texture2D(uRawNormalBuffer, sampleUv);',
            '            highp vec3 sampleN = decodeNormal(sampleNormal.rgb);',
            '            highp float sampleD = sampleEyeDepth(sampleUv);',
            '            highp float distanceSq = float(dx * dx + dy * dy);',
            '            highp float ws = exp(-distanceSq / 4.5);',
            '            highp float wd = exp(-abs(sampleD - centerD) / depthSigma);',
            '            highp float wn = step(uNormalSmoothNormalCutoff, dot(sampleN, centerN));',
            '            highp float wa = step(0.5, sampleNormal.a);',
            '            highp float w = ws * wd * wn * wa;',
            '            acc += sampleN * w;',
            '            wsum += w;',
            '        }',
            '    }',
            '',
            '    highp vec3 smoothedN = wsum > 1.0e-5 ? normalize(acc / wsum) : centerN;',
            '    highp vec3 outN = normalize(mix(centerN, smoothedN, clamp(uNormalSmoothStrength, 0.0, 1.0)));',
            '    gl_FragColor = vec4(encodeNormal(outN), texture2D(uRawNormalBuffer, uv).a);',
            '}'
        ].join('\n');

        const fblur = [
            pc.ShaderChunks.get(graphicsDevice, pc.SHADERLANGUAGE_GLSL).get('screenDepthPS'),
            '',
            'varying vec2 vUv0;',
            '',
            'uniform sampler2D uSSAOBuffer;',
            'uniform vec4 uResolution;',
            'uniform float uAspect;',
            'uniform int uBilatSampleCount;',
            'uniform float uFarPlaneOverEdgeDistance;',
            'uniform float uBrightness;',
            '',
            'float random(const highp vec2 w) {',
            '    const vec3 m = vec3(0.06711056, 0.00583715, 52.9829189);',
            '    return fract(m.z * fract(dot(w, m.xy)));',
            '}',
            '',
            'float bilateralWeight(in float depth, in float sampleDepth) {',
            '    float diff = (sampleDepth - depth) * uFarPlaneOverEdgeDistance;',
            '    return max(0.0, 1.0 - diff * diff);',
            '}',
            '',
            'void tap(inout float sum, inout float totalWeight, float weight, float depth, vec2 position) {',
            '    float ssao = texture2D( uSSAOBuffer, position ).r;',
            '    float tdepth = -getLinearScreenDepth( position );',
            '',
            '    float bilateral = bilateralWeight(depth, tdepth);',
            '',
            '    bilateral *= weight;',
            '    sum += ssao * bilateral;',
            '    totalWeight += bilateral;',
            '}',
            '',
            'void main() {',
            '    highp vec2 uv = vUv0;',
            '',
            '    float depth = -getLinearScreenDepth(vUv0);',
            '    float totalWeight = 0.0;',
            '    float ssao = texture2D( uSSAOBuffer, vUv0 ).r;',
            '    float sum = ssao * totalWeight;',
            '',
            '    for (int x = -uBilatSampleCount; x <= uBilatSampleCount; x++) {',
            '       for (int y = -uBilatSampleCount; y <= uBilatSampleCount; y++) {',
            '           float weight = 1.0;',
            '           vec2 offset = vec2(x,y)*uResolution.zw;',
            '           tap(sum, totalWeight, weight, depth, uv + offset);',
            '       }',
            '    }',
            '',
            '    float ao = sum / totalWeight;',
            '    ao = mix(ao, 1.0, uBrightness);',
            '    gl_FragColor.a = ao;',
            '}'
        ].join('\n');

        const foutput = [
            'varying vec2 vUv0;',
            'uniform sampler2D uColorBuffer;',
            'uniform sampler2D uSSAOBuffer;',
            'uniform float uSsaoNormalDebug;',
            '',
            'void main(void)',
            '{',
            '    vec4 inCol = texture2D( uColorBuffer, vUv0 );',
            '    float ssao = texture2D( uSSAOBuffer, vUv0 ).a;',
            '',
            '    if (uSsaoNormalDebug > 0.5) {',
            '        gl_FragColor = vec4(texture2D(uSSAOBuffer, vUv0).rgb, inCol.a);',
            '        return;',
            '    }',
            '',
            '    float luma = dot(inCol.rgb, vec3(0.299, 0.587, 0.114));',
            '    float whiteFade = smoothstep(0.78, 0.95, luma);',
            '    float ssaoMod = mix(ssao, 1.0, whiteFade * 0.6);',
            '',
            '    gl_FragColor.rgb = inCol.rgb * ssaoMod;',
            '    gl_FragColor.a = inCol.a;',
            '}'
        ].join('\n');

        const attributes = {
            aPosition: pc.SEMANTIC_POSITION
        };

        this.ssaoShader = pc.ShaderUtils.createShader(graphicsDevice, {
            uniqueName: 'SsaoShader',
            attributes: attributes,
            vertexGLSL: pc.PostEffect.quadVertexShader,
            fragmentGLSL: fSsao
        });

        this.normalSmoothShader = pc.ShaderUtils.createShader(graphicsDevice, {
            uniqueName: 'SsaoNormalSmoothShader',
            attributes: attributes,
            vertexGLSL: pc.PostEffect.quadVertexShader,
            fragmentGLSL: fNormalSmooth
        });

        this.blurShader = pc.ShaderUtils.createShader(graphicsDevice, {
            uniqueName: 'SsaoBlurShader',
            attributes: attributes,
            vertexGLSL: pc.PostEffect.quadVertexShader,
            fragmentGLSL: fblur
        });

        this.outputShader = pc.ShaderUtils.createShader(graphicsDevice, {
            uniqueName: 'SsaoOutputShader',
            attributes: attributes,
            vertexGLSL: pc.PostEffect.quadVertexShader,
            fragmentGLSL: foutput
        });

        // default params
        this.radius = 0.4;
        this.brightness = 0;
        this.samples = 24;
        this.downscale = 1.0;
        this.bias = 0.005;
        this.minHorizonAngle = 0.1;
        this.normalReconstruction = 2;
        this.normalDebug = false;
        this.normalSmoothing = true;
        this.normalSmoothStrength = 1;
        this.normalSmoothDepthSigma = 0.05;
        this.normalSmoothNormalCutoff = 0.5;
        this.curvatureAttenuation = 0;
        this.normalPrepassEnabled = true;
        this.normalPrepassNameIncludes = ['Vessel_'];
        this.normalPrepassRuntime = new SSAONormalPrepassRuntime(ssaoScript?.app, pc, ssaoScript?.entity);

        this.target = null;
        this.blurTarget = null;
        this.smoothNormalTarget = null;
        this.fallbackTexture = createFallbackTexture(graphicsDevice);
        this.normalReconstructionLogFrame = 0;
        this._invProjection = new pc.Mat4();
        this._lastUseInvProjection = false;
        this.width = 0;
        this.height = 0;
    }

    _destroy() {
        if (this.target) {
            this.target.destroyTextureBuffers();
            this.target.destroy();
            this.target = null;
        }

        if (this.blurTarget) {
            this.blurTarget.destroyTextureBuffers();
            this.blurTarget.destroy();
            this.blurTarget = null;
        }

        if (this.smoothNormalTarget) {
            this.smoothNormalTarget.destroyTextureBuffers();
            this.smoothNormalTarget.destroy();
            this.smoothNormalTarget = null;
        }
    }

    _destroyFallbacks() {
        if (this.fallbackTexture) {
            this.fallbackTexture.destroy?.();
            this.fallbackTexture = null;
        }

        this.normalPrepassRuntime?.destroy();
        this.normalPrepassRuntime = null;
    }

    _resize(target) {
        const width = Math.ceil(target.colorBuffer.width / this.downscale);
        const height = Math.ceil(target.colorBuffer.height / this.downscale);

        if (width === this.width && height === this.height) {
            return;
        }

        this.width = width;
        this.height = height;

        this._destroy();

        const ssaoResultBuffer = new pc.Texture(this.device, {
            format: pc.PIXELFORMAT_RGBA8,
            minFilter: pc.FILTER_LINEAR,
            magFilter: pc.FILTER_LINEAR,
            addressU: pc.ADDRESS_CLAMP_TO_EDGE,
            addressV: pc.ADDRESS_CLAMP_TO_EDGE,
            width: this.width,
            height: this.height,
            mipmaps: false
        });
        ssaoResultBuffer.name = 'SSAO Result';
        this.target = new pc.RenderTarget({
            name: 'SSAO Result Render Target',
            colorBuffer: ssaoResultBuffer,
            depth: false
        });

        const ssaoBlurBuffer = new pc.Texture(this.device, {
            format: pc.PIXELFORMAT_RGBA8,
            minFilter: pc.FILTER_LINEAR,
            magFilter: pc.FILTER_LINEAR,
            addressU: pc.ADDRESS_CLAMP_TO_EDGE,
            addressV: pc.ADDRESS_CLAMP_TO_EDGE,
            width: this.width,
            height: this.height,
            mipmaps: false
        });
        ssaoBlurBuffer.name = 'SSAO Blur';
        this.blurTarget = new pc.RenderTarget({
            name: 'SSAO Blur Render Target',
            colorBuffer: ssaoBlurBuffer,
            depth: false
        });

        const smoothNormalBuffer = new pc.Texture(this.device, {
            format: pc.PIXELFORMAT_RGBA8,
            minFilter: pc.FILTER_NEAREST,
            magFilter: pc.FILTER_NEAREST,
            addressU: pc.ADDRESS_CLAMP_TO_EDGE,
            addressV: pc.ADDRESS_CLAMP_TO_EDGE,
            width: this.width,
            height: this.height,
            mipmaps: false
        });
        smoothNormalBuffer.name = 'SSAO Smoothed Normal';
        this.smoothNormalTarget = new pc.RenderTarget({
            name: 'SSAO Smoothed Normal Render Target',
            colorBuffer: smoothNormalBuffer,
            depth: false
        });
    }

    render(inputTarget, outputTarget, rect) {
        this._resize(inputTarget);

        const device = this.device;
        const scope = device.scope;

        const sampleCount = this.samples;
        const spiralTurns = 10.0;
        const step = (1.0 / (sampleCount - 0.5)) * spiralTurns * 2.0 * Math.PI;

        const radius = Math.max(this.radius, 0.0001);
        const bias = this.bias;
        const peak = 0.1 * radius;
        const intensity = (peak * 2.0 * Math.PI) * 0.125;
        const projectionScale = 0.5 * device.height;
        const cameraFarClip = this.ssaoScript.entity.camera.farClip;
        const normalPrepass = this._getNormalPrepass(inputTarget, cameraFarClip);
        const projectionInfo = this._updateProjectionUniforms(scope);
        const useNormalPrepass = !!normalPrepass.enabled && !!normalPrepass.texture;
        const useNormalSmoothing = useNormalPrepass && !!this.normalSmoothing && this.normalSmoothStrength > 0;
        this._writeNormalReconstructionLog(projectionInfo);

        scope.resolve('uAspect').setValue(this.width / this.height);
        scope.resolve('uResolution').setValue([this.width, this.height, 1.0 / this.width, 1.0 / this.height]);
        scope.resolve('uBrightness').setValue(this.brightness);
        scope.resolve('uNormalReconstructionMode').setValue(normalizeNormalReconstructionMode(this.normalReconstruction));

        scope.resolve('uInvFarPlane').setValue(1.0 / cameraFarClip);
        scope.resolve('uSampleCount').setValue([sampleCount, 1.0 / sampleCount]);
        scope.resolve('uSpiralTurns').setValue(spiralTurns);
        scope.resolve('uAngleIncCosSin').setValue([Math.cos(step), Math.sin(step)]);
        scope.resolve('uMaxLevel').setValue(0.0);
        scope.resolve('uInvRadiusSquared').setValue(1.0 / (radius * radius));
        scope.resolve('uMinHorizonAngleSineSquared').setValue(this.minHorizonAngle);
        scope.resolve('uBias').setValue(bias);
        scope.resolve('uPeak2').setValue(peak * peak);
        scope.resolve('uIntensity').setValue(intensity);
        scope.resolve('uPower').setValue(1.0);
        scope.resolve('uProjectionScaleRadius').setValue(projectionScale * radius);
        scope.resolve('uSsaoNormalBuffer').setValue(normalPrepass.texture || this.fallbackTexture);

        if (useNormalPrepass) {
            if (useNormalSmoothing) {
                // pass 1: depth-aware low-pass on interpolated vertex normal buffer
                scope.resolve('uRawNormalBuffer').setValue(normalPrepass.texture);
                scope.resolve('uNormalSmoothStrength').setValue(this.normalSmoothStrength);
                scope.resolve('uNormalSmoothDepthSigma').setValue(this.normalSmoothDepthSigma);
                scope.resolve('uNormalSmoothNormalCutoff').setValue(this.normalSmoothNormalCutoff);
                this.drawQuad(this.smoothNormalTarget, this.normalSmoothShader, rect);

                scope.resolve('uSsaoNormalBuffer').setValue(this.smoothNormalTarget.colorBuffer);
            } else {
                scope.resolve('uSsaoNormalBuffer').setValue(normalPrepass.texture);
            }

            scope.resolve('uUseSsaoNormalBuffer').setValue(1);
        } else {
            scope.resolve('uUseSsaoNormalBuffer').setValue(0);
            scope.resolve('uNormalSmoothStrength').setValue(this.normalSmoothStrength);
            scope.resolve('uNormalSmoothDepthSigma').setValue(this.normalSmoothDepthSigma);
            scope.resolve('uNormalSmoothNormalCutoff').setValue(this.normalSmoothNormalCutoff);
        }

        scope.resolve('uSsaoNormalDebug').setValue(this.normalDebug ? 1 : 0);
        scope.resolve('uSsaoCurvatureAttenuation').setValue(this.curvatureAttenuation);

        // pass 3: SSAO
        this.drawQuad(this.target, this.ssaoShader, rect);

        if (this.normalDebug) {
            scope.resolve('uSSAOBuffer').setValue(this.target.colorBuffer);
            scope.resolve('uColorBuffer').setValue(inputTarget.colorBuffer);
            scope.resolve('uSsaoNormalDebug').setValue(1);
            this.drawQuad(outputTarget, this.outputShader, rect);
            return;
        }

        scope.resolve('uSSAOBuffer').setValue(this.target.colorBuffer);
        scope.resolve('uFarPlaneOverEdgeDistance').setValue(1);
        scope.resolve('uBilatSampleCount').setValue(4);

        // pass 4: blur
        this.drawQuad(this.blurTarget, this.blurShader, rect);

        // pass 5: composite
        scope.resolve('uSSAOBuffer').setValue(this.blurTarget.colorBuffer);
        scope.resolve('uColorBuffer').setValue(inputTarget.colorBuffer);
        scope.resolve('uSsaoNormalDebug').setValue(0);
        this.drawQuad(outputTarget, this.outputShader, rect);
    }

    _updateProjectionUniforms(scope) {
        const projectionMatrix = this._getProjectionMatrix();
        const hasProjectionMatrix = !!(projectionMatrix?.data && this._invProjection?.copy && this._invProjection?.invert);

        if (hasProjectionMatrix) {
            this._invProjection.copy(projectionMatrix);
            this._invProjection.invert();
            scope.resolve('uProjection').setValue(projectionMatrix.data);
            scope.resolve('uInvProjection').setValue(this._invProjection.data);
            scope.resolve('uUseInvProjection').setValue(1);
            this._lastUseInvProjection = true;
            return { useInvProjection: true };
        }

        scope.resolve('uUseInvProjection').setValue(0);
        this._lastUseInvProjection = false;
        return { useInvProjection: false };
    }

    _getProjectionMatrix() {
        const cameraComponent = this.ssaoScript?.entity?.camera;
        const camera = cameraComponent?.camera || cameraComponent?._camera || cameraComponent;

        if (typeof cameraComponent?.getProjectionMatrix === 'function') {
            return cameraComponent.getProjectionMatrix();
        }

        if (typeof camera?.getProjectionMatrix === 'function') {
            return camera.getProjectionMatrix();
        }

        return cameraComponent?.projectionMatrix
            || camera?.projectionMatrix
            || camera?._projectionMatrix
            || camera?._projMat
            || null;
    }

    _writeNormalReconstructionLog(projectionInfo) {
        const targetWindow = typeof window !== 'undefined' ? window : null;

        if (!targetWindow) {
            return;
        }

        const frame = ++this.normalReconstructionLogFrame;

        if (frame !== 1 && frame % 120 !== 0) {
            return;
        }

        targetWindow.__lastSsaoNormalReconstruction = this.inspectNormalReconstruction(projectionInfo);
    }

    inspectNormalReconstruction(projectionInfo = null) {
        const mode = normalizeNormalReconstructionMode(this.normalReconstruction);
        const normalPrepassInfo = this.normalPrepassRuntime?.inspect?.() || null;

        return {
            time: new Date().toISOString(),
            mode,
            modeName: getNormalReconstructionModeName(mode),
            normalDebug: !!this.normalDebug,
            normalSmoothing: !!this.normalSmoothing,
            normalSmoothStrength: this.normalSmoothStrength,
            normalSmoothDepthSigma: this.normalSmoothDepthSigma,
            normalSmoothNormalCutoff: this.normalSmoothNormalCutoff,
            curvatureAttenuation: this.curvatureAttenuation,
            normalPrepassEnabled: !!this.normalPrepassEnabled,
            normalPrepassNameIncludes: this.normalPrepassNameIncludes,
            normalPrepass: normalPrepassInfo,
            useInvProjection: projectionInfo?.useInvProjection ?? this._lastUseInvProjection,
            width: this.width,
            height: this.height,
            expectedDepthSamplesPerPixel: mode < 0.5 ? 1 : (mode < 1.5 ? 5 : 9),
            expectedNormalSmoothSamplesPerPixel: this.normalSmoothing && this.normalSmoothStrength > 0 ? 25 : 0
        };
    }

    _getNormalPrepass(inputTarget, cameraFarClip) {
        if (!this.normalPrepassEnabled || !this.normalPrepassRuntime?.update) {
            return {
                enabled: false,
                texture: null,
                proxyCount: 0
            };
        }

        return this.normalPrepassRuntime.update({
            inputTarget,
            cameraFarClip,
            nameIncludes: this.normalPrepassNameIncludes
        });
    }

}

const SSAO_NORMAL_PREPASS_LAYER_NAME = 'SSAO Normal Prepass';
const SSAO_NORMAL_PREPASS_CAMERA_NAME = '__SSAO_Normal_Prepass_Camera';
const SSAO_NORMAL_PREPASS_PROXY_PREFIX = '__ssao_normal_prepass_proxy__';
const DEFAULT_NORMAL_PREPASS_NAME_INCLUDES = ['Vessel_'];

class SSAONormalPrepassRuntime {
    constructor(app, pcNamespace, sourceCameraEntity) {
        this.app = app;
        this.pc = pcNamespace;
        this.sourceCameraEntity = sourceCameraEntity;
        this.enabled = true;
        this.layer = null;
        this.cameraEntity = null;
        this.renderTarget = null;
        this.texture = null;
        this.material = null;
        this.proxies = [];
        this.width = 0;
        this.height = 0;
        this.frame = 0;
        this.invalidatedFrame = 0;
        this.lastLogFrame = -Infinity;
        this.lastNameIncludesKey = '';
        this.lastMeshSignature = '';
        this.pendingMeshSignature = '';
        this.pendingMeshRecords = null;
        this.pendingSinceFrame = 0;
        this.lastCameraFarClip = null;
        this.preRenderSync = () => {
            if (!this.enabled || !this.cameraEntity) {
                return;
            }

            this.syncCamera(this.lastCameraFarClip);
            this.updateCameraEnabled();
        };

        this.app?.on?.('prerender', this.preRenderSync);
    }

    update(options = {}) {
        this.frame += 1;

        if (!this.enabled || !this.app || !this.pc) {
            return this._disabledResult('disabled');
        }

        this.ensureInfrastructure();
        this.ensureRenderTarget(options.inputTarget);
        this.lastCameraFarClip = Number.isFinite(options.cameraFarClip)
            ? options.cameraFarClip
            : this.lastCameraFarClip;

        const nameIncludes = normalizeNameIncludes(options.nameIncludes);
        const nameIncludesKey = nameIncludes.join('|');
        const shouldScanMeshes = this.proxies.length === 0
            || nameIncludesKey !== this.lastNameIncludesKey
            || this.pendingMeshSignature
            || this.frame % 10 === 1;

        if (shouldScanMeshes) {
            this.syncProxiesForScene(nameIncludes, nameIncludesKey);
        }

        this.syncCamera(options.cameraFarClip);
        this.updateCameraEnabled();
        this.writeLog();

        const ready = !!this.cameraEntity?.enabled && !!this.texture && this.proxies.length > 0 && this.frame > this.invalidatedFrame;

        return {
            enabled: ready,
            texture: this.texture,
            proxyCount: this.proxies.length,
            width: this.width,
            height: this.height
        };
    }

    ensureInfrastructure() {
        this.layer = this.layer || createOrGetNormalPrepassLayer(this.app, this.pc);
        this.material = this.material || createNormalPrepassMaterial(this.app, this.pc);

        if (!this.layer || !this.material || this.cameraEntity) {
            return;
        }

        this.cameraEntity = new this.pc.Entity(SSAO_NORMAL_PREPASS_CAMERA_NAME);
        this.cameraEntity.enabled = false;
        this.app.root.addChild(this.cameraEntity);
        this.cameraEntity.addComponent('camera', {
            layers: [this.layer.id],
            priority: -1000,
            clearColor: new this.pc.Color(0.5, 0.5, 1.0, 0.0),
            clearColorBuffer: true,
            clearDepthBuffer: true,
            clearStencilBuffer: true,
            frustumCulling: true
        });
    }

    ensureRenderTarget(inputTarget) {
        const colorBuffer = inputTarget?.colorBuffer;
        const width = Math.max(1, Math.ceil(colorBuffer?.width || this.app.graphicsDevice?.width || 1));
        const height = Math.max(1, Math.ceil(colorBuffer?.height || this.app.graphicsDevice?.height || 1));

        if (this.renderTarget && this.width === width && this.height === height) {
            return;
        }

        this.destroyRenderTarget();

        this.texture = new this.pc.Texture(this.app.graphicsDevice, {
            name: 'SSAO Vertex Normal',
            width,
            height,
            format: this.pc.PIXELFORMAT_RGBA8 ?? this.pc.PIXELFORMAT_R8_G8_B8_A8,
            minFilter: this.pc.FILTER_NEAREST,
            magFilter: this.pc.FILTER_NEAREST,
            addressU: this.pc.ADDRESS_CLAMP_TO_EDGE,
            addressV: this.pc.ADDRESS_CLAMP_TO_EDGE,
            mipmaps: false
        });

        this.renderTarget = new this.pc.RenderTarget({
            name: 'SSAO Vertex Normal Render Target',
            colorBuffer: this.texture,
            depth: true
        });

        this.width = width;
        this.height = height;
        this.invalidatedFrame = this.frame;

        if (this.cameraEntity?.camera) {
            this.cameraEntity.camera.renderTarget = this.renderTarget;
        }
    }

    syncCamera(cameraFarClip) {
        const sourceEntity = this.sourceCameraEntity;
        const sourceCamera = sourceEntity?.camera;
        const normalCamera = this.cameraEntity?.camera;

        if (!sourceEntity || !sourceCamera || !normalCamera) {
            return;
        }

        this.cameraEntity.setPosition(sourceEntity.getPosition());
        this.cameraEntity.setRotation(sourceEntity.getRotation());

        copyCameraProperty(normalCamera, sourceCamera, 'projection');
        copyCameraProperty(normalCamera, sourceCamera, 'nearClip');
        copyCameraProperty(normalCamera, sourceCamera, 'farClip');
        copyCameraProperty(normalCamera, sourceCamera, 'fov');
        copyCameraProperty(normalCamera, sourceCamera, 'horizontalFov');
        copyCameraProperty(normalCamera, sourceCamera, 'orthoHeight');
        copyCameraProperty(normalCamera, sourceCamera, 'aspectRatio');
        copyCameraProperty(normalCamera, sourceCamera, 'aspectRatioMode');
        copyCameraProperty(normalCamera, sourceCamera, 'rect');
        copyCameraProperty(normalCamera, sourceCamera, 'scissorRect');

        normalCamera.layers = this.layer ? [this.layer.id] : [];
        normalCamera.renderTarget = this.renderTarget;

        if (Number.isFinite(sourceCamera.priority)) {
            normalCamera.priority = sourceCamera.priority - 10;
        }

        if (Number.isFinite(cameraFarClip)) {
            normalCamera.farClip = cameraFarClip;
        }
    }

    rebuildProxies(nameIncludes = DEFAULT_NORMAL_PREPASS_NAME_INCLUDES) {
        const targetEntities = resolveNormalPrepassTargetEntities(this.app?.root, nameIncludes);
        const meshRecords = collectNormalPrepassMeshRecords(targetEntities, getRenderedLayerIds(this.sourceCameraEntity));
        const meshSignature = createNormalPrepassMeshSignature(meshRecords);

        this.rebuildProxiesFromRecords(nameIncludes, meshRecords, meshSignature);
    }

    syncProxiesForScene(nameIncludes, nameIncludesKey) {
        const targetEntities = resolveNormalPrepassTargetEntities(this.app?.root, nameIncludes);
        const meshRecords = collectNormalPrepassMeshRecords(targetEntities, getRenderedLayerIds(this.sourceCameraEntity));
        const meshSignature = createNormalPrepassMeshSignature(meshRecords);
        const needsInitialBuild = this.proxies.length === 0 || nameIncludesKey !== this.lastNameIncludesKey;

        if (needsInitialBuild) {
            this.rebuildProxiesFromRecords(nameIncludes, meshRecords, meshSignature);
            return;
        }

        if (meshSignature === this.lastMeshSignature) {
            this.pendingMeshSignature = '';
            this.pendingMeshRecords = null;
            this.pendingSinceFrame = 0;
            return;
        }

        if (meshSignature !== this.pendingMeshSignature) {
            this.pendingMeshSignature = meshSignature;
            this.pendingMeshRecords = meshRecords;
            this.pendingSinceFrame = this.frame;
            return;
        }

        if (this.frame - this.pendingSinceFrame < 2) {
            return;
        }

        this.rebuildProxiesFromRecords(nameIncludes, this.pendingMeshRecords || meshRecords, meshSignature);
    }

    rebuildProxiesFromRecords(nameIncludes, meshRecords, meshSignature) {
        this.updateCameraEnabled(false);
        this.destroyProxies();
        this.invalidatedFrame = this.frame;
        this.lastNameIncludesKey = normalizeNameIncludes(nameIncludes).join('|');
        this.lastMeshSignature = meshSignature || '';
        this.pendingMeshSignature = '';
        this.pendingMeshRecords = null;
        this.pendingSinceFrame = 0;

        if (!this.layer || !this.material) {
            return;
        }

        for (const record of meshRecords) {
            const mesh = record.meshInstance?.mesh;

            if (!mesh || !record.entity) {
                continue;
            }

            const proxyEntity = new this.pc.Entity(`${SSAO_NORMAL_PREPASS_PROXY_PREFIX}${record.entity.name || 'mesh'}_${record.meshInstanceIndex}`);
            proxyEntity._ssaoNormalPrepassProxy = true;
            proxyEntity.setLocalPosition?.(0, 0, 0);
            proxyEntity.setLocalEulerAngles?.(0, 0, 0);
            proxyEntity.setLocalScale?.(1, 1, 1);

            proxyEntity.addComponent('render', {
                meshInstances: [new this.pc.MeshInstance(mesh, this.material)],
                layers: [this.layer.id]
            });
            proxyEntity.render._ssaoNormalPrepassProxy = true;

            record.entity.addChild(proxyEntity);

            this.proxies.push({
                proxyEntity,
                sourceEntity: record.entity,
                sourceName: record.entity.name || '',
                componentType: record.componentType,
                meshInstanceIndex: record.meshInstanceIndex
            });
        }
    }

    updateCameraEnabled(forceEnabled = null) {
        if (!this.cameraEntity) {
            return;
        }

        this.cameraEntity.enabled = forceEnabled === null
            ? this.enabled && this.proxies.length > 0 && !!this.renderTarget
            : !!forceEnabled;
    }

    inspect() {
        return {
            enabled: !!this.enabled,
            cameraEnabled: !!this.cameraEntity?.enabled,
            layer: this.layer ? { id: this.layer.id, name: this.layer.name } : null,
            renderTarget: this.renderTarget ? {
                name: this.renderTarget.name || null,
                width: this.width,
                height: this.height,
                textureName: this.texture?.name || null
            } : null,
            proxyCount: this.proxies.length,
            lastMeshSignature: this.lastMeshSignature,
            pendingMeshSignature: this.pendingMeshSignature,
            proxies: this.proxies.slice(0, 20).map((proxy) => ({
                source: proxy.sourceName,
                componentType: proxy.componentType,
                meshInstanceIndex: proxy.meshInstanceIndex,
                proxyEnabled: !!proxy.proxyEntity?.enabled
            }))
        };
    }

    writeLog() {
        const targetWindow = typeof window !== 'undefined' ? window : null;

        if (!targetWindow || (this.frame !== 1 && this.frame - this.lastLogFrame < 120)) {
            return;
        }

        this.lastLogFrame = this.frame;
        targetWindow.__lastSsaoNormalPrepass = {
            time: new Date().toISOString(),
            ...this.inspect()
        };
    }

    _disabledResult(reason) {
        return {
            enabled: false,
            texture: null,
            proxyCount: 0,
            reason
        };
    }

    destroyRenderTarget() {
        if (this.renderTarget) {
            this.renderTarget.destroyTextureBuffers?.();
            this.renderTarget.destroy?.();
        }

        this.renderTarget = null;
        this.texture = null;
        this.width = 0;
        this.height = 0;
    }

    destroyProxies() {
        for (const proxy of this.proxies) {
            const proxyEntity = proxy.proxyEntity;
            const meshInstances = proxyEntity?.render?.meshInstances || [];

            if (meshInstances.length > 0) {
                this.removeMeshInstancesFromSceneLayers(meshInstances);
            }

            if (proxyEntity) {
                proxyEntity.enabled = false;
            }

            if (proxyEntity?.render) {
                proxyEntity.render.enabled = false;
            }

            proxyEntity?.destroy?.();
        }

        this.proxies = [];
    }

    removeMeshInstancesFromSceneLayers(meshInstances) {
        const layers = [];
        const seen = new Set();
        const composition = this.app?.scene?.layers;
        const addLayer = (layer) => {
            if (!layer || seen.has(layer)) {
                return;
            }

            seen.add(layer);
            layers.push(layer);
        };

        addLayer(this.layer);

        for (const key of ['layerList', '_layerList', '_layers']) {
            const value = composition?.[key];

            if (Array.isArray(value)) {
                value.forEach(addLayer);
            } else if (value && typeof value === 'object') {
                Object.values(value).forEach(addLayer);
            }
        }

        for (const layer of layers) {
            layer.removeMeshInstances?.(meshInstances);
            layer.removeShadowCasters?.(meshInstances);
        }
    }

    destroy() {
        this.app?.off?.('prerender', this.preRenderSync);
        this.destroyProxies();
        this.destroyRenderTarget();
        this.cameraEntity?.destroy?.();
        this.cameraEntity = null;
        this.material?.destroy?.();
        this.material = null;
    }
}

function createOrGetNormalPrepassLayer(app, pcNamespace) {
    const composition = app?.scene?.layers;

    if (!composition || !pcNamespace?.Layer) {
        return null;
    }

    const existing = composition.getLayerByName?.(SSAO_NORMAL_PREPASS_LAYER_NAME);

    if (existing) {
        return existing;
    }

    const layer = new pcNamespace.Layer({
        name: SSAO_NORMAL_PREPASS_LAYER_NAME,
        enabled: true,
        opaqueSortMode: pcNamespace.SORTMODE_NONE ?? pcNamespace.SORTMODE_MANUAL,
        transparentSortMode: pcNamespace.SORTMODE_NONE ?? pcNamespace.SORTMODE_MANUAL
    });

    if (composition.pushOpaque) {
        composition.pushOpaque(layer);
    } else if (composition.insertOpaque) {
        composition.insertOpaque(layer, 0);
    } else if (composition.push) {
        composition.push(layer);
    }

    return layer;
}

function createNormalPrepassMaterial(app, pcNamespace) {
    if (!pcNamespace?.ShaderMaterial || !app?.graphicsDevice) {
        return null;
    }

    const vertexGLSL = [
        'attribute vec3 aPosition;',
        'attribute vec3 aNormal;',
        '',
        'uniform mat4 matrix_model;',
        'uniform mat4 matrix_view;',
        'uniform mat4 matrix_viewProjection;',
        '',
        'varying highp vec3 vViewNormal;',
        '',
        'void main(void) {',
        '    highp vec4 worldPos = matrix_model * vec4(aPosition, 1.0);',
        '    highp vec3 worldNormal = normalize((matrix_model * vec4(aNormal, 0.0)).xyz);',
        '    vViewNormal = normalize((matrix_view * vec4(worldNormal, 0.0)).xyz);',
        '    gl_Position = matrix_viewProjection * worldPos;',
        '}'
    ].join('\n');

    const fragmentGLSL = [
        'precision highp float;',
        '',
        'varying highp vec3 vViewNormal;',
        '',
        'void main(void) {',
        '    highp vec3 n = normalize(vViewNormal);',
        '    gl_FragColor = vec4(n * 0.5 + 0.5, 1.0);',
        '}'
    ].join('\n');

    const material = new pcNamespace.ShaderMaterial({
        uniqueName: 'SsaoVertexNormalPrepassMaterial',
        attributes: {
            aPosition: pcNamespace.SEMANTIC_POSITION,
            aNormal: pcNamespace.SEMANTIC_NORMAL
        },
        vertexGLSL,
        fragmentGLSL
    });

    material.name = 'SSAO Vertex Normal Prepass Material';
    material.depthTest = true;
    material.depthWrite = true;
    material.cull = pcNamespace.CULLFACE_BACK ?? 1;
    material.blendType = pcNamespace.BLEND_NONE;
    material.update();

    return material;
}

function normalizeNameIncludes(nameIncludes) {
    const values = Array.isArray(nameIncludes) && nameIncludes.length > 0
        ? nameIncludes
        : DEFAULT_NORMAL_PREPASS_NAME_INCLUDES;

    return values
        .map((value) => String(value || '').trim())
        .filter(Boolean);
}

function resolveNormalPrepassTargetEntities(rootEntity, nameIncludes) {
    const lowerIncludes = normalizeNameIncludes(nameIncludes).map((value) => value.toLowerCase());
    const targets = [];

    traverseEntity(rootEntity, (entity) => {
        if (!entity || entity._ssaoNormalPrepassProxy || entity._ssaoLocalMaskProxy) {
            return;
        }

        const name = String(entity.name || '').toLowerCase();

        if (lowerIncludes.some((needle) => name.includes(needle))) {
            targets.push(entity);
        }
    });

    return targets;
}

const NORMAL_PREPASS_EXCLUDED_NAME_INCLUDES = ['boolcut'];

function collectNormalPrepassMeshRecords(targetEntities, renderedLayerIds = null) {
    const records = [];
    const seen = new Set();

    for (const targetEntity of targetEntities) {
        traverseEntity(targetEntity, (entity) => {
            if (!entity || entity._ssaoNormalPrepassProxy || entity._ssaoLocalMaskProxy) {
                return;
            }

            if (!isEntityEnabledInHierarchy(entity)) {
                return;
            }

            // Boolean cutters are service meshes (invisible BoolMat) and must not feed SSAO normals.
            const lowerName = String(entity.name || '').toLowerCase();
            if (NORMAL_PREPASS_EXCLUDED_NAME_INCLUDES.some((needle) => lowerName.includes(needle))) {
                return;
            }

            for (const componentType of ['render', 'model']) {
                const component = entity[componentType];

                if (!component || component.enabled === false || !Array.isArray(component.meshInstances)) {
                    continue;
                }

                // A mesh the main camera does not draw must not cast SSAO either.
                if (!isRenderedByLayers(component, renderedLayerIds)) {
                    continue;
                }

                component.meshInstances.forEach((meshInstance, meshInstanceIndex) => {
                    if (!meshInstance || meshInstance.visible === false || !meshInstance.mesh || seen.has(meshInstance)) {
                        return;
                    }

                    seen.add(meshInstance);
                    records.push({
                        entity,
                        component,
                        componentType,
                        meshInstance,
                        meshInstanceIndex
                    });
                });
            }
        });
    }

    return records;
}

function isRenderedByLayers(component, renderedLayerIds) {
    if (!renderedLayerIds || !Array.isArray(component.layers)) {
        return true;
    }

    return component.layers.some((layerId) => renderedLayerIds.has(layerId));
}

function getRenderedLayerIds(cameraEntity) {
    const layers = cameraEntity?.camera?.layers;
    return Array.isArray(layers) && layers.length > 0 ? new Set(layers) : null;
}

function createNormalPrepassMeshSignature(meshRecords) {
    if (!Array.isArray(meshRecords) || meshRecords.length === 0) {
        return 'empty';
    }

    return meshRecords
        .map((record) => [
            getNormalPrepassEntityPath(record.entity),
            record.componentType,
            record.meshInstanceIndex,
            getNormalPrepassMeshId(record.meshInstance?.mesh)
        ].join(':'))
        .sort()
        .join('|');
}

function getNormalPrepassEntityPath(entity) {
    const parts = [];
    let current = entity;

    while (current) {
        parts.push(current.name || '<unnamed>');
        current = current.parent;
    }

    return parts.reverse().join('/');
}

function getNormalPrepassMeshId(mesh) {
    if (!mesh) {
        return 'missing';
    }

    if (mesh.id !== undefined && mesh.id !== null) {
        return String(mesh.id);
    }

    if (!mesh._ssaoNormalPrepassId) {
        mesh._ssaoNormalPrepassId = Math.random().toString(36).slice(2);
    }

    return mesh._ssaoNormalPrepassId;
}

function traverseEntity(entity, callback) {
    if (!entity) {
        return;
    }

    callback(entity);

    const children = entity.children || [];

    for (const child of children) {
        traverseEntity(child, callback);
    }
}

function isEntityEnabledInHierarchy(entity) {
    let current = entity;

    while (current) {
        if (current.enabled === false) {
            return false;
        }

        current = current.parent;
    }

    return true;
}

function copyCameraProperty(targetCamera, sourceCamera, propertyName) {
    if (!targetCamera || !sourceCamera || !(propertyName in sourceCamera)) {
        return;
    }

    targetCamera[propertyName] = sourceCamera[propertyName];
}

function createFallbackTexture(graphicsDevice) {
    const texture = new pc.Texture(graphicsDevice, {
        width: 1,
        height: 1,
        format: pc.PIXELFORMAT_RGBA8 ?? pc.PIXELFORMAT_R8_G8_B8_A8,
        minFilter: pc.FILTER_NEAREST,
        magFilter: pc.FILTER_NEAREST,
        addressU: pc.ADDRESS_CLAMP_TO_EDGE,
        addressV: pc.ADDRESS_CLAMP_TO_EDGE,
        mipmaps: false
    });

    texture.name = 'SSAO Fallback';

    const pixels = texture.lock();
    pixels.set([0, 0, 0, 0]);
    texture.unlock();

    return texture;
}

function normalizeNormalReconstructionMode(value) {
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();

        if (normalized === 'derivative' || normalized === 'naive' || normalized === 'dfdx' || normalized === '0') {
            return 0;
        }

        if (normalized === 'five' || normalized === 'five-tap' || normalized === '5tap' || normalized === '5-tap' || normalized === '1') {
            return 1;
        }

        if (normalized === 'nine' || normalized === 'nine-tap' || normalized === '9tap' || normalized === '9-tap' || normalized === '2') {
            return 2;
        }
    }

    const mode = Number(value);

    if (!Number.isFinite(mode)) {
        return 2;
    }

    return Math.max(0, Math.min(2, Math.round(mode)));
}

function getNormalReconstructionModeName(mode) {
    if (mode < 0.5) {
        return 'derivative';
    }

    if (mode < 1.5) {
        return 'five-tap';
    }

    return 'nine-tap';
}

function normalizeDebugBoolean(value, defaultValue = true) {
    if (value === undefined || value === null) {
        return defaultValue;
    }

    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        return !(normalized === 'off' || normalized === 'false' || normalized === '0' || normalized === 'disabled');
    }

    return !!value;
}

function normalizeNumber(value, defaultValue, minValue, maxValue) {
    const numberValue = Number(value);
    const resolvedValue = Number.isFinite(numberValue) ? numberValue : defaultValue;

    return Math.max(minValue, Math.min(maxValue, resolvedValue));
}

// ----------------- SCRIPT DEFINITION ------------------ //

var SSAO = pc.createScript('ssao');

SSAO.attributes.add('radius', {
    type: 'number',
    default: 0.4,
    min: 0,
    max: 20,
    title: 'Radius'
});

SSAO.attributes.add('brightness', {
    type: 'number',
    default: 0,
    min: 0,
    max: 1,
    title: 'Brightness'
});

SSAO.attributes.add('samples', {
    type: 'number',
    default: 24,
    min: 1,
    max: 256,
    title: 'Samples'
});

SSAO.attributes.add('bias', {
    type: 'number',
    default: 0.005,
    min: 0,
    max: 0.1,
    title: 'Bias'
});

SSAO.attributes.add('minHorizonAngle', {
    type: 'number',
    default: 0.1,
    min: 0,
    max: 1,
    title: 'Min Horizon Angle'
});

SSAO.attributes.add('downscale', {
    type: 'number',
    default: 1,
    min: 1,
    max: 4,
    title: 'Downscale'
});

SSAO.attributes.add('normalReconstruction', {
    type: 'number',
    default: 2,
    min: 0,
    max: 2,
    title: 'Normal Reconstruction'
});

SSAO.attributes.add('normalDebug', {
    type: 'boolean',
    default: false,
    title: 'Normal Debug'
});

SSAO.attributes.add('normalSmoothing', {
    type: 'boolean',
    default: true,
    title: 'Normal Smoothing'
});

SSAO.attributes.add('normalSmoothStrength', {
    type: 'number',
    default: 1,
    min: 0,
    max: 1,
    title: 'Normal Smooth Strength'
});

SSAO.attributes.add('normalSmoothDepthSigma', {
    type: 'number',
    default: 0.05,
    min: 0.001,
    max: 0.5,
    title: 'Normal Smooth Depth Sigma'
});

SSAO.attributes.add('normalSmoothNormalCutoff', {
    type: 'number',
    default: 0.5,
    min: -1,
    max: 1,
    title: 'Normal Smooth Normal Cutoff'
});

SSAO.attributes.add('curvatureAttenuation', {
    type: 'number',
    default: 0,
    min: 0,
    max: 50,
    title: 'Curvature Attenuation'
});

SSAO.attributes.add('normalPrepassEnabled', {
    type: 'boolean',
    default: true,
    title: 'Normal Prepass'
});

SSAO.prototype.initialize = function () {
    this.effect = new SSAOEffect(this.app.graphicsDevice, this);

    this.radius = this.radius === 4 ? 0.4 : this.radius;
    this.samples = this.samples === 16 || this.samples === 20 ? 24 : this.samples;
    this.bias = Number.isFinite(this.bias) ? this.bias : 0.01;
    this.minHorizonAngle = Number.isFinite(this.minHorizonAngle) ? this.minHorizonAngle : 0.1;
    this.normalReconstruction = normalizeNormalReconstructionMode(this.normalReconstruction);
    this.normalDebug = !!this.normalDebug;
    this.normalSmoothing = !!this.normalSmoothing;
    this.normalSmoothStrength = normalizeNumber(this.normalSmoothStrength, 1, 0, 1);
    this.normalSmoothDepthSigma = normalizeNumber(this.normalSmoothDepthSigma, 0.05, 0.001, 0.5);
    this.normalSmoothNormalCutoff = normalizeNumber(this.normalSmoothNormalCutoff, 0.5, -1, 1);
    this.curvatureAttenuation = normalizeNumber(this.curvatureAttenuation, 0, 0, 50);
    this.normalPrepassEnabled = this.normalPrepassEnabled !== false;

    this.effect.radius = this.radius;
    this.effect.brightness = this.brightness;
    this.effect.samples = this.samples;
    this.effect.downscale = this.downscale;
    this.effect.bias = this.bias;
    this.effect.minHorizonAngle = this.minHorizonAngle;
    this.effect.normalReconstruction = this.normalReconstruction;
    this.effect.normalDebug = this.normalDebug;
    this.effect.normalSmoothing = this.normalSmoothing;
    this.effect.normalSmoothStrength = this.normalSmoothStrength;
    this.effect.normalSmoothDepthSigma = this.normalSmoothDepthSigma;
    this.effect.normalSmoothNormalCutoff = this.normalSmoothNormalCutoff;
    this.effect.curvatureAttenuation = this.curvatureAttenuation;
    this.effect.normalPrepassEnabled = this.normalPrepassEnabled;

    this.on('attr', function (name, value) {
        if (name === 'normalReconstruction') {
            value = normalizeNormalReconstructionMode(value);
        } else if (name === 'normalDebug') {
            value = !!value;
        } else if (name === 'normalSmoothing') {
            value = !!value;
        } else if (name === 'normalSmoothStrength') {
            value = normalizeNumber(value, 1, 0, 1);
        } else if (name === 'normalSmoothDepthSigma') {
            value = normalizeNumber(value, 0.05, 0.001, 0.5);
        } else if (name === 'normalSmoothNormalCutoff') {
            value = normalizeNumber(value, 0.5, -1, 1);
        } else if (name === 'curvatureAttenuation') {
            value = normalizeNumber(value, 0, 0, 50);
        } else if (name === 'normalPrepassEnabled') {
            value = !!value;
        }

        this.effect[name] = value;
    }, this);

    this._registerNormalReconstructionDebug();

    var queue = this.entity.camera.postEffects;
    queue.addEffect(this.effect);

    this.on('state', function (enabled) {
        if (enabled) {
            queue.addEffect(this.effect);
        } else {
            queue.removeEffect(this.effect);
        }
    });

    this.on('destroy', function () {
        queue.removeEffect(this.effect);
        this.effect._destroy();
        this.effect._destroyFallbacks();
    });
};

SSAO.prototype._registerNormalReconstructionDebug = function () {
    const targetWindow = typeof window !== 'undefined' ? window : null;

    if (!targetWindow) {
        return;
    }

    targetWindow.__inspectSsaoNormalReconstruction = () => this.effect.inspectNormalReconstruction();
    targetWindow.__setSsaoNormalReconstruction = (mode) => {
        const normalizedMode = normalizeNormalReconstructionMode(mode);
        this.normalReconstruction = normalizedMode;
        this.effect.normalReconstruction = normalizedMode;
        return this.effect.inspectNormalReconstruction();
    };
    targetWindow.__setSsaoNormalDebug = (enabled = true) => {
        const normalizedEnabled = normalizeDebugBoolean(enabled, true);
        this.normalDebug = normalizedEnabled;
        this.effect.normalDebug = normalizedEnabled;
        return this.effect.inspectNormalReconstruction();
    };
    targetWindow.__setSsaoNormalSmoothing = (settings = true) => {
        if (typeof settings === 'object' && settings !== null) {
            if ('enabled' in settings) {
                this.normalSmoothing = !!settings.enabled;
                this.effect.normalSmoothing = this.normalSmoothing;
            }

            if ('strength' in settings) {
                this.normalSmoothStrength = normalizeNumber(settings.strength, 1, 0, 1);
                this.effect.normalSmoothStrength = this.normalSmoothStrength;
            }

            if ('depthSigma' in settings) {
                this.normalSmoothDepthSigma = normalizeNumber(settings.depthSigma, 0.05, 0.001, 0.5);
                this.effect.normalSmoothDepthSigma = this.normalSmoothDepthSigma;
            }

            if ('normalCutoff' in settings) {
                this.normalSmoothNormalCutoff = normalizeNumber(settings.normalCutoff, 0.5, -1, 1);
                this.effect.normalSmoothNormalCutoff = this.normalSmoothNormalCutoff;
            }
        } else {
            const enabled = normalizeDebugBoolean(settings, true);
            this.normalSmoothing = enabled;
            this.effect.normalSmoothing = enabled;
        }

        return this.effect.inspectNormalReconstruction();
    };
    targetWindow.__setSsaoCurvatureAttenuation = (value = 0) => {
        const attenuation = normalizeNumber(value, 0, 0, 50);
        this.curvatureAttenuation = attenuation;
        this.effect.curvatureAttenuation = attenuation;
        return this.effect.inspectNormalReconstruction();
    };
    targetWindow.__inspectSsaoNormalPrepass = () => this.effect.normalPrepassRuntime?.inspect?.() || null;
    targetWindow.__setSsaoNormalPrepass = (settings = true) => {
        if (typeof settings === 'object' && settings !== null) {
            if ('enabled' in settings) {
                this.normalPrepassEnabled = !!settings.enabled;
                this.effect.normalPrepassEnabled = this.normalPrepassEnabled;
            }

            if ('nameIncludes' in settings) {
                this.effect.normalPrepassNameIncludes = normalizeNameIncludes(settings.nameIncludes);
            }
        } else {
            const enabled = normalizeDebugBoolean(settings, true);
            this.normalPrepassEnabled = enabled;
            this.effect.normalPrepassEnabled = enabled;
        }

        this.effect.normalPrepassRuntime?.rebuildProxies?.(this.effect.normalPrepassNameIncludes);
        return this.effect.inspectNormalReconstruction();
    };
};
