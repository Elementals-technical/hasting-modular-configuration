import { outcome, reason } from './cabinet-contracts.mjs';

/** Build undirected connected components from verified profile contacts, never add order or snap points. */
export function resolveConnectionGroups({ cabinetIds, connections, allowedRules } = {}) {
    const bad = () => outcome('invalid', [reason('INVALID_CONNECTION_GRAPH')]);
    if (!Array.isArray(cabinetIds) || !cabinetIds.every(id => typeof id === 'string' && id) ||
        new Set(cabinetIds).size !== cabinetIds.length || !Array.isArray(connections) || !Array.isArray(allowedRules)) return bad();
    const adjacency = new Map(cabinetIds.map(id => [id, new Set()]));
    const edgeIds = new Set();
    for (const edge of connections) {
        const a = edge?.a?.cabinetId, b = edge?.b?.cabinetId;
        if (!edge?.id || edgeIds.has(edge.id) || !adjacency.has(a) || !adjacency.has(b) || a === b ||
            typeof edge.a.surfaceId !== 'string' || !edge.a.surfaceId ||
            typeof edge.b.surfaceId !== 'string' || !edge.b.surfaceId) return bad();
        edgeIds.add(edge.id);
        if (!allowedRules.some(rule => rule.ruleId === edge.ruleId && rule.kind === edge.kind)) {
            return outcome('unsupported', [reason('CONTACT_RULE_UNRESOLVED', ['Q-CONTACT'])]);
        }
        adjacency.get(a).add(b); adjacency.get(b).add(a);
    }
    const seen = new Set(), groups = [];
    for (const id of [...cabinetIds].sort()) {
        if (seen.has(id)) continue;
        const pending = [id], members = [];
        while (pending.length) {
            const current = pending.pop();
            if (seen.has(current)) continue;
            seen.add(current); members.push(current);
            pending.push(...adjacency.get(current));
        }
        members.sort();
        groups.push({ id: 'group:' + JSON.stringify(members), cabinetIds: members });
    }
    return outcome('valid', [], { groups });
}
