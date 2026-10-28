/**
 * Side panels per the client's "Hastings Config Guide" (xlsx, version 14.10.2026), for the Side panels section.
 *
 * Three things live here:
 *   - HANDLE_CONTROLS: which cabinet fields switch the handle per collection, and their values;
 *   - expectedPanelType(collectionId, cabinetConfig): the panel type the guide expects next to that cabinet;
 *   - GUIDE_TEST_CASES: short manual cases (preset → steps → expected) to walk through in the panel.
 *
 * Where the configurator stands (checked 14.10.2026):
 *   - ULH: implemented. The type follows the edge cabinet's Handle (handle_pto → NoG, handle_urban_topcut → UpperG).
 *   - UF: implemented (UF-SidePanel_Left/Right on the UF_SidePanel template). Keyed by the config Height as the UI sends it
 *     (NEW sheet D130:J137): 53 PTO short, 56 UG / CG short, 88 PTO tall, 91 UG / CG tall; the Handle does not change it.
 *     Parts and type follow the Height (53 / 88 → NoG, 56 / 91 → UpperG); CG has its own end panel and joint column at 91;
 *     joints 91+56 (UG, CG) and 88+53 (PTO) (NEW sheet A152:J159).
 *   - Tricot: implemented (Tricot-SidePanel_Left/Right on the Tricot_SidePanel template, modelled at the one 40 × 52 body).
 *     Plain panel (NoG), mirrored with scale x −1 on the left, follows CabinetColor; no joints (one height).
 *   - UD: the guide defines its own panels, the code does not yet (legacy panel, type = the requested one).
 *   - Class, Mako, Urban Standard: the guide has no side-panel rules.
 * Rows are the guide's sheet rows, e.g. "ULH:88" = sheet ULH, row 88.
 */

import { resolveUFSidePanelType } from '../../app-configuration/domain/product/logic/uf-side-panel-policy.mjs';

/** Collection id from a cabinet product type: 'ULH-side-cabinet' → 'ULH'. Urban Standard types have no prefix. */
export function collectionOfProductType(productType = '') {
    const prefixes = [['ULH-', 'ULH'], ['UD-', 'UD'], ['UF-', 'UF'], ['Mako-', 'MAKO'], ['Class-', 'CLASS'], ['Tricot-', 'TRICOT']];
    const match = prefixes.find(([prefix]) => productType.startsWith(prefix));
    return match ? match[1] : 'URBAN';
}

/**
 * Handle fields per collection: [{ key, values, note }]. The first field is the handle itself.
 * Changing them goes through setConfigBatch({ productIds }, { [key]: value }) on cabinets only.
 */
export const HANDLE_CONTROLS = Object.freeze({
    ULH: [{ key: 'Handle', values: ['handle_pto', 'handle_urban_topcut'], note: 'ULH:49-54. Drives the panel type.' }],
    UD: [
        { key: 'HandleSide', values: ['Right', 'Left'], note: 'UD:56-63 lateral panel side. With Height + Drawers it picks the type (UD:176-179).' },
        { key: 'HandleStyle', values: ['Duplex', 'Default'], note: 'UD:55. Default for widths 24-40 cm. Does not change the type.' },
        { key: 'Drawers', values: ['2D', '1DWID', '1D'], note: 'UD:67-69. 2D only at 56, 1DWID only at 53.' },
        { key: 'Height', values: ['56', '53', '38', '28'], note: 'UD:176-198.' }],
    UF: [
        { key: 'Handle', values: ['UG', 'PTO', 'CG', ''], note: 'As the UI sends it. It does not change the Height. CG: own fronts and side-panel column at 91. Empty = no handle.' },
        { key: 'Height', values: ['91', '88', '56', '53'], note: 'As the UI sends it: 91 (UG / CG) / 88 (PTO) tall, 56 (UG / CG) / 53 (PTO) short. Used as is.' }],
    MAKO: [{ key: 'HandleStyle', values: ['G57', 'G50'], note: 'ClassMako:68-77. The guide has no Mako side panels.' }],
    CLASS: [],
    TRICOT: [],
    URBAN: []
});

const ULH_TYPE_BY_HANDLE = Object.freeze({ handle_pto: 'NoG', handle_urban_topcut: 'UpperG' });
// UF by Height (NEW sheet D130:G130): 53 / 88 PTO → NoG, 56 / 91 Upper Groove.

/** UD:176-179 for 53 / 56, UD:192-198 for the 28 / 38 column cabinets (row 193 contradicts 176-179 — ask the artist). */
function expectedUrbanDuplexType({ Height, Drawers, HandleSide }) {
    const height = Number(Height);
    const isRightLateral = HandleSide !== 'Left';
    if (height === 56 && Drawers === '2D') return isRightLateral ? 'DoubleG' : 'NoG';
    if (height === 53 && isRightLateral) return 'UpperG';
    if (height === 28 || height === 38) return isRightLateral ? 'NoG' : 'UpperG';
    return null;
}

/**
 * The type the guide expects for a panel next to this cabinet, or null when the guide does not say.
 * expectedPanelType('ULH', { Handle: 'handle_pto' }) → { type: 'NoG', implemented: true }.
 */
export function expectedPanelType(collectionId, cabinetConfig = {}) {
    if (collectionId === 'ULH') {
        const type = ULH_TYPE_BY_HANDLE[cabinetConfig.Handle] ?? null;
        return type ? { type, implemented: true } : null;
    }
    if (collectionId === 'UD') {
        const type = expectedUrbanDuplexType(cabinetConfig);
        return type ? { type, implemented: false } : null;
    }
    if (collectionId === 'UF') {
        const type = resolveUFSidePanelType({ height: Number(cabinetConfig.Height) }) ?? null;
        return type ? { type, implemented: true } : null;
    }
    if (collectionId === 'TRICOT') return { type: 'NoG', implemented: true };
    return null;
}

/**
 * Manual cases: { id, collection, title, presetId?, steps: [...], expected }.
 * presetId names a preset of data/collection-presets.mjs (Load preset in the Presets section).
 */
export const GUIDE_TEST_CASES = Object.freeze([
    // --- ULH (implemented) ---
    { id: 'ulh-handle-switch', collection: 'ULH', title: 'Handle switch keeps the panel, changes its type', presetId: 'ulh-sb',
        steps: ['On both (NoG)', 'Handle → handle_urban_topcut, All cabinets', 'Handle → handle_pto'],
        expected: 'NoG (inlay hidden) → UpperG (inlay visible) → NoG. Panels are not re-added. ULH:88-101.' },
    { id: 'ulh-handle-wins', collection: 'ULH', title: 'The handle wins over the requested type', presetId: 'ulh-sb',
        steps: ['Type UpperG, On both', 'Handle handle_pto on all cabinets'],
        expected: 'Both panels NoG: the requested UpperG is ignored while the handle is PTO.' },
    { id: 'ulh-mixed-edges', collection: 'ULH', title: 'Each panel follows its own edge cabinet', presetId: 'ulh-sc-sb-sc',
        steps: ['On both', 'Handle → handle_urban_topcut, Left edge only'],
        expected: 'Left UpperG, right NoG. A handle change on the middle SB changes nothing.' },
    { id: 'ulh-gap-four', collection: 'ULH', title: 'Two groups with a gap get four panels', presetId: 'ulh-two-groups',
        steps: ['On both', 'Off right'],
        expected: '4 panels (two face the gap) → 2 left panels, one per group.' },
    { id: 'ulh-stack', collection: 'ULH', title: 'A stack gets one panel per row', presetId: 'ulh-stack-flush',
        steps: ['On both'],
        expected: '4 panels; each row\'s panel has that row\'s height (38), Y from the row bottom; heights are not summed.' },
    { id: 'ulh-height-depth', collection: 'ULH', title: 'Panel size follows the edge cabinet', presetId: 'ulh-sb',
        steps: ['On both', 'Height 25 → 38 (Cabinets section)', 'Depth 46 → 50.5'],
        expected: 'NoG StretchY 0 → 0.323; depth StretchZ 0 → 0.09. Heights outside 25/28/35/38/50/56 keep the old panel (warning only).' },
    { id: 'ulh-open-shelf-edge', collection: 'ULH', title: 'Open shelf at the edge', presetId: 'ulh-sb-os',
        steps: ['On both'],
        expected: 'The guide expects a panel next to the OS too. Today: no panel on the OS side (OS has no side-panel support) — report if so.' },
    // --- UD (guide only, not implemented yet) ---
    { id: 'ud-lateral-side', collection: 'UD', title: 'Lateral side picks DoubleG / NoG at 56 · 2D', presetId: 'ud-row-56',
        steps: ['On both', 'HandleSide Right → Left on the edge cabinets'],
        expected: 'Guide: Right → DoubleG, Left → NoG (UD:176-179). Today: the requested type stays (not implemented).' },
    { id: 'ud-53-upper', collection: 'UD', title: '53 high + right lateral → UpperG', presetId: 'ud-row-56',
        steps: ['Height 53, Drawers 1D on all cabinets', 'On both'],
        expected: 'Guide: UpperG; NoG mesh switches 56H → 53H (UD:177-180). 1DWID / left lateral is not defined in the guide.' },
    // --- UF (implemented) ---
    { id: 'uf-height-handle', collection: 'UF', title: 'Height switches handle and panel parts', presetId: 'uf-sb',
        steps: ['On both', 'Height 91 → 88 → 56 → 53 (All cabinets)', 'Depth 50 → 46 (Cabinets section)'],
        expected: '91 Bot+inlay+Top stretched to 0.91 (UpperG), 88 Full (NoG), 56 Bot+inlay (UpperG), 53 Bot (NoG) (NEW sheet D130:H136). Depth 46: the panel front recedes 4 cm with the cabinet front (StretchZ −0.08 on a back-anchored mesh).' },
    { id: 'uf-handle-height', collection: 'UF', title: 'Handle and Height as the UI sends them', presetId: 'uf-sb',
        steps: ['On both', 'Handle → PTO and Height → 88, All cabinets', 'Handle → UG and Height → 91', 'Handle → CG'],
        expected: 'PTO 88: NoCut fronts, no grooves, panel Full (NoG). UG 91: grooves + TopCut, panel Bot+inlay+Top stretched to 0.91 (UpperG). CG 91: BotCut front, no top groove, panels with both inlays (UpperG).' },
    { id: 'uf-joint-88-53', collection: 'UF', title: 'Joint 88+53 (PTO): strip on the taller cabinet', presetId: 'uf-joint-88-53',
        steps: ['On both', 'Off right'],
        expected: '3 panels: left end on 88, right end on 53, joint on 88 facing right (Panel_Top at 0.53 stretched 0.06; NEW sheet H153:J159). Off right removes the right end AND the joint (it faces right). The countertop is not lengthened by the joint.' },
    { id: 'uf-joint-91-56', collection: 'UF', title: 'Joint 91+56 (UG / CG): strip on the taller cabinet', presetId: 'uf-joint-91-56',
        steps: ['On both', 'Handle → UG, then Handle → CG (All cabinets)'],
        expected: '3 panels. UG: joint on 91 = Inlay_Top + Panel_Top at 0.56 (B153:D159). CG: Panel_Top at 0.53 stretched 0.06 (E153:G159).' },
    { id: 'uf-joint-unknown', collection: 'UF', title: 'A pair the guide does not define', presetId: 'uf-joint-unknown',
        steps: ['On both', 'Edges plan → Measure edges'],
        expected: 'Only the two end panels; the tall face toward a pair the guide lacks (e.g. 91 beside 53) is "partial → unsupported-joint".' },
    // --- Tricot (implemented) ---
    { id: 'tricot-move', collection: 'TRICOT', title: 'Tricot panel at the outer ends', presetId: 'tricot-sc-sb-sc',
        steps: ['On both'],
        expected: 'Tricot_SidePanel at both outer ends, as high (40) and deep (52) as the cabinets, mirrored with scale x −1 on the left; follows CabinetColor, not the pattern (Tricot:76-87, 115).' },
    { id: 'mako-no-rule', collection: 'MAKO', title: 'Mako: no side panels in the guide', presetId: 'mako-sb',
        steps: ['On both', 'HandleStyle G57 → G50'],
        expected: 'The guide defines none. Legacy panels have no 52-high mesh: check for a wrong or missing panel and ask whether Mako needs panels.' }
]);
