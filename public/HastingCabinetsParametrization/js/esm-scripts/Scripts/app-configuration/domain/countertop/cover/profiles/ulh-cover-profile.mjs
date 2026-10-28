/**
 * Pure ULH cover eligibility policy.
 *
 * Settings supplied by the composition adapter:
 * - `mode`: `all` or `sc-with-adjacent-open`
 * - `role`: explicit `CabinetRole` (`SC`, `OS`, `OSS`, or `SB`)
 * - `adjacentRoles`: roles of physically adjacent cabinets. An open cabinet is
 *   an extension only when `SC` is explicitly present; OS-to-OSS inference is
 *   intentionally not transitive.
 *
 * Explicit `all` mode covers every verified ULH structural support and does not
 * require a role. The selective mode never infers a role from product type;
 * missing and future role values therefore remain `unknown`.
 */ const KNOWN_ROLES = Object.freeze([
    'SC',
    'OS',
    'OSS',
    'SB'
]);
function resolveUlHEligibility({ role, mode, adjacentRoles } = {}) {
    if (mode === 'all') return 'direct';
    if (mode !== 'sc-with-adjacent-open') return 'unknown';
    if (!KNOWN_ROLES.includes(role)) return 'unknown';
    if (role === 'SC') return 'direct';
    if (role === 'SB') return 'none';
    if (role === 'OS' || role === 'OSS') {
        if (!Array.isArray(adjacentRoles)) return 'unknown';
        return adjacentRoles.includes('SC') ? 'extension' : 'none';
    }
    return 'unknown';
}

export { resolveUlHEligibility };
