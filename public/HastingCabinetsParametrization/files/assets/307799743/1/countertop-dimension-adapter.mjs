import { metersToInches } from '../countertop-units.mjs';
import { syncEntityWorld } from '../../spatial-manipulation/playcanvas/scene-measure.mjs';

const OWNED_LINE_MARKER = '__countertopDimensionOwner';
const OWNED_LINE_OWNER = 'countertop';
const DEFAULT_DECIMALS = 2;
const DEFAULT_OFFSET_M = 0.12;
const ACTIVE_INTERACTION_STATES = Object.freeze(new Set([
    'selected',
    'editing',
    'dragging'
]));
const EXCLUDED_NAME_PARTS = Object.freeze([
    'Sink_Point',
    'SinkPoint',
    'BoolCut',
    'Cutter',
    'cutter',
    'Siphon',
    'siphon',
    'collision',
    'Collision',
    'proxy',
    'Proxy'
]);

const finitePositiveOrNull = value => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
};

const cloneDimensionData = data => ({
    ...(data || {}),
    box: data?.box ? { ...data.box } : data?.box,
    lines: Array.isArray(data?.lines) ? data.lines.map(line => ({ ...line })) : [],
    labelSettings: data?.labelSettings ? { ...data.labelSettings } : data?.labelSettings
});

const removeOwnedLines = data => {
    const clone = cloneDimensionData(data);
    clone.lines = clone.lines.filter(line => line?.[OWNED_LINE_MARKER] !== OWNED_LINE_OWNER);
    return clone;
};

const isExcludedNode = entity => {
    const name = String(entity?.name || '');
    return EXCLUDED_NAME_PARTS.some(part => name.includes(part));
};

/**
 * Read the current world-space AABB of the actual TopSolid mesh only. Sink,
 * siphon, cutter and proxy descendants are intentionally not dimension input.
 */
export function measureCountertopMeshBoundsM(entity) {
    if (!entity?.parent || isExcludedNode(entity)) return null;
    syncEntityWorld(entity);

    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;
    let found = false;

    const visit = node => {
        if (!node?.enabled || isExcludedNode(node)) return;

        const meshInstances = node.render?.meshInstances || node.model?.meshInstances || [];
        for (const meshInstance of meshInstances) {
            if (!meshInstance?.aabb) continue;
            meshInstance._aabbDirty = true;
            const aabb = meshInstance.aabb;
            const center = aabb?.center;
            const half = aabb?.halfExtents;
            if (!center || !half) continue;

            minX = Math.min(minX, center.x - half.x);
            minY = Math.min(minY, center.y - half.y);
            minZ = Math.min(minZ, center.z - half.z);
            maxX = Math.max(maxX, center.x + half.x);
            maxY = Math.max(maxY, center.y + half.y);
            maxZ = Math.max(maxZ, center.z + half.z);
            found = true;
        }

        for (const child of node.children || []) visit(child);
    };
    visit(entity);

    if (!found) return null;
    return Object.freeze({
        min: Object.freeze({ x: minX, y: minY, z: minZ }),
        max: Object.freeze({ x: maxX, y: maxY, z: maxZ }),
        lengthM: maxX - minX,
        depthM: maxZ - minZ,
        thicknessM: maxY - minY
    });
}

const formatInches = (value, decimals = DEFAULT_DECIMALS) => {
    const inches = finitePositiveOrNull(value);
    if (inches === null) return null;

    const precision = Number.isInteger(decimals) && decimals >= 0
        ? Math.min(decimals, 6)
        : DEFAULT_DECIMALS;
    const rounded = Number(inches.toFixed(precision));
    return `${Object.is(rounded, -0) ? 0 : rounded}"`;
};

const formatCentimetres = (valueM, decimals = DEFAULT_DECIMALS) => {
    const metres = finitePositiveOrNull(valueM);
    if (metres === null) return null;

    const precision = Number.isInteger(decimals) && decimals >= 0
        ? Math.min(decimals, 6)
        : DEFAULT_DECIMALS;
    // Number() trims trailing zeros: 165.10 -> "165.1 cm", 60.00 -> "60 cm".
    const rounded = Number((metres * 100).toFixed(precision));
    return `${Object.is(rounded, -0) ? 0 : rounded} cm`;
};

/** Label for a metre value in the base data's units: 'cm' -> centimetres, anything else -> inches. */
const formatOwnedLabel = (valueM, units, decimals) => (
    units === 'cm' ? formatCentimetres(valueM, decimals) : formatInches(metersToInches(valueM), decimals)
);

const toPointArray = point => [point.x, point.y, point.z];

/**
 * Adds two scoped LineDimension entries without assigning countertop semantics
 * to the legacy cabinet Width field. Existing box/line labels remain owned by
 * their callers and are never rewritten by this adapter.
 *
 * - Labels follow `labelSettings.units` of the base data ('cm' -> centimetres, otherwise inches).
 * - The length line sits at `max.y + 2 × offset`, clear of the cabinet width line (`+ offset`).
 * - `setSuppressed(true)` (countertop Drag & Drop: the overlay chips show length / depth) removes
 *   the owned lines and re-renders the base data; `setSuppressed(false)` brings them back.
 */
export class CountertopDimensionAdapter {
    constructor(app, options = {}) {
        this._app = app || null;
        this._service = null;
        this._binding = null;
        this._countertopRoot = null;
        this._countertopMesh = null;
        this._baseData = null;
        this._renderedData = null;
        this._ownedDimensions = [];
        this._unsubscribeService = null;
        this._selected = false;
        this._state = null;
        this._lastLength = null;
        this._pendingGeometry = false;
        this._settleToken = 0;
        this._dirty = false;
        this._updateBound = false;
        this._suppressed = false;
        this._destroyed = false;

        this._onSelectionChanged = () => this._syncSelection();
        this._onUpdate = () => this._flushUpdate();
        this._app?.on?.('selection:change', this._onSelectionChanged, this);
        this._app?.on?.('select-tool:ready', this._onSelectionChanged, this);

        this.bind(options);
    }

    suspendLegacy() {
        if (this._destroyed || this._legacySuspended || this._binding || this._countertopRoot ||
            this._updateBound || this._pendingGeometry) {
            throw Object.assign(new Error('Countertop dimension writer is active'), {code:'LEGACY_WRITERS_BUSY'});
        }
        this._legacySuspended = true;
        this._app?.off?.('selection:change', this._onSelectionChanged, this);
        this._app?.off?.('select-tool:ready', this._onSelectionChanged, this);
        let resumed = false;
        return () => {
            if (resumed) return;
            resumed = true;
            this._legacySuspended = false;
            this._app?.on?.('selection:change', this._onSelectionChanged, this);
            this._app?.on?.('select-tool:ready', this._onSelectionChanged, this);
        };
    }

    /** `source`: the countertop state source (`getState()`, `on('change', ({ state }) => …)`, `whenSettled()`). */
    bind({ source = null, binding = null } = {}) {
        if (this._destroyed) return;

        const countertop = binding?.countertop || binding?.assembly?.countertop || null;
        const nextRoot = countertop?.root || null;
        const nextMesh = countertop?.mesh || nextRoot;
        const targetChanged = nextRoot !== this._countertopRoot || nextMesh !== this._countertopMesh;
        const serviceChanged = source !== this._service;

        if (targetChanged || serviceChanged) {
            this._removeOwnedDimensions();
            this._selected = false;
            this._unbindUpdate();
            this._unsubscribeFromService();
            this._settleToken++;
            this._pendingGeometry = false;
            this._lastLength = null;
        }

        this._service = source || null;
        this._binding = binding || null;
        this._countertopRoot = nextRoot;
        this._countertopMesh = nextMesh;
        this._state = this._readPublicState();
        this._syncSelection();
    }

    showDimensions(data) {
        if (this._destroyed || !this._app?.dimensionSystem) return false;

        this._baseData = removeOwnedLines(data);
        this._renderSelectedData();
        return true;
    }

    hideDimensions({ preserveData = false } = {}) {
        if (this._destroyed) return false;
        this._removeOwnedDimensions();
        this._app?.dimensionSystem?.hideDimensions?.();
        this._renderedData = null;
        if (!preserveData) this._baseData = null;
        return true;
    }

    toggleDimensions() {
        const system = this._app?.dimensionSystem;
        if (!system) return false;
        if (system._visible) return this.hideDimensions({ preserveData: true });
        if (!this._baseData) return false;
        this._renderSelectedData();
        return true;
    }

    /** Called only after SmartStretch/Boolean reports the actual mesh replacement. */
    refreshAfterGeometry() {
        if (this._destroyed) return null;
        this._pendingGeometry = false;
        this._settleToken++;

        const system = this._app?.dimensionSystem;
        if (system?._visible && system._lastData === this._renderedData) {
            this._captureOwnedDimensions();
        }
        this._dirty = true;
        this._flushUpdate({ force: true });
        return this.getStatus();
    }

    getStatus() {
        if (this._app?.dimensionSystem?._lastData === this._renderedData &&
            this._findOwnedDimensions().length === 0) {
            this._captureOwnedDimensions();
        }
        const boundsM = measureCountertopMeshBoundsM(this._countertopMesh);
        const ownedDimensions = this._findOwnedDimensions();
        return Object.freeze({
            selected: this._selected,
            suppressed: this._suppressed,
            visible: Boolean(this._app?.dimensionSystem?._visible),
            unit: 'inch',
            ownedEntries: ownedDimensions.length,
            size: boundsM ? Object.freeze({
                length: metersToInches(boundsM.lengthM),
                depth: metersToInches(boundsM.depthM),
                thickness: metersToInches(boundsM.thicknessM)
            }) : null,
            labels: Object.freeze(ownedDimensions.map(dimension => dimension._labelText)),
            entries: Object.freeze(ownedDimensions.map((dimension, index) => Object.freeze({
                dimension: index === 0 ? 'length' : 'depth',
                label: dimension._labelText,
                start: Object.freeze({
                    x: metersToInches(dimension._startPos.x),
                    y: metersToInches(dimension._startPos.y),
                    z: metersToInches(dimension._startPos.z)
                }),
                end: Object.freeze({
                    x: metersToInches(dimension._endPos.x),
                    y: metersToInches(dimension._endPos.y),
                    z: metersToInches(dimension._endPos.z)
                })
            })))
        });
    }

    /**
     * Hide (true) / restore (false) the countertop-owned lines while the rest of the dimension
     * system stays visible. Idempotent; a no-op after destroy.
     */
    setSuppressed(suppressed) {
        if (typeof suppressed !== 'boolean') throw new TypeError('setSuppressed expects a boolean');
        if (this._destroyed) return false;
        if (suppressed === this._suppressed) return true;
        this._suppressed = suppressed;

        const system = this._app?.dimensionSystem;
        const shown = Boolean(system?._visible && this._baseData && system._lastData === this._renderedData);
        if (suppressed) {
            this._removeOwnedDimensions();
            if (shown) this._renderSelectedData();
        } else if (shown && this._selected) {
            this._renderSelectedData();
        }
        return true;
    }

    isSuppressed() {
        return this._suppressed;
    }

    destroy() {
        if (this._destroyed) return;
        this._destroyed = true;
        this._settleToken++;
        this._unsubscribeFromService();
        this._removeOwnedDimensions();
        this._app?.off?.('selection:change', this._onSelectionChanged, this);
        this._app?.off?.('select-tool:ready', this._onSelectionChanged, this);
        this._unbindUpdate();

        this._service = null;
        this._binding = null;
        this._countertopRoot = null;
        this._countertopMesh = null;
        this._baseData = null;
        this._renderedData = null;
        this._ownedDimensions = [];
        this._state = null;
        this._app = null;
    }

    _syncSelection() {
        if (this._destroyed) return;
        const selectedEntities = this._app?.selectTool?.getSelected?.() || [];
        const state = this._readPublicState();
        if (state) {
            this._state = state;
            this._lastLength = state.size?.length ?? null;
        }
        const nextSelected = Boolean(
            this._countertopRoot && (
                selectedEntities.includes(this._countertopRoot) ||
                (!this._app?.selectTool && ACTIVE_INTERACTION_STATES.has(state?.interactionState))
            )
        );

        if (nextSelected === this._selected) {
            if (nextSelected) this._subscribeToService();
            return;
        }

        this._selected = nextSelected;
        if (nextSelected) {
            this._bindUpdate();
            this._subscribeToService();
            this._renderSelectedData();
        } else {
            this._unbindUpdate();
            this._unsubscribeFromService();
            this._removeOwnedDimensions();
        }
    }

    _subscribeToService() {
        if (this._unsubscribeService || !this._service?.on) return;
        this._unsubscribeService = this._service.on('change', payload => {
            const state = payload?.state ?? null;
            const previousLength = this._state?.size?.length ?? this._lastLength;
            this._state = state;
            const nextLength = state?.size?.length ?? null;
            const lengthChanged = !Object.is(previousLength, nextLength);
            this._lastLength = nextLength;

            if (lengthChanged) {
                this._pendingGeometry = true;
                this._scheduleSettledRefresh();
                return;
            }
            this._dirty = true;
        });
    }

    _unsubscribeFromService() {
        this._unsubscribeService?.();
        this._unsubscribeService = null;
        this._settleToken++;
        this._pendingGeometry = false;
    }

    _scheduleSettledRefresh() {
        const service = this._service;
        const token = ++this._settleToken;
        Promise.resolve(service?.whenSettled?.()).then(() => {
            if (this._destroyed || token !== this._settleToken || service !== this._service) return;
            this.refreshAfterGeometry();
        }).catch(() => {
            // The public mutation reports settle failure. Keep the last actual
            // mesh dimensions rather than publishing the requested stale size.
        });
    }

    _renderSelectedData() {
        const system = this._app?.dimensionSystem;
        if (!system || !this._baseData) return;

        const ownedLines = this._selected && !this._suppressed ? this._buildOwnedLines() : [];
        this._renderedData = {
            ...this._baseData,
            lines: [...(this._baseData.lines || []), ...ownedLines]
        };
        system.showDimensions(this._renderedData);
        this._captureOwnedDimensions();
        this._dirty = true;
        this._flushUpdate({ force: true });
    }

    _buildOwnedLines() {
        const boundsM = measureCountertopMeshBoundsM(this._countertopMesh);
        const state = this._state || this._readPublicState();
        if (this._suppressed || !boundsM || state?.readiness !== 'ready') return [];

        const units = this._baseData?.labelSettings?.units === 'cm' ? 'cm' : 'in';
        const decimals = this._baseData?.labelSettings?.decimals ?? DEFAULT_DECIMALS;
        const offsetM = Number(this._baseData?.labelSettings?.offset ?? DEFAULT_OFFSET_M);
        const safeOffsetM = Number.isFinite(offsetM) ? offsetM : DEFAULT_OFFSET_M;
        // The countertop state is in metres; labels follow the base data units (cm or inches).
        const lengthM = finitePositiveOrNull(state?.size?.length) ?? boundsM.lengthM;
        const depthM = finitePositiveOrNull(state?.size?.depth) ?? boundsM.depthM;

        // Two offsets up: the cabinet width line already sits on the back-top edge at + offset.
        const lengthStart = {
            x: boundsM.min.x,
            y: boundsM.max.y + 2 * safeOffsetM,
            z: boundsM.min.z - safeOffsetM
        };
        const lengthEnd = { ...lengthStart, x: boundsM.max.x };
        const depthStart = {
            x: boundsM.max.x + safeOffsetM,
            y: boundsM.min.y - safeOffsetM,
            z: boundsM.min.z
        };
        const depthEnd = { ...depthStart, z: boundsM.max.z };

        return [
            {
                [OWNED_LINE_MARKER]: OWNED_LINE_OWNER,
                dimension: 'countertop-length',
                start: toPointArray(lengthStart),
                end: toPointArray(lengthEnd),
                label: formatOwnedLabel(lengthM, units, decimals),
                labelPosition: 'center',
                units,
                decimals
            },
            {
                [OWNED_LINE_MARKER]: OWNED_LINE_OWNER,
                dimension: 'countertop-depth',
                start: toPointArray(depthStart),
                end: toPointArray(depthEnd),
                label: formatOwnedLabel(depthM, units, decimals),
                labelPosition: 'center',
                units,
                decimals
            }
        ];
    }

    _flushUpdate(options = {}) {
        if (this._destroyed || this._suppressed || !this._selected || !this._baseData) return;
        if (this._pendingGeometry && options.force !== true) return;

        const system = this._app?.dimensionSystem;
        if (!system?._visible || system._lastData !== this._renderedData) return;
        if (!this._dirty && options.force !== true && this._findOwnedDimensions().length > 0) {
            return;
        }

        const ownedLines = this._buildOwnedLines();
        if (ownedLines.length === 0) {
            this._removeOwnedDimensions();
            return;
        }

        let dimensions = this._findOwnedDimensions();
        if (dimensions.length !== ownedLines.length) {
            this._captureOwnedDimensions();
            dimensions = this._findOwnedDimensions();
        }
        if (dimensions.length !== ownedLines.length) {
            this._renderSelectedData();
            return;
        }

        const renderedLines = this._renderedData.lines || [];
        const ownedConfigs = renderedLines.filter(line => line?.[OWNED_LINE_MARKER] === OWNED_LINE_OWNER);
        ownedLines.forEach((line, index) => {
            const config = ownedConfigs[index];
            if (config) Object.assign(config, line);

            const dimension = dimensions[index];
            dimension._customLabel = line.label;
            dimension._customStart.set(line.start[0], line.start[1], line.start[2]);
            dimension._customEnd.set(line.end[0], line.end[1], line.end[2]);
            dimension.setData(dimension._customStart, dimension._customEnd, line.label);
        });

        this._dirty = false;
    }

    _captureOwnedDimensions() {
        const system = this._app?.dimensionSystem;
        if (!system || system._lastData !== this._renderedData) {
            this._ownedDimensions = [];
            return;
        }

        const count = (this._renderedData?.lines || [])
            .filter(line => line?.[OWNED_LINE_MARKER] === OWNED_LINE_OWNER).length;
        this._ownedDimensions = count > 0 ? system._dims.slice(-count) : [];
        this._ownedDimensions.forEach(dimension => {
            dimension[OWNED_LINE_MARKER] = OWNED_LINE_OWNER;
        });
    }

    _findOwnedDimensions() {
        const dimensions = this._app?.dimensionSystem?._dims || [];
        return dimensions.filter(dimension => (
            dimension?.[OWNED_LINE_MARKER] === OWNED_LINE_OWNER
        ));
    }

    _removeOwnedDimensions() {
        const system = this._app?.dimensionSystem;
        if (!system) return;

        if (system._lastData === this._renderedData) {
            this._captureOwnedDimensions();
        }

        const owned = new Set(this._findOwnedDimensions());
        for (const dimension of owned) dimension.destroy?.();
        if (owned.size > 0) {
            system._dims = system._dims.filter(dimension => !owned.has(dimension));
        }

        if (system._lastData === this._renderedData && this._baseData) {
            system._lastData = this._baseData;
        }
        this._renderedData = this._baseData;
        this._ownedDimensions = [];
        this._dirty = false;
    }

    _readPublicState() {
        return this._service?.getState?.() ?? null;
    }

    _bindUpdate() {
        if (this._updateBound) return;
        this._app?.on?.('update', this._onUpdate, this);
        this._updateBound = true;
    }

    _unbindUpdate() {
        if (!this._updateBound) return;
        this._app?.off?.('update', this._onUpdate, this);
        this._updateBound = false;
    }
}

export function createCountertopDimensionAdapter(app, options) {
    return new CountertopDimensionAdapter(app, options);
}
