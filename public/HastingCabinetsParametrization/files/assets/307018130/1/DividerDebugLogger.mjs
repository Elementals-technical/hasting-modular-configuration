// @ts-check

const GLOBAL_FLAG = '__HASTING_DIVIDER_DEBUG__';
const STORAGE_KEY = 'hasting:dividerDebug';
const DEFAULT_ENABLED = true;
const DEFAULT_MAX_EVENTS = 1500;

/**
 * Dependency-free divider diagnostics logger.
 * It is safe to import from core modules and from browser-only bridge code.
 */
export class DividerDebugLogger {
    static _seq = 0;
    static _eventSeq = 0;
    static _events = [];
    static _maxEvents = DEFAULT_MAX_EVENTS;

    static isEnabled() {
        const globalScope = DividerDebugLogger._getGlobalScope();
        const globalValue = globalScope?.[GLOBAL_FLAG];
        if (typeof globalValue === 'boolean') return globalValue;

        const stored = DividerDebugLogger._getStoredValue();
        if (stored !== null) {
            return stored === '1' || stored === 'true' || stored === 'on';
        }

        return DEFAULT_ENABLED;
    }

    static setEnabled(enabled, options = {}) {
        const { persist = true } = options;
        const normalized = Boolean(enabled);
        const globalScope = DividerDebugLogger._getGlobalScope();

        if (globalScope) {
            globalScope[GLOBAL_FLAG] = normalized;
        }

        if (persist) {
            DividerDebugLogger._setStoredValue(normalized ? '1' : '0');
        }

        DividerDebugLogger._record('log', 'Debug', `Divider debug logging ${normalized ? 'enabled' : 'disabled'}`, {
            enabled: normalized,
            persist
        });

        return normalized;
    }

    static nextTraceId(prefix = 'divider') {
        DividerDebugLogger._seq += 1;
        return `${prefix}-${Date.now().toString(36)}-${DividerDebugLogger._seq}`;
    }

    static log(stage, message, data = undefined) {
        if (!DividerDebugLogger.isEnabled()) return;
        DividerDebugLogger._record('log', stage, message, data);
    }

    static warn(stage, message, data = undefined) {
        DividerDebugLogger._record('warn', stage, message, data);
    }

    static error(stage, message, data = undefined) {
        DividerDebugLogger._record('error', stage, message, data);
    }

    static getEvents(options = {}) {
        const {
            limit = 500,
            level = undefined,
            stageIncludes = undefined
        } = options || {};

        let events = DividerDebugLogger._events;
        if (level) {
            events = events.filter(event => event.level === level);
        }
        if (stageIncludes) {
            events = events.filter(event => event.stage.includes(stageIncludes));
        }

        const normalizedLimit = Math.max(1, Math.floor(Number(limit) || 500));
        return events.slice(-normalizedLimit).map(event => ({ ...event }));
    }

    static dump(options = {}) {
        return {
            enabled: DividerDebugLogger.isEnabled(),
            maxEvents: DividerDebugLogger._maxEvents,
            eventCount: DividerDebugLogger._events.length,
            dumpedAt: new Date().toISOString(),
            events: DividerDebugLogger.getEvents(options)
        };
    }

    static clearEvents() {
        DividerDebugLogger._events.splice(0, DividerDebugLogger._events.length);
        DividerDebugLogger._record('log', 'Debug', 'Divider debug event buffer cleared');
    }

    static setMaxEvents(maxEvents) {
        DividerDebugLogger._maxEvents = Math.max(100, Math.floor(Number(maxEvents) || DEFAULT_MAX_EVENTS));
        if (DividerDebugLogger._events.length > DividerDebugLogger._maxEvents) {
            DividerDebugLogger._events.splice(0, DividerDebugLogger._events.length - DividerDebugLogger._maxEvents);
        }
        DividerDebugLogger._record('log', 'Debug', 'Divider debug max event count updated', {
            maxEvents: DividerDebugLogger._maxEvents
        });
        return DividerDebugLogger._maxEvents;
    }

    static summarizeSlots(slots = []) {
        if (!Array.isArray(slots)) return [];

        return slots.map((slot) => ({
            key: slot?.key,
            value: slot?.value,
            slotType: slot?.other?.type,
            zone: slot?.other?.zone,
            anchor: slot?.other?.anchor,
            start: DividerDebugLogger._round(slot?.other?.start),
            stateId: slot?.other?.stateId,
            placementType: slot?.other?.placementType,
            canPlace: slot?.other?.canPlace,
            disabledReason: slot?.other?.disabledReason,
            availableTypes: slot?.other?.availableTypes,
            width: DividerDebugLogger._round(slot?.width),
            position: {
                start: DividerDebugLogger._round(slot?.position?.start),
                center: DividerDebugLogger._round(slot?.position?.center),
                end: DividerDebugLogger._round(slot?.position?.end)
            }
        }));
    }

    static summarizeZones(zones = {}) {
        const result = {};
        for (const [zoneName, zoneData] of Object.entries(zones || {})) {
            const slots = Array.isArray(zoneData?.slots) ? zoneData.slots : [];
            result[zoneName] = {
                slotCount: slots.length,
                occupied: slots.filter((slot) => slot?.other?.type === 'occupied' || (slot?.value && slot.value !== 'empty')).length,
                ghost: slots.filter((slot) => slot?.other?.type === 'ghost' || (!slot?.other?.type && slot?.value === 'empty')).length,
                activeCandidates: slots.filter((slot) => slot?.other?.type === 'candidate' && slot?.other?.canPlace === true).length,
                disabledCandidates: slots.filter((slot) => slot?.other?.type === 'candidate' && slot?.other?.canPlace === false).length,
                slots: DividerDebugLogger.summarizeSlots(slots)
            };
        }
        return result;
    }

    static summarizeCompactState(state = {}) {
        const result = {};
        const zones = state?.zones || {};
        for (const [zoneName, zoneData] of Object.entries(zones)) {
            const slots = Array.isArray(zoneData?.slots) ? zoneData.slots : [];
            result[zoneName] = slots.map((slot) => ({
                key: slot?.key,
                value: slot?.value,
                start: DividerDebugLogger._round(slot?.start ?? slot?.other?.start),
                anchor: slot?.anchor ?? slot?.other?.anchor,
                stateId: slot?.stateId ?? slot?.other?.stateId
            }));
        }
        return result;
    }

    static summarizeEngineState(state = {}) {
        const slots = [];
        const count = Number(state?.N || 0);
        for (let i = 0; i < count; i++) {
            slots.push({
                index: i,
                type: state.type?.[i] ?? null,
                width: DividerDebugLogger._round(state.slotWidth?.[i]),
                x: DividerDebugLogger._round(state.slotX?.[i]),
                stateId: state.stateIds?.[i]
            });
        }

        return {
            N: count,
            alignment: state?.alignment,
            conflicts: state?.conflicts || [],
            slots
        };
    }

    static summarizeDrawerConfig(drawerConfig = {}) {
        return {
            zones: DividerDebugLogger.summarizeZones(drawerConfig?.zones || {}),
            conflicts: drawerConfig?._conflicts || []
        };
    }

    static summarizeProduct(productId, productConfig = {}) {
        return {
            productId,
            category: productConfig?.category,
            productType: productConfig?.productType,
            Width: productConfig?.Width,
            Height: productConfig?.Height,
            Depth: productConfig?.Depth,
            topDrawerType: productConfig?.topDrawerType,
            TopDrawerDividers: DividerDebugLogger.summarizeDrawerConfig(productConfig?.TopDrawerDividers),
            BotDrawerDividers: DividerDebugLogger.summarizeDrawerConfig(productConfig?.BotDrawerDividers)
        };
    }

    static snapshotComposition(composition) {
        const products = composition?.getAllProducts?.() || {};
        const cabinets = {};

        for (const [productId, productConfig] of Object.entries(products)) {
            if (productConfig?.category && productConfig.category !== 'cabinets') continue;
            cabinets[productId] = DividerDebugLogger.summarizeProduct(productId, productConfig);
        }

        return {
            cabinetCount: Object.keys(cabinets).length,
            cabinets
        };
    }

    static summarizeOverlaySystem(overlaySystem) {
        if (!overlaySystem) {
            return { exists: false };
        }

        const widgets = Array.isArray(overlaySystem._widgets) ? overlaySystem._widgets : [];

        return {
            exists: true,
            isActive: Boolean(overlaySystem._isActive),
            enabled: Boolean(overlaySystem._enabled),
            activeCabinetId: overlaySystem._activeCabinetId || null,
            activeDrawerType: overlaySystem._activeDrawerType || null,
            activeOverlayOptions: overlaySystem._activeOverlayOptions || {},
            widgetCount: widgets.length,
            domChildCount: overlaySystem.container?.children?.length || 0,
            container: DividerDebugLogger.summarizeDomElement(overlaySystem.container),
            widgets: widgets.map((widget) => ({
                id: widget?.id,
                visible: widget?.visible,
                data: {
                    type: widget?.data?.type,
                    key: widget?.data?.key,
                    zone: widget?.data?.zone,
                    zoneIndex: widget?.data?.zoneIndex,
                    placementType: widget?.data?.placementType,
                    canPlace: widget?.data?.canPlace,
                    disabledReason: widget?.data?.disabledReason,
                    dividerType: widget?.data?.dividerType,
                    stateId: widget?.data?.stateId
                },
                offset: widget?.position?.offset
                    ? {
                        x: DividerDebugLogger._round(widget.position.offset.x || 0),
                        y: DividerDebugLogger._round(widget.position.offset.y || 0),
                        z: DividerDebugLogger._round(widget.position.offset.z || 0)
                    }
                    : undefined,
                dom: DividerDebugLogger.summarizeDomElement(widget?.element)
            }))
        };
    }

    static summarizeDrawerRuntime(app, cabinetId = null, drawerType = null) {
        const drawerViewService = app?.drawerViewService;
        const drawerAnimationService = app?.drawerAnimationService;
        const overlaySystem = app?.dividerSlotOverlaySystem;
        const activeCabinetId = drawerViewService?.getActiveCabinetId?.() || null;
        const activeDrawerType = drawerViewService?.getActiveDrawerType?.() || null;
        const resolvedCabinetId = cabinetId || overlaySystem?._activeCabinetId || activeCabinetId;
        const resolvedDrawerType = drawerType || overlaySystem?._activeDrawerType || activeDrawerType;

        return {
            requestedCabinetId: cabinetId || null,
            requestedDrawerType: drawerType || null,
            topViewActive: Boolean(drawerViewService?.isTopViewActive?.()),
            topViewCabinetId: activeCabinetId,
            topViewDrawerType: activeDrawerType,
            resolvedCabinetId: resolvedCabinetId || null,
            resolvedDrawerType: resolvedDrawerType || null,
            drawerOpen: resolvedCabinetId && resolvedDrawerType
                ? Boolean(drawerAnimationService?.isDrawerOpen?.(resolvedCabinetId, resolvedDrawerType))
                : false,
            overlay: DividerDebugLogger.summarizeOverlaySystem(overlaySystem)
        };
    }

    static summarizeDomElement(element) {
        if (!element) return null;

        let rect = null;
        try {
            const bounds = element.getBoundingClientRect?.();
            if (bounds) {
                rect = {
                    left: DividerDebugLogger._round(bounds.left),
                    top: DividerDebugLogger._round(bounds.top),
                    width: DividerDebugLogger._round(bounds.width),
                    height: DividerDebugLogger._round(bounds.height)
                };
            }
        } catch (_) {
            rect = null;
        }

        return {
            id: element.id || undefined,
            className: typeof element.className === 'string' ? element.className : undefined,
            text: element.textContent?.trim?.().slice(0, 80) || undefined,
            childCount: element.children?.length || 0,
            style: {
                display: element.style?.display || undefined,
                left: element.style?.left || undefined,
                top: element.style?.top || undefined,
                opacity: element.style?.opacity || undefined,
                pointerEvents: element.style?.pointerEvents || undefined,
                zIndex: element.style?.zIndex || undefined
            },
            rect
        };
    }

    static _print(level, stage, message, data = undefined) {
        const consoleRef = DividerDebugLogger._getGlobalScope()?.console || console;
        const method = consoleRef[level] || consoleRef.log;
        const prefix = `[DividerDebug][${stage}]`;
        const style = level === 'error'
            ? 'color:#d00;font-weight:bold;'
            : level === 'warn'
                ? 'color:#b26a00;font-weight:bold;'
                : 'color:#2364aa;font-weight:bold;';

        if (data === undefined) {
            method.call(consoleRef, `%c${prefix}`, style, message);
        } else {
            method.call(consoleRef, `%c${prefix}`, style, message, data);
        }
    }

    static _record(level, stage, message, data = undefined) {
        DividerDebugLogger._eventSeq += 1;
        const ts = Date.now();
        const event = {
            id: DividerDebugLogger._eventSeq,
            ts,
            iso: new Date(ts).toISOString(),
            level,
            stage,
            message,
            data: DividerDebugLogger._sanitizeForDebug(data)
        };

        DividerDebugLogger._events.push(event);
        if (DividerDebugLogger._events.length > DividerDebugLogger._maxEvents) {
            DividerDebugLogger._events.splice(0, DividerDebugLogger._events.length - DividerDebugLogger._maxEvents);
        }

        // DividerDebugLogger._print(level, stage, message, data);
        return event;
    }

    static _sanitizeForDebug(value, depth = 0, seen = new WeakSet()) {
        if (value == null) return value;
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
        if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`;
        if (value instanceof Error) {
            return {
                name: value.name,
                message: value.message,
                stack: value.stack
            };
        }
        if (typeof value !== 'object') return String(value);
        if (seen.has(value)) return '[Circular]';
        if (depth >= 6) return '[MaxDepth]';

        seen.add(value);
        if (Array.isArray(value)) {
            return value.map(item => DividerDebugLogger._sanitizeForDebug(item, depth + 1, seen));
        }

        const result = {};
        for (const [key, item] of Object.entries(value)) {
            result[key] = DividerDebugLogger._sanitizeForDebug(item, depth + 1, seen);
        }
        return result;
    }

    static _round(value) {
        if (typeof value !== 'number' || Number.isNaN(value)) return value;
        return Number(value.toFixed(4));
    }

    static _getGlobalScope() {
        if (typeof globalThis !== 'undefined') return globalThis;
        return null;
    }

    static _getStoredValue() {
        try {
            return DividerDebugLogger._getGlobalScope()?.localStorage?.getItem(STORAGE_KEY);
        } catch (_) {
            return null;
        }
    }

    static _setStoredValue(value) {
        try {
            DividerDebugLogger._getGlobalScope()?.localStorage?.setItem(STORAGE_KEY, value);
        } catch (_) {
            // localStorage may be unavailable in embedded or test runtimes.
        }
    }
}
