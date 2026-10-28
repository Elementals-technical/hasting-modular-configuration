import {
    ULH_SIDE_PANEL_PROFILE,
    ULH_SIDE_PANEL_NODES,
    resolveULHSidePanelType,
    resolveULHSidePanelPlan
} from '../product/logic/ulh-side-panel-policy.mjs';
import {
    UF_SIDE_PANEL_PROFILE,
    UF_SIDE_PANEL_NODES,
    UF_SIDE_PANEL_PART_NAMES,
    resolveUFSidePanelType,
    resolveUFSidePanelPlan
} from '../product/logic/uf-side-panel-policy.mjs';
import {
    TRICOT_SIDE_PANEL_PROFILE,
    TRICOT_SIDE_PANEL_NODES,
    TRICOT_BODY_HEIGHT_CM,
    resolveTricotSidePanelType,
    resolveTricotSidePanelPlan
} from '../product/logic/tricot-side-panel-policy.mjs';
import { resolveUFHeight } from '../product/logic/uf-cabinet-height-policy.mjs';
import { finiteNumber } from '../product/logic/side-panel-tables.mjs';

/**
 * Side panel profiles of the collections that use the GROUP panel pipeline.
 * A profile tells the shared pipeline which cabinets it serves, which scene nodes
 * a panel template must have, how tall a cabinet body is (cm) and how to turn cabinet state
 * into a panel plan.
 */

const ufHeightOfConfig = cabinetConfig => resolveUFHeight(cabinetConfig?.Height);

const ULH_PROFILE = Object.freeze({
    id: ULH_SIDE_PANEL_PROFILE,
    collectionTags: Object.freeze(['urban-low-height']),
    requiredNodes: Object.freeze(Object.values(ULH_SIDE_PANEL_NODES)),
    supportsJoints: false,
    rootAtCabinetBottom: false,

    bodyHeightOf(cabinetConfig) {
        return finiteNumber(cabinetConfig?.Height);
    },

    resolveAppearance({ cabinetConfig, requestedType }) {
        return resolveULHSidePanelType({ handle: cabinetConfig?.Handle, requestedType });
    },

    resolvePlan({ cabinetConfig, requestedType, side, face }) {
        if (face !== 'end') {
            return Object.freeze({ status: 'unresolved', reason: 'unsupported-face' });
        }
        return resolveULHSidePanelPlan({
            handle: cabinetConfig?.Handle,
            requestedType,
            height: cabinetConfig?.Height,
            depth: cabinetConfig?.Depth,
            side
        });
    }
});

const UF_PROFILE = Object.freeze({
    id: UF_SIDE_PANEL_PROFILE,
    // 'urban-freestanding' (open shelves) is intended: a UF line with open shelves stays on the group
    // pipeline; the shelves themselves have no side panel support, so their edges just get no panel.
    collectionTags: Object.freeze(['urban-freestanding', 'urban-freestanding-sink', 'urban-freestanding-side']),
    requiredNodes: Object.freeze([UF_SIDE_PANEL_NODES.point, ...UF_SIDE_PANEL_PART_NAMES]),
    supportsJoints: true,
    rootAtCabinetBottom: true,

    // The UF height is the config Height as is (53 / 56 / 88 / 91); null for an unknown one.
    bodyHeightOf(cabinetConfig) {
        return ufHeightOfConfig(cabinetConfig);
    },

    // UF appearance follows the height, never the requested type; null for an unknown height.
    resolveAppearance({ cabinetConfig }) {
        return resolveUFSidePanelType({ height: ufHeightOfConfig(cabinetConfig) });
    },

    resolvePlan({ cabinetConfig, side, face, neighbourConfig }) {
        return resolveUFSidePanelPlan({
            side,
            face,
            height: ufHeightOfConfig(cabinetConfig),
            depth: cabinetConfig?.Depth,
            neighbourHeight: neighbourConfig ? ufHeightOfConfig(neighbourConfig) : null,
            // The tall cabinet's handle: 91 Central Groove has its own panel column.
            handle: cabinetConfig?.Handle
        });
    }
});

const TRICOT_PROFILE = Object.freeze({
    id: TRICOT_SIDE_PANEL_PROFILE,
    collectionTags: Object.freeze(['tricot-sink', 'tricot-side']),
    requiredNodes: Object.freeze([TRICOT_SIDE_PANEL_NODES.panel]),
    supportsJoints: false,
    // The panel mesh starts at its bottom, like the UF parts.
    rootAtCabinetBottom: true,

    // Every Tricot body is 40 cm high, whatever Height the config carries.
    bodyHeightOf() {
        return TRICOT_BODY_HEIGHT_CM;
    },

    resolveAppearance() {
        return resolveTricotSidePanelType();
    },

    resolvePlan({ side, face }) {
        return resolveTricotSidePanelPlan({ side, face });
    }
});

const PROFILES_BY_ID = Object.freeze({
    [ULH_PROFILE.id]: ULH_PROFILE,
    [UF_PROFILE.id]: UF_PROFILE,
    [TRICOT_PROFILE.id]: TRICOT_PROFILE
});

/**
 * Look up a group side panel profile by its id.
 * @example sidePanelProfileOf('uf').rootAtCabinetBottom // true
 * @param {string} profileId
 * @returns {object|null} the frozen profile, or null for an unknown id
 */
export function sidePanelProfileOf(profileId) {
    return PROFILES_BY_ID[profileId] ?? null;
}

const sharesCollectionTag = (profile, tags) =>
    Array.isArray(tags) && tags.some(tag => profile.collectionTags.includes(tag));

const coversEveryCabinet = (profile, tagLists) =>
    tagLists.every(tags => sharesCollectionTag(profile, tags));

/**
 * Find the group profile that serves every cabinet of a composition.
 * @example groupPanelProfileForTags([['cabinet', 'urban-freestanding-sink']]).id // 'uf'
 * @param {string[][]} tagLists one tag list per cabinet
 * @returns {object|null} the profile, or null when there are no cabinets or no single profile covers them all
 */
export function groupPanelProfileForTags(tagLists) {
    if (!Array.isArray(tagLists) || tagLists.length === 0) return null;

    return Object.values(PROFILES_BY_ID).find(profile => coversEveryCabinet(profile, tagLists)) ?? null;
}
