import { COUNTERTOP_VALIDATION_STATE } from './countertop-policy.mjs';

const COUNTERTOP_VALIDATION_EPSILON_M = 0.000001;
const COUNTERTOP_VALIDATION_TARGET = Object.freeze({
    SINK: 'sink',
    SIPHON: 'siphon'
});
const COUNTERTOP_VALIDATION_ISSUE_CODES = Object.freeze({
    SINK_CABINET_COLLISION: 'SINK_CABINET_COLLISION',
    SIPHON_CABINET_COLLISION: 'SIPHON_CABINET_COLLISION',
    MIN_CLEARANCE_VIOLATION: 'MIN_CLEARANCE_VIOLATION',
    VERTICAL_POSITION_INVALID: 'VERTICAL_POSITION_INVALID',
    VALIDATION_PROFILE_MISSING: 'VALIDATION_PROFILE_MISSING',
    REQUIRED_PROXY_MISSING: 'REQUIRED_PROXY_MISSING',
    UNSUPPORTED_PROXY_TRANSFORM: 'UNSUPPORTED_PROXY_TRANSFORM'
});
const AXES = Object.freeze([
    'x',
    'y',
    'z'
]);
const DEFAULT_REQUIRED_TARGETS = Object.freeze({
    [COUNTERTOP_VALIDATION_TARGET.SINK]: true,
    [COUNTERTOP_VALIDATION_TARGET.SIPHON]: true
});
const isObject = (value)=>value !== null && typeof value === 'object';
const finiteNumberOrNull = (value)=>{
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
};
const nonNegativeFiniteNumberOrNull = (value)=>{
    const number = finiteNumberOrNull(value);
    return number !== null && number >= 0 ? number : null;
};
const resolveEpsilonM = (value)=>{
    const epsilon = nonNegativeFiniteNumberOrNull(value);
    return epsilon === null ? COUNTERTOP_VALIDATION_EPSILON_M : epsilon;
};
const stringOrNull = (value)=>{
    if (value === null || value === undefined || value === '') return null;
    return String(value);
};
const freezeIssue = (issue)=>Object.freeze({
        ...issue
    });
const createIssue = (code, details = {})=>{
    const issue = {
        code
    };
    const targetId = stringOrNull(details.targetId);
    const cabinetId = stringOrNull(details.cabinetId);
    const forbiddenVolumeId = stringOrNull(details.forbiddenVolumeId);
    const targetType = stringOrNull(details.targetType);
    const actualM = finiteNumberOrNull(details.actualM);
    const requiredM = finiteNumberOrNull(details.requiredM);
    if (targetId !== null) issue.targetId = targetId;
    if (cabinetId !== null) issue.cabinetId = cabinetId;
    if (forbiddenVolumeId !== null) issue.forbiddenVolumeId = forbiddenVolumeId;
    if (targetType !== null) issue.targetType = targetType;
    if (actualM !== null) issue.actualM = actualM;
    if (requiredM !== null) issue.requiredM = requiredM;
    return freezeIssue(issue);
};
const createResult = (state, issues, metadata = {})=>Object.freeze({
        state,
        issues: Object.freeze(issues.map(freezeIssue)),
        complete: state !== COUNTERTOP_VALIDATION_STATE.UNKNOWN,
        checkedTargets: Object.freeze([
            ...metadata.checkedTargets || []
        ])
    });
const getPoint = (source, primaryKey, fallbackKey)=>source?.[primaryKey] ?? source?.[fallbackKey];
const readFinitePoint3 = (source)=>{
    if (!isObject(source)) return null;
    const point = {};
    for (const axis of AXES){
        const number = finiteNumberOrNull(source[axis]);
        if (number === null) return null;
        point[axis] = number;
    }
    return Object.freeze(point);
};
const hasUnsupportedTransform = (source)=>{
    if (!isObject(source)) return false;
    if (source.axisAligned === false) return true;
    return source.transform !== undefined || source.transformM !== undefined || source.matrix !== undefined || source.matrixM !== undefined || source.rotation !== undefined || source.rotationM !== undefined || source.quaternion !== undefined || source.axes !== undefined;
};
const normalizeVolumeList = (volumes)=>{
    if (volumes === null || volumes === undefined) return [];
    return Array.isArray(volumes) ? volumes : [
        volumes
    ];
};
const normalizeAabbVolumeM = (source, targetType, index, issues)=>{
    if (!isObject(source)) {
        issues.push(createIssue(COUNTERTOP_VALIDATION_ISSUE_CODES.REQUIRED_PROXY_MISSING, {
            targetType
        }));
        return null;
    }
    const explicitType = source.type ?? source.proxyType;
    if (explicitType !== undefined && String(explicitType).toLowerCase() !== 'aabb' || hasUnsupportedTransform(source)) {
        issues.push(createIssue(COUNTERTOP_VALIDATION_ISSUE_CODES.UNSUPPORTED_PROXY_TRANSFORM, {
            targetId: source.targetId ?? source.id,
            cabinetId: source.cabinetId,
            targetType
        }));
        return null;
    }
    const minPoint = readFinitePoint3(getPoint(source, 'minM', 'min'));
    const maxPoint = readFinitePoint3(getPoint(source, 'maxM', 'max'));
    let minM = minPoint;
    let maxM = maxPoint;
    if (!minM || !maxM) {
        const centerM = readFinitePoint3(getPoint(source, 'centerM', 'center'));
        const halfExtentsM = readFinitePoint3(getPoint(source, 'halfExtentsM', 'halfExtents'));
        if (centerM && halfExtentsM && AXES.every((axis)=>halfExtentsM[axis] >= 0)) {
            minM = Object.freeze({
                x: centerM.x - halfExtentsM.x,
                y: centerM.y - halfExtentsM.y,
                z: centerM.z - halfExtentsM.z
            });
            maxM = Object.freeze({
                x: centerM.x + halfExtentsM.x,
                y: centerM.y + halfExtentsM.y,
                z: centerM.z + halfExtentsM.z
            });
        }
    }
    if (!minM || !maxM || !AXES.every((axis)=>minM[axis] <= maxM[axis])) {
        issues.push(createIssue(COUNTERTOP_VALIDATION_ISSUE_CODES.UNSUPPORTED_PROXY_TRANSFORM, {
            targetId: source.targetId ?? source.id,
            cabinetId: source.cabinetId,
            targetType
        }));
        return null;
    }
    const id = stringOrNull(source.id ?? source.targetId) ?? `${targetType || 'volume'}-${index + 1}`;
    return Object.freeze({
        id,
        targetId: stringOrNull(source.targetId) ?? id,
        cabinetId: stringOrNull(source.cabinetId),
        targetType: stringOrNull(targetType),
        minM,
        maxM
    });
};
const readProfileValue = (input, profile, keys)=>{
    for (const key of keys){
        if (input?.[key] !== undefined) return input[key];
        if (profile?.[key] !== undefined) return profile[key];
    }
    return undefined;
};
const hasProfileValue = (input, profile, keys)=>keys.some((key)=>input?.[key] !== undefined || profile?.[key] !== undefined);
const resolveRequiredTargets = (input, profile)=>{
    const required = {
        ...DEFAULT_REQUIRED_TARGETS,
        ...isObject(profile?.requiredTargets) ? profile.requiredTargets : {},
        ...isObject(profile?.requiredProxies) ? profile.requiredProxies : {},
        ...isObject(input?.requiredTargets) ? input.requiredTargets : {},
        ...isObject(input?.requiredProxies) ? input.requiredProxies : {}
    };
    return Object.freeze({
        [COUNTERTOP_VALIDATION_TARGET.SINK]: required[COUNTERTOP_VALIDATION_TARGET.SINK] !== false,
        [COUNTERTOP_VALIDATION_TARGET.SIPHON]: required[COUNTERTOP_VALIDATION_TARGET.SIPHON] !== false
    });
};
const normalizeVolumes = (volumes, targetType, issues)=>normalizeVolumeList(volumes).map((volume, index)=>normalizeAabbVolumeM(volume, targetType, index, issues)).filter(Boolean);
const resolveTargetVolumes = (input, profile, targetType, issues)=>{
    const volumes = targetType === COUNTERTOP_VALIDATION_TARGET.SINK ? readProfileValue(input, profile, [
        'sinkProxies',
        'sinkProxyVolumes',
        'sinkProxy'
    ]) : readProfileValue(input, profile, [
        'siphonProxies',
        'siphonProxyVolumes',
        'siphonProxy'
    ]);
    return normalizeVolumes(volumes, targetType, issues);
};
const resolveForbiddenVolumes = (input, profile, issues)=>{
    const volumes = readProfileValue(input, profile, [
        'forbiddenVolumes',
        'forbiddenCabinetVolumes',
        'cabinetForbiddenVolumes'
    ]);
    return normalizeVolumes(volumes, 'forbidden', issues);
};
const readClearanceForTarget = (source, targetVolume, forbiddenVolume)=>{
    if (source === undefined) return null;
    const direct = nonNegativeFiniteNumberOrNull(source);
    if (direct !== null) return direct;
    if (!isObject(source)) return null;
    const candidates = [
        source[targetVolume.targetId],
        forbiddenVolume.cabinetId === null ? undefined : source[forbiddenVolume.cabinetId],
        source[targetVolume.targetType],
        source.default
    ];
    for (const candidate of candidates){
        const number = nonNegativeFiniteNumberOrNull(candidate);
        if (number !== null) return number;
    }
    return null;
};
const resolveClearanceSource = (input, profile)=>readProfileValue(input, profile, [
        'minimumClearanceM',
        'minClearanceM',
        'minimumClearancesM',
        'minClearancesM'
    ]);
const getAxisSeparationM = (first, second, axis)=>{
    if (first.maxM[axis] < second.minM[axis]) return second.minM[axis] - first.maxM[axis];
    if (second.maxM[axis] < first.minM[axis]) return first.minM[axis] - second.maxM[axis];
    return 0;
};
const calculateAabbGapM = (first, second)=>{
    const dx = getAxisSeparationM(first, second, 'x');
    const dy = getAxisSeparationM(first, second, 'y');
    const dz = getAxisSeparationM(first, second, 'z');
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
};
const calculateAabbPenetrationM = (first, second)=>{
    const overlaps = AXES.map((axis)=>Math.min(first.maxM[axis], second.maxM[axis]) - Math.max(first.minM[axis], second.minM[axis]));
    return Math.min(...overlaps);
};
const aabbVolumesOverlap = (first, second, epsilonM)=>AXES.every((axis)=>first.minM[axis] < second.maxM[axis] - epsilonM && first.maxM[axis] > second.minM[axis] + epsilonM);
const collisionCodeForTarget = (targetType)=>targetType === COUNTERTOP_VALIDATION_TARGET.SIPHON ? COUNTERTOP_VALIDATION_ISSUE_CODES.SIPHON_CABINET_COLLISION : COUNTERTOP_VALIDATION_ISSUE_CODES.SINK_CABINET_COLLISION;
const validateCollisionAndClearance = ({ targetVolumes, forbiddenVolumes, clearanceSource, epsilonM })=>{
    const issues = [];
    for (const targetVolume of targetVolumes){
        for (const forbiddenVolume of forbiddenVolumes){
            const baseDetails = {
                targetId: targetVolume.targetId,
                targetType: targetVolume.targetType,
                cabinetId: forbiddenVolume.cabinetId,
                forbiddenVolumeId: forbiddenVolume.id
            };
            if (aabbVolumesOverlap(targetVolume, forbiddenVolume, epsilonM)) {
                issues.push(createIssue(collisionCodeForTarget(targetVolume.targetType), {
                    ...baseDetails,
                    actualM: -calculateAabbPenetrationM(targetVolume, forbiddenVolume),
                    requiredM: 0
                }));
                continue;
            }
            const requiredM = readClearanceForTarget(clearanceSource, targetVolume, forbiddenVolume);
            if (requiredM === null) {
                issues.push(createIssue(COUNTERTOP_VALIDATION_ISSUE_CODES.VALIDATION_PROFILE_MISSING, {
                    ...baseDetails,
                    requiredM: 0
                }));
                continue;
            }
            const actualM = calculateAabbGapM(targetVolume, forbiddenVolume);
            if (actualM + epsilonM < requiredM) {
                issues.push(createIssue(COUNTERTOP_VALIDATION_ISSUE_CODES.MIN_CLEARANCE_VIOLATION, {
                    ...baseDetails,
                    actualM,
                    requiredM
                }));
            }
        }
    }
    return issues;
};
const normalizeVerticalLimit = (limit)=>{
    if (!isObject(limit)) return null;
    const minYM = finiteNumberOrNull(limit.minYM ?? limit.minY ?? limit.minM);
    const maxYM = finiteNumberOrNull(limit.maxYM ?? limit.maxY ?? limit.maxM);
    if (minYM === null && maxYM === null) return null;
    if (minYM !== null && maxYM !== null && minYM > maxYM) return null;
    return Object.freeze({
        minYM,
        maxYM
    });
};
const resolveVerticalLimit = (source, targetVolume)=>{
    if (source === undefined || source === null) return null;
    const direct = normalizeVerticalLimit(source);
    if (direct) return direct;
    if (!isObject(source)) return null;
    return normalizeVerticalLimit(source[targetVolume.targetId]) ?? normalizeVerticalLimit(source[targetVolume.targetType]) ?? normalizeVerticalLimit(source.default);
};
const validateVerticalLimits = (targetVolumes, verticalLimitsM, epsilonM)=>{
    const issues = [];
    for (const targetVolume of targetVolumes){
        const limit = resolveVerticalLimit(verticalLimitsM, targetVolume);
        if (!limit) continue;
        if (limit.minYM !== null && targetVolume.minM.y + epsilonM < limit.minYM) {
            issues.push(createIssue(COUNTERTOP_VALIDATION_ISSUE_CODES.VERTICAL_POSITION_INVALID, {
                targetId: targetVolume.targetId,
                targetType: targetVolume.targetType,
                cabinetId: targetVolume.cabinetId,
                actualM: targetVolume.minM.y,
                requiredM: limit.minYM
            }));
        }
        if (limit.maxYM !== null && targetVolume.maxM.y - epsilonM > limit.maxYM) {
            issues.push(createIssue(COUNTERTOP_VALIDATION_ISSUE_CODES.VERTICAL_POSITION_INVALID, {
                targetId: targetVolume.targetId,
                targetType: targetVolume.targetType,
                cabinetId: targetVolume.cabinetId,
                actualM: targetVolume.maxM.y,
                requiredM: limit.maxYM
            }));
        }
    }
    return issues;
};
/**
 * Pure metric validation for countertop sink/siphon proxy volumes.
 *
 * Input data is plain JS, in metres. Volumes must be axis-aligned AABBs, either
 * as minM/maxM or centerM/halfExtentsM. Missing profile/proxies or unsupported
 * proxy transforms return `unknown`; this module never invents production gaps.
 */ function validateCountertopMetricProfile(input = {}) {
    const profile = input?.profile;
    const issues = [];
    const epsilonM = resolveEpsilonM(input?.epsilonM ?? profile?.epsilonM);
    if (!isObject(profile) || profile.complete === false) {
        return createResult(COUNTERTOP_VALIDATION_STATE.UNKNOWN, [
            createIssue(COUNTERTOP_VALIDATION_ISSUE_CODES.VALIDATION_PROFILE_MISSING)
        ]);
    }
    const requiredTargets = resolveRequiredTargets(input, profile);
    if (!hasProfileValue(input, profile, [
        'forbiddenVolumes',
        'forbiddenCabinetVolumes',
        'cabinetForbiddenVolumes'
    ])) {
        return createResult(COUNTERTOP_VALIDATION_STATE.UNKNOWN, [
            createIssue(COUNTERTOP_VALIDATION_ISSUE_CODES.VALIDATION_PROFILE_MISSING, {
                targetId: 'forbiddenVolumes'
            })
        ]);
    }
    const forbiddenVolumes = resolveForbiddenVolumes(input, profile, issues);
    const sinkVolumes = resolveTargetVolumes(input, profile, COUNTERTOP_VALIDATION_TARGET.SINK, issues);
    const siphonVolumes = resolveTargetVolumes(input, profile, COUNTERTOP_VALIDATION_TARGET.SIPHON, issues);
    if (requiredTargets.sink && sinkVolumes.length === 0) {
        issues.push(createIssue(COUNTERTOP_VALIDATION_ISSUE_CODES.REQUIRED_PROXY_MISSING, {
            targetType: COUNTERTOP_VALIDATION_TARGET.SINK
        }));
    }
    if (requiredTargets.siphon && siphonVolumes.length === 0) {
        issues.push(createIssue(COUNTERTOP_VALIDATION_ISSUE_CODES.REQUIRED_PROXY_MISSING, {
            targetType: COUNTERTOP_VALIDATION_TARGET.SIPHON
        }));
    }
    if (issues.length > 0) {
        return createResult(COUNTERTOP_VALIDATION_STATE.UNKNOWN, issues);
    }
    const targetVolumes = Object.freeze([
        ...sinkVolumes,
        ...siphonVolumes
    ]);
    const clearanceSource = resolveClearanceSource(input, profile);
    const verticalLimitsM = readProfileValue(input, profile, [
        'verticalLimitsM',
        'verticalLimits'
    ]);
    const validationIssues = [
        ...validateCollisionAndClearance({
            targetVolumes,
            forbiddenVolumes,
            clearanceSource,
            epsilonM
        }),
        ...validateVerticalLimits(targetVolumes, verticalLimitsM, epsilonM)
    ];
    if (validationIssues.some((issue)=>issue.code === COUNTERTOP_VALIDATION_ISSUE_CODES.VALIDATION_PROFILE_MISSING)) {
        return createResult(COUNTERTOP_VALIDATION_STATE.UNKNOWN, validationIssues);
    }
    return createResult(validationIssues.length > 0 ? COUNTERTOP_VALIDATION_STATE.INVALID : COUNTERTOP_VALIDATION_STATE.VALID, validationIssues, {
        checkedTargets: targetVolumes.map((volume)=>volume.targetId)
    });
}
const validateCountertopMetricVolumes = validateCountertopMetricProfile;

export { COUNTERTOP_VALIDATION_EPSILON_M, COUNTERTOP_VALIDATION_ISSUE_CODES, COUNTERTOP_VALIDATION_TARGET, validateCountertopMetricProfile, validateCountertopMetricVolumes };
