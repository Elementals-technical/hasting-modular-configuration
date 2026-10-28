import { metersToInches } from './countertop-units.mjs';
import { calculateCountertopCanMoveM, normalizeCountertopMovementBoundsM, normalizeCountertopMovementGridM } from './countertop-movement-policy.mjs';
import { resolveCountertopLayoutMode, calculateCountertopEffectivePositionM, calculateCountertopEffectiveLengthM, resolveCountertopReadiness, COUNTERTOP_READINESS, COUNTERTOP_LAYOUT_MODE, COUNTERTOP_SCHEMA_VERSION, calculateCountertopAttachmentStateM, resolveCountertopInteractionState, resolveCountertopValidationState } from './countertop-policy.mjs';
export { COUNTERTOP_ATTACHMENT_STATE, COUNTERTOP_INTERACTION_STATE, COUNTERTOP_VALIDATION_STATE } from './countertop-policy.mjs';

const PUBLIC_UNIT_INCH = 'inch';
const finiteNumberOrNull = (value)=>{
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
};
const finitePositiveNumberOrNull = (value)=>{
    const number = finiteNumberOrNull(value);
    return number !== null && number > 0 ? number : null;
};
const finiteNumberOrDefault = (value, fallback)=>{
    const number = finiteNumberOrNull(value);
    return number === null ? fallback : number;
};
const stringOrNull = (value)=>{
    if (value === null || value === undefined || value === '') return null;
    return String(value);
};
const hasOwn = (object, key)=>Boolean(object) && Object.prototype.hasOwnProperty.call(object, key);
const createInvalidMovementBoundsError = ()=>{
    const error = new TypeError('movementBoundsM must be an object with optional canonical x/y { min, max } bounds');
    error.code = 'COUNTERTOP_INVALID_MOVEMENT_BOUNDS';
    return error;
};
const createInvalidMovementGridError = ()=>{
    const error = new TypeError('movementGridM must be an object with optional positive finite x/y grid sizes');
    error.code = 'COUNTERTOP_INVALID_MOVEMENT_GRID';
    return error;
};
const freezePoint2M = (point)=>{
    const source = point || {};
    return Object.freeze({
        x: finiteNumberOrDefault(source.x, 0),
        y: finiteNumberOrDefault(source.y, 0)
    });
};
const freezePoint3M = (point)=>{
    if (!point) return null;
    const x = finiteNumberOrNull(point.x);
    const y = finiteNumberOrNull(point.y);
    const z = finiteNumberOrNull(point.z);
    if (x === null || y === null || z === null) return null;
    return Object.freeze({
        x,
        y,
        z
    });
};
const freezeSizeM = (effectiveLengthM, sizeM)=>{
    const source = sizeM || {};
    return Object.freeze({
        length: effectiveLengthM,
        depth: finitePositiveNumberOrNull(source.depth)
    });
};
const freezeValidationIssueM = (issue = {})=>{
    const snapshot = {
        code: String(issue.code ?? 'UNKNOWN')
    };
    if (issue.targetId !== undefined) snapshot.targetId = String(issue.targetId);
    if (issue.cabinetId !== undefined) snapshot.cabinetId = String(issue.cabinetId);
    const actualM = finiteNumberOrNull(issue.actualM);
    const requiredM = finiteNumberOrNull(issue.requiredM);
    if (actualM !== null) snapshot.actualM = actualM;
    if (requiredM !== null) snapshot.requiredM = requiredM;
    return Object.freeze(snapshot);
};
const freezeValidationM = (validation)=>{
    const source = validation || {};
    return Object.freeze({
        state: resolveCountertopValidationState(source.state),
        issues: Object.freeze((source.issues || []).map(freezeValidationIssueM))
    });
};
const freezeMovementBoundsM = (movementBoundsM, options = {})=>{
    const boundsM = normalizeCountertopMovementBoundsM(movementBoundsM);
    if (boundsM === null || options.explicit && (movementBoundsM === null || movementBoundsM === undefined || typeof movementBoundsM !== 'object' || Array.isArray(movementBoundsM))) {
        throw createInvalidMovementBoundsError();
    }
    if (!boundsM || Object.keys(boundsM).length === 0) {
        return Object.freeze({});
    }
    return Object.freeze({
        ...boundsM.x ? {
            x: Object.freeze({
                ...boundsM.x
            })
        } : {},
        ...boundsM.y ? {
            y: Object.freeze({
                ...boundsM.y
            })
        } : {}
    });
};
const freezeMovementGridM = (movementGridM, options = {})=>{
    const gridM = normalizeCountertopMovementGridM(movementGridM);
    if (gridM === null || options.explicit && (movementGridM === null || movementGridM === undefined || typeof movementGridM !== 'object' || Array.isArray(movementGridM))) {
        throw createInvalidMovementGridError();
    }
    if (!gridM || Object.keys(gridM).length === 0) {
        return Object.freeze({});
    }
    return Object.freeze({
        ...gridM.x ? {
            x: gridM.x
        } : {},
        ...gridM.y ? {
            y: gridM.y
        } : {}
    });
};
const freezeCanMove = (canMove)=>Object.freeze({
        left: Boolean(canMove?.left),
        right: Boolean(canMove?.right),
        up: Boolean(canMove?.up),
        down: Boolean(canMove?.down)
    });
const freezePublicPoint2In = (pointM)=>Object.freeze({
        x: metersToInches(pointM.x),
        y: metersToInches(pointM.y)
    });
const freezePublicPoint3In = (pointM)=>{
    if (!pointM) return null;
    return Object.freeze({
        x: metersToInches(pointM.x),
        y: metersToInches(pointM.y),
        z: metersToInches(pointM.z)
    });
};
const metersToNullableInches = (valueM)=>valueM === null || valueM === undefined ? null : metersToInches(valueM);
const freezePublicValidationIssue = (issueM)=>{
    const snapshot = {
        code: issueM.code
    };
    if (issueM.targetId !== undefined) snapshot.targetId = issueM.targetId;
    if (issueM.cabinetId !== undefined) snapshot.cabinetId = issueM.cabinetId;
    if (issueM.actualM !== undefined) snapshot.actual = metersToInches(issueM.actualM);
    if (issueM.requiredM !== undefined) snapshot.required = metersToInches(issueM.requiredM);
    return Object.freeze(snapshot);
};
const stateComparable = (state)=>JSON.stringify({
        schemaVersion: state.schemaVersion,
        compositionId: state.compositionId,
        productId: state.productId,
        readiness: state.readiness,
        layoutMode: state.layoutMode,
        interactionState: state.interactionState,
        attachmentState: state.attachmentState,
        basePositionM: state.basePositionM,
        baseLengthM: state.baseLengthM,
        offsetM: state.offsetM,
        movementBoundsM: state.movementBoundsM,
        movementGridM: state.movementGridM,
        canMove: state.canMove,
        customLengthM: state.customLengthM,
        positionM: state.positionM,
        sizeM: state.sizeM,
        thicknessM: state.thicknessM,
        validation: state.validation
    });
function createCountertopStateM(input = {}) {
    const source = input || {};
    const layoutMode = resolveCountertopLayoutMode(source.layoutMode);
    const basePositionM = freezePoint3M(source.basePositionM);
    const baseLengthM = finitePositiveNumberOrNull(source.baseLengthM ?? source.sizeM?.length);
    const offsetM = freezePoint2M(source.offsetM);
    const customLengthM = source.customLengthM === null || source.customLengthM === undefined ? null : finitePositiveNumberOrNull(source.customLengthM);
    const effectivePositionM = calculateCountertopEffectivePositionM(layoutMode, basePositionM, offsetM);
    const effectiveLengthM = calculateCountertopEffectiveLengthM(layoutMode, baseLengthM, customLengthM);
    const readiness = resolveCountertopReadiness(source.readiness);
    const movementBoundsM = freezeMovementBoundsM(source.movementBoundsM, {
        explicit: hasOwn(source, 'movementBoundsM')
    });
    const movementGridM = freezeMovementGridM(source.movementGridM, {
        explicit: hasOwn(source, 'movementGridM')
    });
    const canMove = freezeCanMove(calculateCountertopCanMoveM({
        currentOffsetM: offsetM,
        movementBoundsM,
        enabled: readiness === COUNTERTOP_READINESS.READY && layoutMode === COUNTERTOP_LAYOUT_MODE.DRAG
    }));
    return Object.freeze({
        schemaVersion: COUNTERTOP_SCHEMA_VERSION,
        compositionId: stringOrNull(source.compositionId),
        productId: stringOrNull(source.productId),
        readiness,
        revision: Math.max(0, Math.floor(finiteNumberOrDefault(source.revision, 0))),
        layoutMode,
        interactionState: resolveCountertopInteractionState(source.interactionState),
        attachmentState: calculateCountertopAttachmentStateM(layoutMode, offsetM),
        basePositionM,
        baseLengthM,
        offsetM,
        movementBoundsM,
        movementGridM,
        canMove,
        customLengthM,
        positionM: effectivePositionM ? Object.freeze(effectivePositionM) : null,
        sizeM: freezeSizeM(effectiveLengthM, source.sizeM),
        thicknessM: finitePositiveNumberOrNull(source.thicknessM),
        validation: freezeValidationM(source.validation)
    });
}
function updateCountertopStateM(stateM, changes = {}) {
    const current = createCountertopStateM(stateM);
    const candidate = createCountertopStateM({
        ...current,
        ...changes || {},
        revision: current.revision
    });
    if (stateComparable(candidate) === stateComparable(current)) {
        return current;
    }
    return createCountertopStateM({
        ...candidate,
        revision: current.revision + 1
    });
}
function setCountertopLayoutModeM(stateM, layoutMode) {
    return updateCountertopStateM(stateM, {
        layoutMode
    });
}
function setCountertopOffsetM(stateM, offsetM) {
    return updateCountertopStateM(stateM, {
        offsetM
    });
}
function setCountertopMovementBoundsM(stateM, movementBoundsM) {
    freezeMovementBoundsM(movementBoundsM, {
        explicit: true
    });
    return updateCountertopStateM(stateM, {
        movementBoundsM
    });
}
function setCountertopMovementGridM(stateM, movementGridM) {
    freezeMovementGridM(movementGridM, {
        explicit: true
    });
    return updateCountertopStateM(stateM, {
        movementGridM
    });
}
function setCountertopLengthM(stateM, customLengthM) {
    return updateCountertopStateM(stateM, {
        customLengthM
    });
}
function createCountertopPublicSnapshot(stateM, metadata = {}) {
    const state = createCountertopStateM(stateM);
    const snapshotMetadata = metadata || {};
    return Object.freeze({
        schemaVersion: state.schemaVersion,
        compositionId: state.compositionId,
        productId: state.productId,
        readiness: state.readiness,
        revision: state.revision,
        layoutMode: state.layoutMode,
        interactionState: state.interactionState,
        attachmentState: state.attachmentState,
        position: freezePublicPoint3In(state.positionM),
        offset: freezePublicPoint2In(state.offsetM),
        canMove: freezeCanMove(state.canMove),
        size: Object.freeze({
            length: metersToNullableInches(state.sizeM.length),
            depth: metersToNullableInches(state.sizeM.depth)
        }),
        thickness: metersToNullableInches(state.thicknessM),
        customLength: metersToNullableInches(state.customLengthM),
        unit: PUBLIC_UNIT_INCH,
        validation: Object.freeze({
            state: state.validation.state,
            issues: Object.freeze(state.validation.issues.map(freezePublicValidationIssue))
        }),
        phase: snapshotMetadata.phase || 'current',
        source: snapshotMetadata.source || 'state'
    });
}

export { COUNTERTOP_LAYOUT_MODE, COUNTERTOP_READINESS, COUNTERTOP_SCHEMA_VERSION, createCountertopPublicSnapshot, createCountertopStateM, setCountertopLayoutModeM, setCountertopLengthM, setCountertopMovementBoundsM, setCountertopMovementGridM, setCountertopOffsetM, updateCountertopStateM };
