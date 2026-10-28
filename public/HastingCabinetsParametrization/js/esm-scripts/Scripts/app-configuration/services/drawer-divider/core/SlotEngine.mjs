import { DIVIDER_WIDTHS } from './divider.constants.mjs';
import { DividerDebugLogger } from '../diagnostics/DividerDebugLogger.mjs';

// @ts-check
/**
 * @typedef {{
 *   type: (string|null)[],
 *   slotWidth: number[],
 *   slotX: number[],
 *   N: number,
 *   alignment?: string,
 *   stateIds?: Object.<number, string>
 * }} SlotState
 */ /**
 * SlotEngine — ядро системи слотів для дівайдерів.
 *
 * Концепція:
 *  - Зона шухляди має фіксовану ширину W (см)
 *  - N слотів з індексами 0..N-1 (порядок фіксований)
 *  - Кожен слот має: type (null | 'A'|'B'|'C'), slotWidth (см), slotX (ліва координата)
 *  - Порожній слот: slotWidth = DIVIDER_WIDTHS.A, type = null (база під "+")
 *  - Встановлення дівайдера: змінюється ширина слота → зсуваються сусіди
 *
 * Алгоритм SetDivider(i, newType):
 *  1. delta = newWidth - oldWidth
 *  2. Напрям зсуву: prefer RIGHT якщо center(slot) < W/2, інакше LEFT
 *  3. Спробувати preferred → fallback → INVALID
 *  4. Зсув: RIGHT → сусіди праворуч зсуваються; LEFT → сусіди ліворуч + сам слот
 *  5. Валідація: всі OCCUPIED дівайдери мають залишитись в межах [0, W]
 *     (порожні слоти, що виходять за межі — ігноруються при рендері)
 */ class SlotEngine {
    /**
     * Ініціалізація базової сітки слотів (всі порожні).
     *
     * N = floor(W / DIVIDER_WIDTHS.A)
     * Позиції залежать від alignment:
     *  - 'packed' (default): offset = (W - total) / 2 (центрування)
     *  - 'edges-left': offset = 0 (прив'язка до лівого краю)
     *  - 'edges-right': offset = W - total (прив'язка до правого краю)
     *
     * @param {number} W - ширина зони в см
     * @param {string} [alignment='packed'] - стратегія вирівнювання
     * @returns {SlotState}
     *
     * @example
     * // W = 70.32, packed → N = 5, offset = 1.41
     * const state = SlotEngine.initSlots(70.32);
     * // W = 27.51, edges-left → N = 2, offset = 0
     * const state2 = SlotEngine.initSlots(27.51, 'edges-left');
     * // W = 27.51, edges-right → N = 2, offset = 0.51
     * const state3 = SlotEngine.initSlots(27.51, 'edges-right');
     */ static initSlots(W, alignment = 'packed') {
        const baseWidth = DIVIDER_WIDTHS.A;
        const N = Math.floor(W / baseWidth);
        if (N <= 0) {
            DividerDebugLogger.warn('SlotEngine.initSlots', 'Zone is too narrow for divider slots', {
                W,
                alignment,
                baseWidth,
                N
            });
            return {
                type: [],
                slotWidth: [],
                slotX: [],
                N: 0,
                alignment
            };
        }
        const type = new Array(N).fill(null);
        const slotWidth = new Array(N).fill(baseWidth);
        const slotX = [];
        // Позиції зліва направо (edge-to-edge, без spacing)
        for(let i = 0; i < N; i++){
            slotX.push(i * baseWidth);
        }
        // Offset залежить від alignment
        const total = N * baseWidth;
        let offset;
        if (alignment === 'edges-left') {
            offset = 0;
        } else if (alignment === 'edges-right') {
            offset = W - total;
        } else {
            // 'packed' (default) — центрування
            offset = (W - total) / 2;
        }
        for(let i = 0; i < N; i++){
            slotX[i] += offset;
        }
        const state = {
            type,
            slotWidth,
            slotX,
            N,
            alignment
        };
        DividerDebugLogger.log('SlotEngine.initSlots', 'Initialized base slot grid', {
            W,
            alignment,
            baseWidth,
            total,
            offset,
            state: DividerDebugLogger.summarizeEngineState(state)
        });
        return state;
    }
    /**
     * Відновлення стану з compact state (тільки occupied dividers).
     *
     * Процес:
     *  1. Створити базову сітку (initSlots)
     *  2. Послідовно застосувати кожен occupied divider (setDivider)
     *  3. Зібрати конфлікти (дівайдери, що не вмістились)
     *
     * @param {number} W - ширина зони в см
     * @param {Array<{zoneIndex: number, value: string, stateId?: string}>} occupiedSlots
     * @param {string} [alignment='packed'] - стратегія вирівнювання
     * @returns {SlotState & { conflicts: Array<{zoneIndex: number, dividerType: string, dividerWidth: number, stateId?: string, reason: string}> }}
     *
     * @example
     * const result = SlotEngine.initFromCompactState(70.32, [
     *   { zoneIndex: 0, value: 'A', stateId: 'id1' },
     *   { zoneIndex: 3, value: 'C', stateId: 'id2' }
     * ], 'edges-left');
     * // result.type = ['A', null, null, 'C', null]
     * // result.alignment = 'edges-left'
     * // result.conflicts = [] (якщо все вмістилось)
     */ static initFromCompactState(W, occupiedSlots = [], alignment = 'packed') {
        const traceId = DividerDebugLogger.nextTraceId('slot-engine-restore');
        const state = SlotEngine.initSlots(W, alignment);
        state.stateIds = {};
        /** @type {Array<{zoneIndex: number, dividerType: string, dividerWidth: number, stateId?: string, reason: string}>} */ const conflicts = [];
        const sorted = SlotEngine._sortCompactSlotsForRestore(occupiedSlots);
        DividerDebugLogger.log('SlotEngine.initFromCompactState', 'Resolved compact restore order', {
            traceId,
            alignment,
            compactOrder: occupiedSlots.map((slot)=>({
                    zoneIndex: slot.zoneIndex,
                    value: slot.value,
                    stateId: slot.stateId,
                    createdAt: SlotEngine._getDividerStateCreatedAt(slot.stateId)
                })),
            restoreOrder: sorted.map((slot)=>({
                    zoneIndex: slot.zoneIndex,
                    value: slot.value,
                    stateId: slot.stateId,
                    createdAt: SlotEngine._getDividerStateCreatedAt(slot.stateId)
                }))
        });
        DividerDebugLogger.log('SlotEngine.initFromCompactState', 'Restoring engine state from compact slots', {
            traceId,
            W,
            alignment,
            occupiedSlots: sorted,
            initialState: DividerDebugLogger.summarizeEngineState(state)
        });
        for (const slot of sorted){
            const idx = slot.zoneIndex;
            // Перевірка: індекс в межах сітки
            if (idx < 0 || idx >= state.N) {
                conflicts.push({
                    zoneIndex: idx,
                    dividerType: slot.value,
                    dividerWidth: /** @type {number} */ DIVIDER_WIDTHS[/** @type {keyof typeof DIVIDER_WIDTHS} */ slot.value] || 0,
                    stateId: slot.stateId || '',
                    reason: `Slot index ${idx} is out of range [0, ${state.N - 1}]. ` + `Zone width ${W.toFixed(2)}cm supports max ${state.N} slots.`
                });
                DividerDebugLogger.warn('SlotEngine.initFromCompactState', 'Occupied compact slot index is out of range', {
                    traceId,
                    slot,
                    N: state.N,
                    W
                });
                continue;
            }
            const result = SlotEngine.setDivider(state, idx, slot.value, W);
            if (result.valid && result.state) {
                state.type = result.state.type;
                state.slotWidth = result.state.slotWidth;
                state.slotX = result.state.slotX;
                state.stateIds[idx] = slot.stateId || '';
                DividerDebugLogger.log('SlotEngine.initFromCompactState', 'Applied compact divider slot', {
                    traceId,
                    slot,
                    state: DividerDebugLogger.summarizeEngineState(state)
                });
            } else {
                conflicts.push({
                    zoneIndex: idx,
                    dividerType: slot.value,
                    dividerWidth: /** @type {number} */ DIVIDER_WIDTHS[/** @type {keyof typeof DIVIDER_WIDTHS} */ slot.value] || 0,
                    stateId: slot.stateId || '',
                    reason: result.error || 'Unknown error'
                });
                DividerDebugLogger.warn('SlotEngine.initFromCompactState', 'Failed to apply compact divider slot', {
                    traceId,
                    slot,
                    error: result.error,
                    state: DividerDebugLogger.summarizeEngineState(state)
                });
            }
        }
        const restoredState = {
            ...state,
            conflicts
        };
        DividerDebugLogger.log('SlotEngine.initFromCompactState', 'Engine state restore completed', {
            traceId,
            restoredState: DividerDebugLogger.summarizeEngineState(restoredState)
        });
        return restoredState;
    }
    /**
     * Compact state stores fixed engine slot indexes, but restoring a packed
     * layout is order-sensitive because wider dividers shift their neighbors.
     * Replaying by creation order matches the user's placement history and
     * avoids rejecting valid sparse layouts, e.g. right C first, then left C.
     *
     * @private
     * @param {Array<{zoneIndex: number, value: string, stateId?: string}>} occupiedSlots
     * @returns {Array<{zoneIndex: number, value: string, stateId?: string}>}
     */ static _sortCompactSlotsForRestore(occupiedSlots = []) {
        return occupiedSlots.map((slot, order)=>({
                slot,
                order,
                createdAt: SlotEngine._getDividerStateCreatedAt(slot.stateId)
            })).sort((a, b)=>{
            const aHasCreatedAt = Number.isFinite(a.createdAt);
            const bHasCreatedAt = Number.isFinite(b.createdAt);
            if (aHasCreatedAt && bHasCreatedAt && a.createdAt !== b.createdAt) {
                return a.createdAt - b.createdAt;
            }
            if (aHasCreatedAt !== bHasCreatedAt) {
                return aHasCreatedAt ? -1 : 1;
            }
            const zoneDiff = (a.slot.zoneIndex ?? 0) - (b.slot.zoneIndex ?? 0);
            return zoneDiff || a.order - b.order;
        }).map(({ slot })=>slot);
    }
    /**
     * @private
     * @param {string|undefined} stateId
     * @returns {number}
     */ static _getDividerStateCreatedAt(stateId) {
        if (typeof stateId !== 'string') return Number.NaN;
        const match = /^divider_(\d+)_/.exec(stateId);
        if (!match) return Number.NaN;
        const timestamp = Number(match[1]);
        return Number.isFinite(timestamp) ? timestamp : Number.NaN;
    }
    /**
     * SetDivider(i, newType) — основний алгоритм встановлення/зміни дівайдера.
     *
     * 4.1  delta = newWidth - oldWidth
     * 4.2  Snapshot для rollback
     * 4.3  Визначити напрям: prefer = center < W/2 ? RIGHT : LEFT
     * 4.4  Спробувати preferred → fallback → INVALID
     * 4.5  Валідація: всі occupied слоти в межах [0, W]
     *
     * @param {SlotState} state - поточний стан
     * @param {number} i - індекс слота
     * @param {string} newType - тип дівайдера ('A', 'B', 'C')
     * @param {number} W - ширина зони
     * @returns {{ valid: boolean, state?: SlotState, error?: string }}
     *
     * @example
     * const result = SlotEngine.setDivider(state, 3, 'C', 70.32);
     * if (result.valid) {
     *   // result.state — новий стан зі зсунутими сусідами
     * } else {
     *   // result.error — причина відмови
     * }
     */ static setDivider(state, i, newType, W) {
        const { type, slotWidth, slotX, N } = state;
        if (i < 0 || i >= N) {
            DividerDebugLogger.warn('SlotEngine.setDivider', 'Slot index out of range', {
                i,
                newType,
                W,
                N,
                state: DividerDebugLogger.summarizeEngineState(state)
            });
            return {
                valid: false,
                error: `Slot index ${i} out of range [0, ${N - 1}]`
            };
        }
        const newW = DIVIDER_WIDTHS[/** @type {keyof typeof DIVIDER_WIDTHS} */ newType];
        if (!newW) {
            DividerDebugLogger.warn('SlotEngine.setDivider', 'Unknown divider type requested', {
                i,
                newType,
                W,
                state: DividerDebugLogger.summarizeEngineState(state)
            });
            return {
                valid: false,
                error: `Unknown divider type: "${newType}"`
            };
        }
        // 4.1  Зміна ширини
        const oldW = slotWidth[i];
        const delta = newW - oldW;
        if (Math.abs(delta) < 0.001) {
            // Тільки зміна типу, ширина та ж сама
            const newState = {
                type: [
                    ...type
                ],
                slotWidth: [
                    ...slotWidth
                ],
                slotX: [
                    ...slotX
                ],
                N,
                alignment: state.alignment
            };
            newState.type[i] = newType;
            DividerDebugLogger.log('SlotEngine.setDivider', 'Applied divider without width shift', {
                i,
                newType,
                W,
                state: DividerDebugLogger.summarizeEngineState(newState)
            });
            return {
                valid: true,
                state: newState
            };
        }
        // 4.3  Визначити preferred напрям (залежить від alignment)
        /** @type {'RIGHT'|'LEFT'} */ let prefer;
        if (state.alignment === 'edges-left') {
            // Слоти прив'язані до лівого краю — зсуваємо від стінки вправо
            prefer = 'RIGHT';
        } else if (state.alignment === 'edges-right') {
            // Слоти прив'язані до правого краю — зсуваємо від стінки вліво
            prefer = 'LEFT';
        } else {
            // 'packed' — геометрична евристика
            const center = slotX[i] + slotWidth[i] / 2;
            prefer = center < W / 2 ? 'RIGHT' : 'LEFT';
        }
        // Спробувати preferred, потім fallback
        /** @type {Array<'RIGHT'|'LEFT'>} */ const directions = prefer === 'RIGHT' ? [
            'RIGHT',
            'LEFT'
        ] : [
            'LEFT',
            'RIGHT'
        ];
        for (const direction of directions){
            const result = SlotEngine._tryShift(state, i, newType, newW, delta, direction, W);
            if (result.valid) {
                return result;
            }
        }
        if (state.alignment === 'packed' && N === 1 && newW <= W + 0.01) {
            const newState = {
                type: [
                    ...type
                ],
                slotWidth: [
                    ...slotWidth
                ],
                slotX: [
                    ...slotX
                ],
                N,
                alignment: state.alignment
            };
            newState.type[i] = newType;
            newState.slotWidth[i] = newW;
            newState.slotX[i] = (W - newW) / 2;
            DividerDebugLogger.log('SlotEngine.setDivider', 'Applied single-slot centered fit', {
                i,
                newType,
                newW,
                W,
                state: DividerDebugLogger.summarizeEngineState(newState)
            });
            return {
                valid: true,
                state: newState
            };
        }
        const alignedVisibleEdgeFit = SlotEngine._tryAlignedVisibleEdgeFit(state, i, newType, newW, W);
        if (alignedVisibleEdgeFit.valid) {
            DividerDebugLogger.log('SlotEngine.setDivider', 'Applied aligned visible-edge fit fallback', {
                i,
                newType,
                newW,
                W,
                state: DividerDebugLogger.summarizeEngineState(alignedVisibleEdgeFit.state)
            });
            return alignedVisibleEdgeFit;
        }
        const visibleEdgeFit = SlotEngine._tryPackedVisibleEdgeFit(state, i, newType, newW, W);
        if (visibleEdgeFit.valid) {
            DividerDebugLogger.log('SlotEngine.setDivider', 'Applied packed visible-edge fit fallback', {
                i,
                newType,
                newW,
                W,
                state: DividerDebugLogger.summarizeEngineState(visibleEdgeFit.state)
            });
            return visibleEdgeFit;
        }
        const sparseFit = SlotEngine._tryPackedSparseFit(state, i, newType, newW, W);
        if (sparseFit.valid) {
            DividerDebugLogger.log('SlotEngine.setDivider', 'Applied packed sparse fit fallback', {
                i,
                newType,
                newW,
                W,
                state: DividerDebugLogger.summarizeEngineState(sparseFit.state)
            });
            return sparseFit;
        }
        const edgeFit = SlotEngine._tryPackedEdgeFit(state, i, newType, newW, W);
        if (edgeFit.valid) {
            DividerDebugLogger.log('SlotEngine.setDivider', 'Applied packed edge fit fallback', {
                i,
                newType,
                newW,
                W,
                state: DividerDebugLogger.summarizeEngineState(edgeFit.state)
            });
            return edgeFit;
        }
        // Обидва напрямки не підходять
        const leftFree = Math.min(...slotX);
        const rightEdge = Math.max(...slotX.map((x, k)=>x + slotWidth[k]));
        const rightFree = W - rightEdge;
        const error = `Cannot fit "${newType}" (${newW}cm) at slot ${i}. ` + `Delta: ${delta.toFixed(2)}cm, Left free: ${leftFree.toFixed(2)}cm, Right free: ${rightFree.toFixed(2)}cm`;
        DividerDebugLogger.log('SlotEngine.setDivider', 'Divider fit rejected', {
            i,
            newType,
            newW,
            W,
            delta,
            leftFree,
            rightFree,
            state: DividerDebugLogger.summarizeEngineState(state),
            error
        });
        return {
            valid: false,
            error
        };
    }
    /**
     * Спробувати зсув в одному напрямку та перевірити валідність.
     *
     * RIGHT: slot_i лишається на місці, все j > i зсувається на +delta
     * LEFT:  правий край slot_i фіксований (slotX[i] -= delta), все j < i зсувається на -delta
     *
     * Валідація: всі OCCUPIED слоти мають бути в межах [0, W].
     * Порожні слоти за межами — допустимо (вони просто не відображаються).
     *
     * @private
     * @param {SlotState} state
     * @param {number} i
     * @param {string} newType
     * @param {number} newW
     * @param {number} delta
     * @param {'RIGHT'|'LEFT'} direction
     * @param {number} W
     * @returns {{ valid: boolean, state?: SlotState, error?: string }}
     */ static _tryShift(state, i, newType, newW, delta, direction, W) {
        const EPSILON = 0.01;
        const { type, slotWidth, slotX, N } = state;
        // 4.2  Snapshot
        const newState = {
            type: [
                ...type
            ],
            slotWidth: [
                ...slotWidth
            ],
            slotX: [
                ...slotX
            ],
            N,
            alignment: state.alignment
        };
        newState.type[i] = newType;
        newState.slotWidth[i] = newW;
        // 4.4  Застосувати зсув
        if (direction === 'RIGHT') {
            // slot_i лишається на місці, все праворуч зсувається на delta
            for(let j = i + 1; j < N; j++){
                newState.slotX[j] += delta;
            }
        } else {
            // Тримаємо правий край slot_i: зсуваємо його вліво на delta
            newState.slotX[i] -= delta;
            // Все ліворуч зсувається на -delta
            for(let j = 0; j < i; j++){
                newState.slotX[j] -= delta;
            }
        }
        // Валідація: всі OCCUPIED слоти (включаючи новий) мають бути в [0, W]
        for(let k = 0; k < N; k++){
            if (newState.type[k] !== null) {
                const start = newState.slotX[k];
                const end = start + newState.slotWidth[k];
                if (start < -EPSILON || end > W + EPSILON) {
                    return {
                        valid: false,
                        error: `Occupied slot ${k} ("${newState.type[k]}") out of bounds: ` + `[${start.toFixed(2)}, ${end.toFixed(2)}] vs zone [0, ${W.toFixed(2)}]`
                    };
                }
            }
        }
        return {
            valid: true,
            state: newState
        };
    }
    /**
     * Fallback for visible non-edge packed slots. Once wider dividers are
     * placed, packed zones become sparse: a middle "+" can have enough physical
     * space for the selected divider even though the standard shift would push
     * an existing occupied divider out of bounds.
     *
     * The fallback tries positions tied to the clicked "+" only:
     *  - same left edge
     *  - same right edge
     *  - same center
     * Existing occupied dividers stay fixed; unusable ghosts are hidden.
     *
     * @private
     * @param {SlotState} state
     * @param {number} i
     * @param {string} newType
     * @param {number} newW
     * @param {number} W
     * @returns {{ valid: boolean, state?: SlotState, error?: string }}
     */ static _tryPackedSparseFit(state, i, newType, newW, W) {
        const EPSILON = 0.01;
        if (state.alignment !== 'packed' || state.N <= 1 || newW > W + EPSILON) {
            return {
                valid: false,
                error: 'Not a packed sparse candidate'
            };
        }
        const visibleSlots = SlotEngine.getVisibleSlots(state, W);
        const visibleIndex = visibleSlots.findIndex((slot)=>slot.index === i);
        if (visibleIndex < 0 || visibleSlots.length < 3) {
            return {
                valid: false,
                error: 'Slot is not a visible middle candidate'
            };
        }
        if (visibleIndex === 0 || visibleIndex === visibleSlots.length - 1) {
            return {
                valid: false,
                error: 'Visible edge slots are handled separately'
            };
        }
        const currentStart = state.slotX[i];
        const currentEnd = currentStart + state.slotWidth[i];
        const currentCenter = currentStart + state.slotWidth[i] / 2;
        const rawCandidates = [
            currentStart,
            currentEnd - newW,
            currentCenter - newW / 2
        ];
        /** @type {number[]} */ const candidates = [];
        for (const x of rawCandidates){
            if (!candidates.some((existing)=>Math.abs(existing - x) < EPSILON)) {
                candidates.push(x);
            }
        }
        for (const candidateX of candidates){
            const result = SlotEngine._buildPackedEdgeCandidateState(state, i, newType, newW, W, candidateX);
            if (result.valid) {
                DividerDebugLogger.log('SlotEngine._tryPackedSparseFit', 'Sparse fallback accepted', {
                    i,
                    newType,
                    newW,
                    W,
                    candidateX,
                    visibleIndices: visibleSlots.map((slot)=>slot.index),
                    state: DividerDebugLogger.summarizeEngineState(result.state)
                });
                return result;
            }
        }
        return {
            valid: false,
            error: 'No packed sparse candidate fits'
        };
    }
    /**
     * Fallback for siphon edge zones. In an edges-left zone the first divider
     * can stay pinned to the left wall while a later visible slot is pinned to
     * the right wall. edges-right mirrors that behavior.
     *
     * @private
     * @param {SlotState} state
     * @param {number} i
     * @param {string} newType
     * @param {number} newW
     * @param {number} W
     * @returns {{ valid: boolean, state?: SlotState, error?: string }}
     */ static _tryAlignedVisibleEdgeFit(state, i, newType, newW, W) {
        const EPSILON = 0.01;
        if (state.alignment !== 'edges-left' && state.alignment !== 'edges-right' || state.N <= 1 || newW > W + EPSILON) {
            return {
                valid: false,
                error: 'Not an aligned visible-edge candidate'
            };
        }
        const visibleSlots = SlotEngine.getVisibleSlots(state, W);
        if (visibleSlots.length === 0) {
            return {
                valid: false,
                error: 'No visible slots'
            };
        }
        const firstVisibleIndex = visibleSlots[0].index;
        const lastVisibleIndex = visibleSlots[visibleSlots.length - 1].index;
        let candidateX = null;
        let side = null;
        if (state.alignment === 'edges-left' && i === lastVisibleIndex) {
            candidateX = W - newW;
            side = 'right';
        } else if (state.alignment === 'edges-right' && i === firstVisibleIndex) {
            candidateX = 0;
            side = 'left';
        } else {
            return {
                valid: false,
                error: 'Not the opposite visible edge for aligned zone'
            };
        }
        const result = SlotEngine._buildPackedEdgeCandidateState(state, i, newType, newW, W, candidateX);
        if (result.valid) {
            DividerDebugLogger.log('SlotEngine._tryAlignedVisibleEdgeFit', 'Aligned visible-edge fallback accepted', {
                i,
                newType,
                newW,
                W,
                alignment: state.alignment,
                side,
                candidateX,
                visibleIndices: visibleSlots.map((slot)=>slot.index),
                state: DividerDebugLogger.summarizeEngineState(result.state)
            });
        }
        return result;
    }
    /**
     * Fallback for packed visible edge slots. A packed zone can have hidden
     * trailing ghosts after wider dividers are added. In that case the UI's
     * last visible "+" is not always the engine's real N-1 index.
     *
     * This fallback treats the first/last visible ghost as the edge action,
     * keeps occupied dividers fixed, clamps only the new divider into bounds,
     * and hides ghost slots that no longer have usable room.
     *
     * @private
     * @param {SlotState} state
     * @param {number} i
     * @param {string} newType
     * @param {number} newW
     * @param {number} W
     * @returns {{ valid: boolean, state?: SlotState, error?: string }}
     */ static _tryPackedVisibleEdgeFit(state, i, newType, newW, W) {
        const EPSILON = 0.01;
        if (state.alignment !== 'packed' || state.N <= 1 || newW > W + EPSILON) {
            return {
                valid: false,
                error: 'Not a packed visible-edge candidate'
            };
        }
        const visibleSlots = SlotEngine.getVisibleSlots(state, W);
        if (visibleSlots.length === 0) {
            return {
                valid: false,
                error: 'No visible slots'
            };
        }
        const firstVisibleIndex = visibleSlots[0].index;
        const lastVisibleIndex = visibleSlots[visibleSlots.length - 1].index;
        const isLeftVisibleEdge = i === firstVisibleIndex;
        const isRightVisibleEdge = i === lastVisibleIndex;
        if (!isLeftVisibleEdge && !isRightVisibleEdge) {
            return {
                valid: false,
                error: 'Not a visible edge slot'
            };
        }
        const maxX = W - newW;
        const currentStart = state.slotX[i];
        const currentEnd = currentStart + state.slotWidth[i];
        const rawCandidates = isLeftVisibleEdge ? [
            currentStart,
            currentEnd - newW,
            0
        ] : [
            currentStart,
            currentEnd - newW,
            maxX
        ];
        /** @type {number[]} */ const candidates = [];
        for (const rawX of rawCandidates){
            const x = Math.max(0, Math.min(maxX, rawX));
            if (!candidates.some((existing)=>Math.abs(existing - x) < EPSILON)) {
                candidates.push(x);
            }
        }
        for (const candidateX of candidates){
            const result = SlotEngine._buildPackedEdgeCandidateState(state, i, newType, newW, W, candidateX);
            if (result.valid) {
                DividerDebugLogger.log('SlotEngine._tryPackedVisibleEdgeFit', 'Visible-edge fallback accepted', {
                    i,
                    newType,
                    newW,
                    W,
                    side: isLeftVisibleEdge ? 'left' : 'right',
                    candidateX,
                    visibleIndices: visibleSlots.map((slot)=>slot.index),
                    state: DividerDebugLogger.summarizeEngineState(result.state)
                });
                return result;
            }
        }
        return {
            valid: false,
            error: 'No packed visible-edge candidate fits'
        };
    }
    /**
     * Fallback for packed edge slots. Some valid sparse layouts need the new
     * divider anchored to the drawer wall instead of expanding from the base
     * ghost slot edge.
     *
     * @private
     * @param {SlotState} state
     * @param {number} i
     * @param {string} newType
     * @param {number} newW
     * @param {number} W
     * @returns {{ valid: boolean, state?: SlotState, error?: string }}
     */ static _tryPackedEdgeFit(state, i, newType, newW, W) {
        const EPSILON = 0.01;
        const { type, slotWidth, slotX, N } = state;
        if (state.alignment !== 'packed' || N <= 1 || i !== 0 && i !== N - 1) {
            return {
                valid: false,
                error: 'Not a packed edge slot'
            };
        }
        const newState = {
            type: [
                ...type
            ],
            slotWidth: [
                ...slotWidth
            ],
            slotX: [
                ...slotX
            ],
            N,
            alignment: state.alignment
        };
        newState.type[i] = newType;
        newState.slotWidth[i] = newW;
        newState.slotX[i] = i === 0 ? 0 : W - newW;
        /** @type {Array<{start: number, end: number}>} */ const occupiedIntervals = [];
        for(let k = 0; k < N; k++){
            if (newState.type[k] === null) continue;
            const start = newState.slotX[k];
            const end = start + newState.slotWidth[k];
            if (start < -EPSILON || end > W + EPSILON) {
                return {
                    valid: false,
                    error: `Occupied slot ${k} out of bounds`
                };
            }
            const overlaps = occupiedIntervals.some((interval)=>start < interval.end - EPSILON && end > interval.start + EPSILON);
            if (overlaps) {
                return {
                    valid: false,
                    error: `Occupied slot ${k} overlaps another divider`
                };
            }
            occupiedIntervals.push({
                start,
                end
            });
        }
        for(let k = 0; k < N; k++){
            if (newState.type[k] !== null) continue;
            const start = newState.slotX[k];
            const end = start + newState.slotWidth[k];
            const overlapsOccupied = occupiedIntervals.some((interval)=>start < interval.end - EPSILON && end > interval.start + EPSILON);
            if (overlapsOccupied) {
                newState.slotX[k] = k < i ? -slotWidth[k] - 1 : W + 1;
            }
        }
        return {
            valid: true,
            state: newState
        };
    }
    /**
     * Build and validate a sparse packed layout candidate. Occupied dividers
     * must remain inside the drawer and cannot overlap. Empty slots are just
     * possible "+" affordances, so they can be moved outside the visible area
     * when the remaining gap is too small for another base divider.
     *
     * @private
     * @param {SlotState} state
     * @param {number} i
     * @param {string} newType
     * @param {number} newW
     * @param {number} W
     * @param {number} candidateX
     * @returns {{ valid: boolean, state?: SlotState, error?: string }}
     */ static _buildPackedEdgeCandidateState(state, i, newType, newW, W, candidateX) {
        const EPSILON = 0.01;
        const baseWidth = DIVIDER_WIDTHS.A;
        const { type, slotWidth, slotX, N } = state;
        const newState = {
            type: [
                ...type
            ],
            slotWidth: [
                ...slotWidth
            ],
            slotX: [
                ...slotX
            ],
            N,
            alignment: state.alignment
        };
        newState.type[i] = newType;
        newState.slotWidth[i] = newW;
        newState.slotX[i] = candidateX;
        /** @type {Array<{index: number, start: number, end: number}>} */ const occupiedIntervals = [];
        for(let k = 0; k < N; k++){
            if (newState.type[k] === null) continue;
            const start = newState.slotX[k];
            const end = start + newState.slotWidth[k];
            if (start < -EPSILON || end > W + EPSILON) {
                return {
                    valid: false,
                    error: `Occupied slot ${k} out of bounds`
                };
            }
            occupiedIntervals.push({
                index: k,
                start,
                end
            });
        }
        occupiedIntervals.sort((a, b)=>a.start - b.start);
        for(let k = 1; k < occupiedIntervals.length; k++){
            const previous = occupiedIntervals[k - 1];
            const current = occupiedIntervals[k];
            if (current.start < previous.end - EPSILON) {
                return {
                    valid: false,
                    error: `Occupied slot ${current.index} overlaps slot ${previous.index}`
                };
            }
        }
        for(let k = 0; k < N; k++){
            if (newState.type[k] !== null) continue;
            const start = newState.slotX[k];
            const end = start + newState.slotWidth[k];
            const outOfBounds = start < -EPSILON || end > W + EPSILON;
            const overlapsOccupied = occupiedIntervals.some((interval)=>start < interval.end - EPSILON && end > interval.start + EPSILON);
            const gapWidth = SlotEngine._getOpenGapWidthForSlot(start, end, occupiedIntervals, W);
            const hasUsableGhostSpace = gapWidth >= baseWidth - EPSILON;
            if (outOfBounds || overlapsOccupied || !hasUsableGhostSpace) {
                newState.slotX[k] = k < i ? -newState.slotWidth[k] - 1 : W + 1;
            }
        }
        return {
            valid: true,
            state: newState
        };
    }
    /**
     * Find the open gap containing an empty slot center.
     *
     * @private
     * @param {number} start
     * @param {number} end
     * @param {Array<{index: number, start: number, end: number}>} occupiedIntervals
     * @param {number} W
     * @returns {number}
     */ static _getOpenGapWidthForSlot(start, end, occupiedIntervals, W) {
        const center = start + (end - start) / 2;
        let left = 0;
        let right = W;
        for (const interval of occupiedIntervals){
            if (interval.end <= center) {
                left = Math.max(left, interval.end);
                continue;
            }
            if (interval.start >= center) {
                right = Math.min(right, interval.start);
                break;
            }
        }
        return Math.max(0, right - left);
    }
    /**
     * Видалити дівайдер (повернути слот до базового стану: type=null, width=A).
     *
     * @param {SlotState} state
     * @param {number} i - індекс слота
     * @param {number} W - ширина зони
     * @returns {{ valid: boolean, state?: SlotState, error?: string }}
     */ static removeDivider(state, i, W) {
        if (i < 0 || i >= state.N) {
            DividerDebugLogger.warn('SlotEngine.removeDivider', 'Slot index out of range', {
                i,
                W,
                state: DividerDebugLogger.summarizeEngineState(state)
            });
            return {
                valid: false,
                error: `Slot index ${i} out of range`
            };
        }
        if (state.type[i] === null) {
            // Вже порожній
            return {
                valid: true,
                state: {
                    type: [
                        ...state.type
                    ],
                    slotWidth: [
                        ...state.slotWidth
                    ],
                    slotX: [
                        ...state.slotX
                    ],
                    N: state.N,
                    alignment: state.alignment
                }
            };
        }
        // Повертаємо ширину до A, type → null
        const result = SlotEngine.setDivider(state, i, 'A', W);
        if (result.valid && result.state) {
            result.state.type[i] = null;
            DividerDebugLogger.log('SlotEngine.removeDivider', 'Divider removed from engine state', {
                i,
                W,
                state: DividerDebugLogger.summarizeEngineState(result.state)
            });
        }
        return result;
    }
    /**
     * Отримати видимі слоти (в межах зони [0, W]).
     * Порожні слоти поза межами просто не відображаються (обрізаються).
     *
     * @param {SlotState} state
     * @param {number} W
     * @returns {Array<{index: number, type: string|null, width: number, x: number}>}
     */ static getVisibleSlots(state, W) {
        const EPSILON = 0.01;
        const visible = [];
        for(let i = 0; i < state.N; i++){
            const start = state.slotX[i];
            const end = start + state.slotWidth[i];
            // Слот видимий якщо він повністю в межах зони
            if (start >= -EPSILON && end <= W + EPSILON) {
                visible.push({
                    index: i,
                    type: state.type[i],
                    width: state.slotWidth[i],
                    x: state.slotX[i]
                });
            }
        }
        return visible;
    }
    /**
     * Визначити доступні типи дівайдерів для слота i.
     * Перебирає кожен тип і перевіряє чи він вміститься через setDivider.
     *
     * @param {SlotState} state
     * @param {number} i
     * @param {number} W
     * @returns {string[]} - масив доступних типів ('A', 'B', 'C' тощо)
     */ static getAvailableTypesForSlot(state, i, W) {
        const available = [];
        for (const divType of Object.keys(DIVIDER_WIDTHS)){
            const result = SlotEngine.setDivider(state, i, divType, W);
            if (result.valid) {
                available.push(divType);
            }
        }
        DividerDebugLogger.log('SlotEngine.getAvailableTypesForSlot', 'Resolved available divider types for slot', {
            i,
            W,
            available,
            slot: {
                type: state.type?.[i] ?? null,
                width: DividerDebugLogger._round(state.slotWidth?.[i]),
                x: DividerDebugLogger._round(state.slotX?.[i])
            }
        });
        return available;
    }
}

export { SlotEngine };
