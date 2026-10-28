/**
 * Basin top policies: on WHICH cabinets of a line the basin (main) countertop lies when the
 * cabinets have different heights. The cabinets left out get cabinet covers.
 *
 * A collection picks a policy by id in countertop-collections.mjs (`basinTopPolicy`).
 * RuleCountertopLayout measures the line and calls selectBasinTopCabinets(policyId, items) only for
 * the legacy line layout (no modular runtime) with a found basin top.
 *
 * items: one per cabinet, [{ id, worldY, xMinM, xMaxM }]
 *   worldY  world Y of the cabinet's countertop support plane (its top)
 *   xMinM/xMaxM  world X extent of the cabinet body
 * A policy returns a Set of cabinet ids for the basin top, or null = keep ALL cabinets under the top
 * (the behaviour of a collection without a policy).
 *
 * Add a policy = add a function to BASIN_TOP_POLICIES and reference its id from a collection.
 */

const finite = value => typeof value === 'number' && Number.isFinite(value);

/**
 * 'highest-plane' (Urban Freestanding): the basin top lies on the HIGHEST cabinets of the line —
 * the touching cabinets whose top is at the highest height. The sink cabinet is one of them: the UI
 * does not offer a sink cabinet lower than the others (Andriy 13.10). Every lower cabinet gets a cover.
 *   SB 88 | SC 53            -> top on SB, cover on SC
 *   53 | SB 88 | SC 88 | 53  -> top on SB + SC, covers on both 53
 * One run of highest cabinets is expected (Andriy 13.10). If there are several (88 | 53 | 88), the
 * leftmost run gets the top and the others get covers.
 * null (keep all): every cabinet on one plane, or a cabinet unmeasured.
 */
// levelM: tops closer than 1 mm are the same height (measurement noise).
// gapM: cabinets closer than 5 mm stand side by side (line layout gap + mesh noise).
export function highestPlanePolicy(items, { levelM = 0.001, gapM = 0.005 } = {}) {
    // 1. Every cabinet measured, and at least two of them.
    const measured = Array.isArray(items) && items.length >= 2 && items.every(item =>
        item && finite(item.worldY) && finite(item.xMinM) && finite(item.xMaxM));
    if (!measured) return null;

    // 2. All tops at one height: nothing to split, the top lies on all cabinets.
    const tops = items.map(item => item.worldY);
    const highestTop = Math.max(...tops);
    if (highestTop - Math.min(...tops) <= levelM) return null;

    // 3. Cabinets left to right; the first highest cabinet starts the run.
    const line = [...items].sort((a, b) => a.xMinM - b.xMinM);
    const isHighest = item => highestTop - item.worldY <= levelM;
    const touching = (left, right) => right.xMinM - left.xMaxM <= gapM;
    const first = line.findIndex(isHighest);

    // 4. Extend right while the next cabinet is also highest AND touches its neighbour.
    let last = first;
    while (last < line.length - 1 && isHighest(line[last + 1]) && touching(line[last], line[last + 1])) last++;

    // 5. Cabinets from `first` to `last` carry the basin top; the rest get covers.
    return new Set(line.slice(first, last + 1).map(item => item.id));
}

const BASIN_TOP_POLICIES = {
    'highest-plane': highestPlanePolicy
};

/** Cabinet ids the basin top lies on under policy `policyId`, or null (no/unknown policy: keep all). */
export function selectBasinTopCabinets(policyId, items) {
    const policy = BASIN_TOP_POLICIES[policyId];
    return policy ? policy(items) : null;
}
