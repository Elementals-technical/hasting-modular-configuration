export const COUNTERTOP_FILLER_EPSILON_M = 0.000001;

export const COUNTERTOP_FILLER_PLAN_STATUS = Object.freeze({
    READY: 'ready',
    UNSUPPORTED: 'unsupported'
});

export const COUNTERTOP_FILLER_SEGMENT_KIND = Object.freeze({
    HORIZONTAL_TOP: 'horizontal-top',
    VERTICAL_GAP: 'vertical-gap'
});

export const COUNTERTOP_FILLER_SEGMENT_AXIS = Object.freeze({
    X: 'x',
    Y: 'y',
    Z: 'z'
});

export const COUNTERTOP_FILLER_DIAGNOSTIC_CODE = Object.freeze({
    FILLER_PROFILE_MISSING: 'FILLER_PROFILE_MISSING',
    FILLER_PROFILE_UNSUPPORTED: 'FILLER_PROFILE_UNSUPPORTED',
    COUNTERTOP_FOOTPRINT_MISSING: 'COUNTERTOP_FOOTPRINT_MISSING',
    CABINET_BOUNDS_MISSING: 'CABINET_BOUNDS_MISSING',
    LOWER_THAN_CABINET_UNSUPPORTED: 'LOWER_THAN_CABINET_UNSUPPORTED'
});

const AXES_3D = Object.freeze(['x', 'y', 'z']);
const PROFILE_UNIT_METERS = Object.freeze(['m', 'meter', 'meters']);

const isObject = (value) => value !== null && typeof value === 'object';

const finiteNumberOrNull = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
};

const nonNegativeFiniteNumberOrNull = (value) => {
    const number = finiteNumberOrNull(value);
    return number !== null && number >= 0 ? number : null;
};

const positiveFiniteNumberOrNull = (value) => {
    const number = finiteNumberOrNull(value);
    return number !== null && number > 0 ? number : null;
};

const stringOrNull = (value) => {
    if (value === null || value === undefined || value === '') return null;
    return String(value);
};

const resolveEpsilonM = (value) => {
    const epsilon = nonNegativeFiniteNumberOrNull(value);
    return epsilon === null ? COUNTERTOP_FILLER_EPSILON_M : epsilon;
};

const freezeDiagnostic = (code, details = {}) => Object.freeze({
    code,
    ...Object.fromEntries(Object.entries(details).filter(([, value]) => value !== undefined))
});

const freezePoint3 = (point) => Object.freeze({
    x: point.x,
    y: point.y,
    z: point.z
});

const freezeBounds = (bounds) => Object.freeze({
    minM: freezePoint3(bounds.minM),
    maxM: freezePoint3(bounds.maxM)
});

const readPoint3M = (source) => {
    if (!isObject(source)) return null;

    const point = {};
    for (const axis of AXES_3D) {
        const number = finiteNumberOrNull(source[axis]);
        if (number === null) return null;
        point[axis] = number;
    }

    return point;
};

const readBoundsCandidate = (source) => {
    if (!isObject(source)) return null;

    const minPoint = readPoint3M(source.minM ?? source.min);
    const maxPoint = readPoint3M(source.maxM ?? source.max);
    if (minPoint && maxPoint) {
        return { minM: minPoint, maxM: maxPoint };
    }

    const center = readPoint3M(source.centerM ?? source.center);
    const halfExtents = readPoint3M(source.halfExtentsM ?? source.halfExtents);
    if (!center || !halfExtents || AXES_3D.some(axis => halfExtents[axis] < 0)) {
        return null;
    }

    return {
        minM: {
            x: center.x - halfExtents.x,
            y: center.y - halfExtents.y,
            z: center.z - halfExtents.z
        },
        maxM: {
            x: center.x + halfExtents.x,
            y: center.y + halfExtents.y,
            z: center.z + halfExtents.z
        }
    };
};

const normalizeBoundsM = (source) => {
    const bounds = readBoundsCandidate(source);
    if (!bounds || AXES_3D.some(axis => bounds.minM[axis] > bounds.maxM[axis])) {
        return null;
    }

    return freezeBounds(bounds);
};

const readCabinetBoundsM = (cabinet, keys) => {
    for (const key of keys) {
        const bounds = normalizeBoundsM(cabinet?.[key]);
        if (bounds) return bounds;
    }

    return null;
};

const normalizeCountertopBoundsM = (input) => normalizeBoundsM(
    input?.countertopBoundsM
        ?? input?.effectiveCountertopBoundsM
        ?? input?.countertopFootprintM
        ?? input?.effectiveCountertopFootprintM
        ?? input?.countertop
        ?? input?.effectiveCountertop
);

const normalizeCabinet = (cabinet, index) => {
    const cabinetId = stringOrNull(cabinet?.cabinetId ?? cabinet?.id) ?? `cabinet-${index + 1}`;
    const topBoundsM = readCabinetBoundsM(cabinet, [
        'topBoundsM',
        'cabinetTopBoundsM',
        'supportTopBoundsM',
        'supportBoundsM',
        'boundsM',
        'bounds'
    ]);
    const supportBoundsM = readCabinetBoundsM(cabinet, [
        'supportBoundsM',
        'cabinetSupportBoundsM',
        'boundsM',
        'bounds',
        'topBoundsM',
        'cabinetTopBoundsM'
    ]);

    if (!topBoundsM || !supportBoundsM) {
        return {
            cabinetId,
            supported: false,
            topBoundsM,
            supportBoundsM
        };
    }

    return Object.freeze({
        cabinetId,
        supported: true,
        topBoundsM,
        supportBoundsM
    });
};

const normalizeCabinets = (input) => {
    const cabinets = input?.cabinets
        ?? input?.cabinetBounds
        ?? input?.cabinetBoundsM
        ?? [];

    if (!Array.isArray(cabinets)) return [];

    return cabinets.map(normalizeCabinet);
};

const resolveProfile = (profile) => {
    if (!isObject(profile)) {
        return {
            supported: false,
            diagnostics: [freezeDiagnostic(COUNTERTOP_FILLER_DIAGNOSTIC_CODE.FILLER_PROFILE_MISSING)]
        };
    }

    const unit = stringOrNull(profile.unit ?? profile.units ?? profile.unitM);
    if (unit !== null && !PROFILE_UNIT_METERS.includes(unit.toLowerCase())) {
        return {
            supported: false,
            diagnostics: [freezeDiagnostic(COUNTERTOP_FILLER_DIAGNOSTIC_CODE.FILLER_PROFILE_UNSUPPORTED, {
                field: 'unit',
                actual: unit
            })]
        };
    }

    const minimumSegmentM = positiveFiniteNumberOrNull(
        profile.minimumSegmentM
            ?? profile.minSegmentM
            ?? profile.minimumCoverageM
            ?? profile.minCoverageM
    ) ?? 0;
    const horizontalTopPolicy = profile.horizontalTop
        ?? profile.horizontalExposedTop
        ?? profile.coverHorizontalExposedTops
        ?? true;
    const verticalGapPolicy = profile.verticalGap
        ?? profile.verticalGapClosure
        ?? profile.coverVerticalGap
        ?? true;
    const lowerThanCabinet = String(
        (isObject(verticalGapPolicy) ? verticalGapPolicy.lowerThanCabinet : undefined)
            ?? profile.lowerThanCabinet
            ?? 'unsupported'
    );

    return {
        supported: true,
        profile: Object.freeze({
            id: stringOrNull(profile.profileId ?? profile.id ?? profile.name),
            coverHorizontalTops: horizontalTopPolicy !== false,
            coverVerticalGaps: verticalGapPolicy !== false,
            lowerThanCabinet,
            minimumSegmentM
        }),
        diagnostics: []
    };
};

const makeRectFromBounds = (boundsM) => Object.freeze({
    minX: boundsM.minM.x,
    maxX: boundsM.maxM.x,
    minZ: boundsM.minM.z,
    maxZ: boundsM.maxM.z
});

const intersectRect = (a, b, epsilonM) => {
    const rect = {
        minX: Math.max(a.minX, b.minX),
        maxX: Math.min(a.maxX, b.maxX),
        minZ: Math.max(a.minZ, b.minZ),
        maxZ: Math.min(a.maxZ, b.maxZ)
    };

    return rect.maxX - rect.minX > epsilonM && rect.maxZ - rect.minZ > epsilonM
        ? Object.freeze(rect)
        : null;
};

const rectWidthX = (rect) => rect.maxX - rect.minX;
const rectDepthZ = (rect) => rect.maxZ - rect.minZ;

const segmentLengthPasses = (valueM, epsilonM, minimumSegmentM) => (
    valueM > epsilonM && valueM >= minimumSegmentM
);

const rectangleToHorizontalSegment = ({
    cabinet,
    rect,
    edge,
    axis,
    index,
    yM
}) => Object.freeze({
    id: `${cabinet.cabinetId}:horizontal:${edge}:${index}`,
    kind: COUNTERTOP_FILLER_SEGMENT_KIND.HORIZONTAL_TOP,
    ownerCabinetId: cabinet.cabinetId,
    axis,
    edge,
    positionM: Object.freeze({
        x: (rect.minX + rect.maxX) / 2,
        y: yM,
        z: (rect.minZ + rect.maxZ) / 2
    }),
    sizeM: Object.freeze({
        x: rectWidthX(rect),
        y: 0,
        z: rectDepthZ(rect)
    }),
    boundsM: freezeBounds({
        minM: { x: rect.minX, y: yM, z: rect.minZ },
        maxM: { x: rect.maxX, y: yM, z: rect.maxZ }
    })
});

const calculateHorizontalTopSegments = ({
    cabinet,
    countertopRect,
    epsilonM,
    minimumSegmentM
}) => {
    const cabinetRect = makeRectFromBounds(cabinet.topBoundsM);
    const coveredRect = intersectRect(cabinetRect, countertopRect, epsilonM);
    const yM = cabinet.topBoundsM.maxM.y;

    if (!coveredRect) {
        if (
            !segmentLengthPasses(rectWidthX(cabinetRect), epsilonM, minimumSegmentM)
            || !segmentLengthPasses(rectDepthZ(cabinetRect), epsilonM, minimumSegmentM)
        ) {
            return [];
        }

        return [
            rectangleToHorizontalSegment({
                cabinet,
                rect: cabinetRect,
                edge: 'all',
                axis: COUNTERTOP_FILLER_SEGMENT_AXIS.X,
                index: 1,
                yM
            })
        ];
    }

    const candidates = [
        {
            edge: 'left',
            axis: COUNTERTOP_FILLER_SEGMENT_AXIS.X,
            rect: {
                minX: cabinetRect.minX,
                maxX: coveredRect.minX,
                minZ: cabinetRect.minZ,
                maxZ: cabinetRect.maxZ
            }
        },
        {
            edge: 'right',
            axis: COUNTERTOP_FILLER_SEGMENT_AXIS.X,
            rect: {
                minX: coveredRect.maxX,
                maxX: cabinetRect.maxX,
                minZ: cabinetRect.minZ,
                maxZ: cabinetRect.maxZ
            }
        },
        {
            edge: 'front',
            axis: COUNTERTOP_FILLER_SEGMENT_AXIS.Z,
            rect: {
                minX: coveredRect.minX,
                maxX: coveredRect.maxX,
                minZ: cabinetRect.minZ,
                maxZ: coveredRect.minZ
            }
        },
        {
            edge: 'back',
            axis: COUNTERTOP_FILLER_SEGMENT_AXIS.Z,
            rect: {
                minX: coveredRect.minX,
                maxX: coveredRect.maxX,
                minZ: coveredRect.maxZ,
                maxZ: cabinetRect.maxZ
            }
        }
    ];

    return candidates
        .filter(({ rect }) => (
            segmentLengthPasses(rectWidthX(rect), epsilonM, minimumSegmentM)
            && segmentLengthPasses(rectDepthZ(rect), epsilonM, minimumSegmentM)
        ))
        .map(({ rect, edge, axis }, index) => rectangleToHorizontalSegment({
            cabinet,
            rect,
            edge,
            axis,
            index: index + 1,
            yM
        }));
};

const intervalsOverlap = (a, b, epsilonM) => (
    Math.max(a.min, b.min) < Math.min(a.max, b.max) - epsilonM
);

const subtractIntervals = (base, covers, epsilonM) => {
    let open = [base];

    for (const cover of covers) {
        const next = [];
        for (const interval of open) {
            const start = Math.max(interval.min, cover.min);
            const end = Math.min(interval.max, cover.max);

            if (end - start <= epsilonM) {
                next.push(interval);
                continue;
            }

            if (start - interval.min > epsilonM) {
                next.push(Object.freeze({ min: interval.min, max: start }));
            }
            if (interval.max - end > epsilonM) {
                next.push(Object.freeze({ min: end, max: interval.max }));
            }
        }
        open = next;
    }

    return open;
};

const collectNeighborCoverIntervals = ({
    cabinet,
    edge,
    cabinets,
    epsilonM
}) => {
    const rect = makeRectFromBounds(cabinet.supportBoundsM);
    const covers = [];

    for (const neighbor of cabinets) {
        if (!neighbor.supported || neighbor.cabinetId === cabinet.cabinetId) continue;

        const neighborRect = makeRectFromBounds(neighbor.supportBoundsM);
        if (edge === 'left' || edge === 'right') {
            const cabinetX = edge === 'left' ? rect.minX : rect.maxX;
            const neighborTouches = edge === 'left'
                ? Math.abs(neighborRect.maxX - cabinetX) <= epsilonM
                : Math.abs(neighborRect.minX - cabinetX) <= epsilonM;

            if (neighborTouches && intervalsOverlap(
                { min: rect.minZ, max: rect.maxZ },
                { min: neighborRect.minZ, max: neighborRect.maxZ },
                epsilonM
            )) {
                covers.push(Object.freeze({
                    min: Math.max(rect.minZ, neighborRect.minZ),
                    max: Math.min(rect.maxZ, neighborRect.maxZ)
                }));
            }
            continue;
        }

        const cabinetZ = edge === 'front' ? rect.minZ : rect.maxZ;
        const neighborTouches = edge === 'front'
            ? Math.abs(neighborRect.maxZ - cabinetZ) <= epsilonM
            : Math.abs(neighborRect.minZ - cabinetZ) <= epsilonM;

        if (neighborTouches && intervalsOverlap(
            { min: rect.minX, max: rect.maxX },
            { min: neighborRect.minX, max: neighborRect.maxX },
            epsilonM
        )) {
            covers.push(Object.freeze({
                min: Math.max(rect.minX, neighborRect.minX),
                max: Math.min(rect.maxX, neighborRect.maxX)
            }));
        }
    }

    return covers;
};

const verticalEdgeToSegment = ({
    cabinet,
    edge,
    interval,
    index,
    gapMinYM,
    gapMaxYM
}) => {
    const rect = makeRectFromBounds(cabinet.supportBoundsM);
    const gapHeightM = gapMaxYM - gapMinYM;
    const isXEdge = edge === 'left' || edge === 'right';
    const xM = edge === 'left' ? rect.minX : rect.maxX;
    const zM = edge === 'front' ? rect.minZ : rect.maxZ;

    return Object.freeze({
        id: `${cabinet.cabinetId}:vertical:${edge}:${index}`,
        kind: COUNTERTOP_FILLER_SEGMENT_KIND.VERTICAL_GAP,
        ownerCabinetId: cabinet.cabinetId,
        axis: COUNTERTOP_FILLER_SEGMENT_AXIS.Y,
        edge,
        edgeAxis: isXEdge ? COUNTERTOP_FILLER_SEGMENT_AXIS.X : COUNTERTOP_FILLER_SEGMENT_AXIS.Z,
        positionM: Object.freeze({
            x: isXEdge ? xM : (interval.min + interval.max) / 2,
            y: gapMinYM + (gapHeightM / 2),
            z: isXEdge ? (interval.min + interval.max) / 2 : zM
        }),
        sizeM: Object.freeze({
            x: isXEdge ? 0 : interval.max - interval.min,
            y: gapHeightM,
            z: isXEdge ? interval.max - interval.min : 0
        })
    });
};

const calculateVerticalGapSegments = ({
    cabinet,
    cabinets,
    countertopBoundsM,
    epsilonM,
    minimumSegmentM
}) => {
    const gapMinYM = cabinet.supportBoundsM.maxM.y;
    const gapMaxYM = countertopBoundsM.minM.y;
    const gapHeightM = gapMaxYM - gapMinYM;

    if (!segmentLengthPasses(gapHeightM, epsilonM, minimumSegmentM)) return [];

    const rect = makeRectFromBounds(cabinet.supportBoundsM);
    const edgeDefinitions = [
        { edge: 'left', interval: Object.freeze({ min: rect.minZ, max: rect.maxZ }) },
        { edge: 'right', interval: Object.freeze({ min: rect.minZ, max: rect.maxZ }) },
        { edge: 'front', interval: Object.freeze({ min: rect.minX, max: rect.maxX }) },
        { edge: 'back', interval: Object.freeze({ min: rect.minX, max: rect.maxX }) }
    ];
    const segments = [];

    for (const definition of edgeDefinitions) {
        const covers = collectNeighborCoverIntervals({
            cabinet,
            edge: definition.edge,
            cabinets,
            epsilonM
        });
        const uncoveredIntervals = subtractIntervals(definition.interval, covers, epsilonM);

        for (const interval of uncoveredIntervals) {
            if (!segmentLengthPasses(interval.max - interval.min, epsilonM, minimumSegmentM)) continue;
            segments.push(verticalEdgeToSegment({
                cabinet,
                edge: definition.edge,
                interval,
                index: segments.length + 1,
                gapMinYM,
                gapMaxYM
            }));
        }
    }

    return segments;
};

const createPlan = ({
    status,
    profileId,
    segments = [],
    diagnostics = []
}) => Object.freeze({
    status,
    supported: status === COUNTERTOP_FILLER_PLAN_STATUS.READY,
    profileId: profileId ?? null,
    segments: Object.freeze(segments),
    diagnostics: Object.freeze(diagnostics)
});

export function calculateCountertopFillerPlanM(input = {}) {
    const source = input || {};
    const profileResult = resolveProfile(
        source.fillerProfileM
            ?? source.fillerProfile
            ?? source.profileM
            ?? source.profile
    );
    const diagnostics = [...profileResult.diagnostics];

    if (!profileResult.supported) {
        return createPlan({
            status: COUNTERTOP_FILLER_PLAN_STATUS.UNSUPPORTED,
            diagnostics
        });
    }

    const epsilonM = resolveEpsilonM(source.epsilonM);
    const cabinets = normalizeCabinets(source);
    const unsupportedCabinets = cabinets.filter(cabinet => !cabinet.supported);
    for (const cabinet of unsupportedCabinets) {
        diagnostics.push(freezeDiagnostic(COUNTERTOP_FILLER_DIAGNOSTIC_CODE.CABINET_BOUNDS_MISSING, {
            cabinetId: cabinet.cabinetId
        }));
    }

    const countertopBoundsM = normalizeCountertopBoundsM(source);
    if (!countertopBoundsM) {
        diagnostics.push(freezeDiagnostic(COUNTERTOP_FILLER_DIAGNOSTIC_CODE.COUNTERTOP_FOOTPRINT_MISSING));
    }

    if (diagnostics.length > 0 || !countertopBoundsM) {
        return createPlan({
            status: COUNTERTOP_FILLER_PLAN_STATUS.UNSUPPORTED,
            profileId: profileResult.profile.id,
            diagnostics
        });
    }

    const profile = profileResult.profile;
    const supportedCabinets = cabinets.filter(cabinet => cabinet.supported);
    const countertopRect = makeRectFromBounds(countertopBoundsM);
    const segments = [];

    if (profile.coverHorizontalTops) {
        for (const cabinet of supportedCabinets) {
            segments.push(...calculateHorizontalTopSegments({
                cabinet,
                countertopRect,
                epsilonM,
                minimumSegmentM: profile.minimumSegmentM
            }));
        }
    }

    if (profile.coverVerticalGaps) {
        for (const cabinet of supportedCabinets) {
            if (countertopBoundsM.minM.y < cabinet.supportBoundsM.maxM.y - epsilonM) {
                if (profile.lowerThanCabinet === 'unsupported') {
                    diagnostics.push(freezeDiagnostic(
                        COUNTERTOP_FILLER_DIAGNOSTIC_CODE.LOWER_THAN_CABINET_UNSUPPORTED,
                        { cabinetId: cabinet.cabinetId }
                    ));
                }
                continue;
            }

            segments.push(...calculateVerticalGapSegments({
                cabinet,
                cabinets: supportedCabinets,
                countertopBoundsM,
                epsilonM,
                minimumSegmentM: profile.minimumSegmentM
            }));
        }
    }

    if (diagnostics.length > 0) {
        return createPlan({
            status: COUNTERTOP_FILLER_PLAN_STATUS.UNSUPPORTED,
            profileId: profile.id,
            diagnostics
        });
    }

    return createPlan({
        status: COUNTERTOP_FILLER_PLAN_STATUS.READY,
        profileId: profile.id,
        segments
    });
}
