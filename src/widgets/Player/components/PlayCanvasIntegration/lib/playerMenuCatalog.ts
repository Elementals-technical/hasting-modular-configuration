import {
  PLAYER_MENU_ITEM_IDS,
  selectAttribute,
  type CustomizationFlowId,
  type CustomizationSchema,
  type CustomizationScreenId,
  type PlayerMenuItemId,
  type ProductProfile,
} from "@/entities/collection";
import {
  resolveAttributeTarget,
  resolveScreenTarget,
  type CustomizationTarget,
} from "@/features/collectionCustomization";

/**
 * What an item of the player menu needs from the collection's data. An item that leads somewhere
 * is shown where the collection has that place; the place is read from its ui.json, so no step or
 * section id of one collection is spelled here.
 */
type PlayerMenuItemSpec = {
  /**
   * The step (and section) the item opens: the one that shows the attribute, or the page of the
   * screen. In the given flow, or in the flow the menu is opened in.
   */
  leadsTo?: ({ attributeId: string } | { screen: CustomizationScreenId }) & { flowId?: CustomizationFlowId };
  /** An attribute the profile must declare, for an item that changes it in place. */
  attributeId?: string;
};

const PLAYER_MENU_ITEMS: Record<PlayerMenuItemId, PlayerMenuItemSpec> = {
  resize: {},
  reposition: {},
  color: { leadsTo: { attributeId: "CabinetColor" } },
  // In Prebuilt both ask to customize first and continue in the custom flow.
  add: { leadsTo: { attributeId: "CabinetType", flowId: "custom" } },
  "cabinet-style": { leadsTo: { attributeId: "Drawers", flowId: "custom" } },
  "handle-style": { attributeId: "Handle" },
  accessories: { leadsTo: { screen: "accessories" } },
  duplicate: {},
  open: {},
  delete: {},
  "countertop-color": { leadsTo: { attributeId: "CountertopColor" } },
  "countertop-thickness": { leadsTo: { attributeId: "Thickness" } },
  "countertop-style": { leadsTo: { attributeId: "CountertopStyle" } },
  "basin-style": { leadsTo: { attributeId: "sinkType" } },
  "countertop-position": {},
  "vessel-style": { leadsTo: { attributeId: "sinkType" } },
  "vessel-color": { leadsTo: { attributeId: "VesselColor" } },
};

/** The items a collection offers in one flow of the menu, and where each that leads somewhere goes. */
export type PlayerMenuSupport = {
  items: ReadonlySet<PlayerMenuItemId>;
  targets: Partial<Record<PlayerMenuItemId, CustomizationTarget>>;
};

const resolveSpecTarget = (
  schema: CustomizationSchema | null,
  flowId: CustomizationFlowId,
  leadsTo: NonNullable<PlayerMenuItemSpec["leadsTo"]>,
): CustomizationTarget | null => {
  const targetFlowId = leadsTo.flowId ?? flowId;

  return "screen" in leadsTo
    ? resolveScreenTarget(schema, targetFlowId, leadsTo.screen)
    : resolveAttributeTarget(schema, targetFlowId, leadsTo.attributeId);
};

/**
 * The items the active collection supports in the flow: its data has the place an item leads to
 * and the attribute an item changes, and its ui.json does not hide the item. Runtime conditions
 * (the selected cabinet, the room left on the countertop) are applied by the menu on top of these.
 */
export const resolvePlayerMenuSupport = (
  schema: CustomizationSchema | null,
  profile: ProductProfile | null,
  flowId: CustomizationFlowId,
): PlayerMenuSupport => {
  const hidden = new Set(schema?.playerMenu?.hidden ?? []);
  const items = new Set<PlayerMenuItemId>();
  const targets: Partial<Record<PlayerMenuItemId, CustomizationTarget>> = {};

  for (const itemId of PLAYER_MENU_ITEM_IDS) {
    const { leadsTo, attributeId } = PLAYER_MENU_ITEMS[itemId];
    const target = leadsTo ? resolveSpecTarget(schema, flowId, leadsTo) : null;

    if (hidden.has(itemId) || (leadsTo && !target) || (attributeId && !selectAttribute(profile, attributeId))) {
      continue;
    }

    items.add(itemId);
    if (target) targets[itemId] = target;
  }

  return { items, targets };
};
