/** Fail-fast validation of a collection pack against the check registry. Data mistakes surface at
 * activation / in tests, never as a silently permissive rule at drag time. */
import { isRecord } from '../cabinet-contracts.mjs';

export const SEVERITIES = Object.freeze(['invalid', 'unsupported', 'pending']);
export const PHASES = Object.freeze(['validate', 'veto']);
const fail = (path, what) => { throw new TypeError(`Invalid placement pack at ${path}: ${what}`); };
const str = v => typeof v === 'string' && v.length > 0;

function assertSelector(selector, path, traitNames) {
    if (selector === undefined) return;
    if (!isRecord(selector)) fail(path, 'selector must be an object');
    if (selector.role !== undefined && (!Array.isArray(selector.role) || !selector.role.every(str))) fail(path + '.role', 'list of role ids');
    if (selector.trait !== undefined && !traitNames.has(selector.trait)) fail(path + '.trait', `unknown trait '${selector.trait}'`);
}

export function assertPack(pack, checks) {
    if (!isRecord(pack)) fail('$', 'pack must be an object');
    if (!str(pack.id)) fail('id', 'required');
    if (!isRecord(pack.roles) || !Object.values(pack.roles).every(str)) fail('roles', 'productType -> role id map');
    const roleIds = new Set(Object.values(pack.roles));
    if (!isRecord(pack.traits)) fail('traits', 'role id -> traits map');
    const traitNames = new Set();
    for (const [role, traits] of Object.entries(pack.traits)) {
        if (!roleIds.has(role)) fail(`traits.${role}`, 'role is not declared in roles');
        if (!isRecord(traits)) fail(`traits.${role}`, 'must be an object');
        for (const name of Object.keys(traits)) traitNames.add(name);
    }
    for (const role of roleIds) {
        for (const name of traitNames) if (!Object.hasOwn(pack.traits[role] ?? {}, name)) fail(`traits.${role}.${name}`, 'missing (use null for an open question)');
    }
    if (!isRecord(pack.tolerances) || !Number.isFinite(pack.tolerances.levelM)) fail('tolerances.levelM', 'finite number required');
    if (!Array.isArray(pack.rules)) fail('rules', 'array required');
    const ids = new Set(), codes = new Set();
    pack.rules.forEach((rule, i) => {
        const path = `rules[${i}]`;
        if (!isRecord(rule) || !str(rule.id) || !str(rule.code) || !str(rule.check)) fail(path, 'id, code and check are required');
        if (ids.has(rule.id)) fail(path + '.id', `duplicate '${rule.id}'`);
        if (codes.has(rule.code)) fail(path + '.code', `duplicate '${rule.code}'`);
        ids.add(rule.id); codes.add(rule.code);
        if (typeof checks?.[rule.check] !== 'function') fail(path + '.check', `unknown check '${rule.check}'`);
        if (rule.severity !== undefined && !SEVERITIES.includes(rule.severity)) fail(path + '.severity', SEVERITIES.join('|'));
        if (rule.phase !== undefined && !PHASES.includes(rule.phase)) fail(path + '.phase', PHASES.join('|'));
        if (rule.decisionIds !== undefined && (!Array.isArray(rule.decisionIds) || !rule.decisionIds.every(str))) fail(path + '.decisionIds', 'list of ids');
        if (rule.params !== undefined && !isRecord(rule.params)) fail(path + '.params', 'object');
        for (const key of ['upper', 'lower', 'select', 'subject', 'reference']) assertSelector(rule.params?.[key], `${path}.params.${key}`, traitNames);
    });
    if (pack.messages !== undefined && (!isRecord(pack.messages) || !Object.values(pack.messages).every(v => typeof v === 'string'))) fail('messages', 'code -> text map');
    return pack;
}
