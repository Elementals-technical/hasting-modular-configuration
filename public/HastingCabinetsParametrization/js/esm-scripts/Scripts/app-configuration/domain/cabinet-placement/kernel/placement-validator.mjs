import { reason } from '../cabinet-contracts.mjs';
import { CHECKS } from './placement-checks.mjs';
import { assertPack } from './pack-schema.mjs';

const RANK = Object.freeze({
    valid: 0,
    pending: 1,
    unsupported: 2,
    invalid: 3
});
const keyOf = (ruleId, ids)=>`${ruleId}:${[
        ...ids
    ].sort().join(',')}`;
const format = (template, params = {})=>typeof template === 'string' ? template.replace(/\{(\w+)\}/g, (m, k)=>params[k] === undefined ? m : String(params[k])) : null;
const violationKeys = (result)=>new Set((result?.reasons ?? []).map((r)=>keyOf(r.ruleId, r.affectedProductIds)));
function createPlacementValidator(pack, { checks = CHECKS } = {}) {
    assertPack(pack, checks);
    const rules = pack.rules.filter((rule)=>rule.enabled !== false);
    const appliesTo = (rule, phase)=>!phase || (rule.phase ?? 'validate') === phase;
    function validate(facts, { phase = null, focusIds = [], baseline = null } = {}) {
        const focus = new Set(focusIds), reasons = [];
        for (const rule of rules){
            if (!appliesTo(rule, phase)) continue;
            for (const v of checks[rule.check](facts, rule.params ?? {}, pack)){
                if (focus.size && ![
                    ...v.ids,
                    ...v.focus ?? []
                ].some((id)=>focus.has(id))) continue;
                if (baseline?.has(keyOf(rule.id, v.ids))) continue;
                const decisionIds = v.unresolved ? rule.decisionIds ?? [
                    `Q-${rule.id}`
                ] : rule.decisionIds ?? [];
                const severity = v.unresolved ? 'unsupported' : rule.severity ?? 'invalid';
                reasons.push({
                    ...reason(rule.code, decisionIds, v.params ?? {}),
                    affectedProductIds: [
                        ...v.ids
                    ],
                    ruleId: rule.id,
                    severity,
                    // a check may pick a variant text of its rule (`messageId`, e.g. 'TRAP_KEEPOUT.SB_BESIDE'); falls back to the code's
                    message: format(pack.messages?.[v.messageId] ?? pack.messages?.[rule.code], v.params)
                });
            }
        }
        const status = reasons.reduce((s, r)=>RANK[r.severity] > RANK[s] ? r.severity : s, 'valid');
        return {
            status,
            reasons,
            requiredDecisionIds: [
                ...new Set(reasons.flatMap((r)=>r.decisionIds))
            ].sort()
        };
    }
    return Object.freeze({
        pack,
        validate,
        rules: ()=>rules.map((r)=>({
                    ...r
                }))
    });
}

export { createPlacementValidator, violationKeys };
