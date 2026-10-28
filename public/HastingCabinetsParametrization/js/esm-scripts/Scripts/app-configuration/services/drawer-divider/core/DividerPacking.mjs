// @ts-check
/**
 * DividerPacking — чисте ядро розміщення дивайдерів (Варіант 2).
 *
 * Модель (підтверджена з клієнтом):
 *  - дивайдери стоять на ФАКТИЧНИХ позиціях (start у см), проміжки дозволені будь-де
 *  - вільний простір розбивається на СЕГМЕНТИ (між дивайдерами і стінками,
 *    з урахуванням spacing)
 *  - у КОЖНОМУ вільному сегменті ≥ ширини типу — кандидат(и):
 *      сегмент ≥ 2w : 2 «+» (лівий край + правий край сегмента)
 *      w ≤ сегмент < 2w : 1 «+» (left-pack у сегмент)
 *      сегмент < w : 0
 *  - кандидат left-pack тулиться до лівого сусіда → заповнення малого проміжку
 *    стуляє дивайдери щільно (компактизація виходить природно)
 *  - позиції рахуються від фактичних ширин, без A-ґратки → overlap НЕМОЖЛИВИЙ
 *    (у сегменті максимум 2 кандидати, і вони не перетинаються за конструкцією)
 */ const EPSILON = 0.01;
/**
 * @typedef {{ stateId?: string, value: string, width: number, start: number }} PlacedSlot
 * @typedef {{ stateId?: string, value: string, start: number, center: number, end: number }} PlacedDivider
 * @typedef {{ start: number, end: number, width: number }} FreeSegment
 * @typedef {{ anchor: 'left'|'right', start: number, center: number, end: number, width: number, segment: FreeSegment }} PackCandidate
 * @typedef {{ placed: PlacedDivider[], segments: FreeSegment[], candidates: PackCandidate[] }} PackResult
 */ /**
 * Обчислити вільні сегменти між дивайдерами та стінками (з зазором spacing).
 *
 * @param {number} zoneWidth
 * @param {PlacedDivider[]} sorted - відсортовані за start
 * @param {number} spacing
 * @returns {FreeSegment[]}
 */ function computeFreeSegments(zoneWidth, sorted, spacing) {
    /** @type {FreeSegment[]} */ const segments = [];
    for(let i = 0; i <= sorted.length; i++){
        const prev = sorted[i - 1];
        const next = sorted[i];
        const start = prev ? prev.end + spacing : 0;
        const end = next ? next.start - spacing : zoneWidth;
        const width = end - start;
        if (width > EPSILON) segments.push({
            start,
            center: 0,
            end,
            width
        });
    }
    return segments;
}
/**
 * @param {number} zoneWidth - ширина зони в см
 * @param {PlacedSlot[]} slots - встановлені дивайдери з позицією start
 * @param {number} selectedWidth - ширина вибраного типу для кандидатів (0 = без кандидатів)
 * @param {number} spacing - фіксований зазор між сусідами
 * @param {'edges-left'|'edges-right'|'edges-both'} [strategy='edges-both'] -
 *        який бік сегмента пропонувати. siphon-зони односторонні (пакують від
 *        зовнішньої стінки до вирізу); Bot/TopFull main — обидва боки.
 * @returns {PackResult}
 */ function packZone(zoneWidth, slots, selectedWidth, spacing, strategy = 'edges-both') {
    /** @type {PlacedDivider[]} */ const sorted = [
        ...slots
    ].map((s)=>({
            stateId: s.stateId,
            value: s.value,
            start: s.start,
            center: s.start + s.width / 2,
            end: s.start + s.width
        })).sort((a, b)=>a.start - b.start);
    const segments = computeFreeSegments(zoneWidth, sorted, spacing);
    // Тайлимо УСІ доступні позиції в кожному сегменті (крок = ширина+spacing),
    // не лише краї → показуємо всі місця, куди тип влазить, без overlap.
    // Напрям тайлингу: edges-right (siphon_right) — від правої стінки; інакше — від лівої.
    /** @type {PackCandidate[]} */ const candidates = [];
    const w = selectedWidth;
    if (w > 0) {
        const step = w + spacing;
        const tileFromRight = strategy === 'edges-right';
        for (const seg of segments){
            if (seg.width < w - EPSILON) continue;
            const fitCount = Math.floor((seg.width + spacing) / step + 1e-6);
            for(let i = 0; i < fitCount; i++){
                const start = tileFromRight ? seg.end - w - i * step : seg.start + i * step;
                candidates.push(makeCandidate(tileFromRight ? 'right' : 'left', start, w, seg));
            }
        }
    }
    return {
        placed: sorted,
        segments,
        candidates
    };
}
/**
 * @param {'left'|'right'} anchor
 * @param {number} start
 * @param {number} w
 * @param {FreeSegment} segment
 * @returns {PackCandidate}
 */ function makeCandidate(anchor, start, w, segment) {
    const end = start + w;
    return {
        anchor,
        start,
        center: (start + end) / 2,
        end,
        width: w,
        segment
    };
}
/**
 * Стратегія боку packZone з alignment-стратегії зони.
 * @param {string} zoneStrategy
 * @returns {'edges-left'|'edges-right'|'edges-both'}
 */ function packStrategy(zoneStrategy) {
    if (zoneStrategy === 'edges-left') return 'edges-left';
    if (zoneStrategy === 'edges-right') return 'edges-right';
    return 'edges-both';
}
/**
 * Occupied дивайдери з позиціями (start) для packZone з compact-слотів зони.
 * Якщо слот має `start` (V2) — беремо його; інакше тимчасова деривація:
 * щільне пакування за порядком масиву (до переходу store на позиції).
 *
 * @param {Array<any>|undefined} slots
 * @param {Object<string,number>} dividerWidths
 * @param {number} spacing
 * @returns {PackSlot[]}
 */ function occupiedFromCompact(slots, dividerWidths, spacing) {
    if (!Array.isArray(slots)) return [];
    const occupied = slots.filter((s)=>s.value && s.value !== 'empty' && s.value !== 'none');
    let cursor = 0;
    return occupied.map((s)=>{
        const width = dividerWidths[s.value] || 0;
        const stored = typeof s.start === 'number' ? s.start : typeof s.other?.start === 'number' ? s.other.start : null;
        const start = stored !== null ? stored : cursor;
        if (stored === null) cursor = start + width + spacing;
        return {
            stateId: s.stateId || s.other?.stateId,
            value: s.value,
            width,
            start
        };
    });
}

export { occupiedFromCompact, packStrategy, packZone };
