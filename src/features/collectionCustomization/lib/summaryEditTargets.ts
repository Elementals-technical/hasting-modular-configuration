import type { CustomizationFlowId, CustomizationSchema, CustomizationScreenId } from "@/entities/collection";

import { resolveEntryStep } from "./computeNavigation";
import { resolveAttributeTarget, resolveScreenTarget, type CustomizationTarget } from "./resolveAttributeTarget";

/**
 * Where the Edit buttons of the Summary lead, in the flow the Summary is open in. As in the player menu, a
 * section leads to the step that shows its value and the place is read from the collection's ui.json, so
 * no step id of one collection is spelled here (Mako names its colour step `color`, USH `cabinet`).
 */

type EditSpec = { attributeIds: readonly string[] } | { screen: CustomizationScreenId };

/** The sections that lead to a step; the first attribute the flow shows wins. Swatches open the swatch order. */
const SECTION_SPECS: Record<string, EditSpec> = {
  "cabinet-options": { attributeIds: ["DrawerPanelFluting", "GrainDirection", "BookMatching"] },
  countertop: { attributeIds: ["CountertopColor"] },
  basin: { attributeIds: ["sinkType"] },
  accessories: { screen: "accessories" },
  faucet: { attributeIds: ["FaucetHolesAmount"] },
};

/** The cabinet finish; Urban Duplex has no CabinetColor and names it by its panels. */
const CABINET_FINISH_ATTRIBUTE_IDS = ["CabinetColor", "BasePanelColor"];

/** The first item of the Cabinet menu: the flow's entry step. */
const ENTRY_ITEM: Record<CustomizationFlowId, { id: string; label: string }> = {
  prebuilt: { id: "model-selection", label: "Model Selection" },
  custom: { id: "cabinet-builder", label: "Cabinet Builder" },
};

export type SummaryEditMenuItem = { id: string; label: string; path: string };

export type SummaryEditTargets = {
  /** The Cabinet section's menu: the flow's entry step, then the step of the cabinet finish. */
  cabinetMenu: SummaryEditMenuItem[];
  /** The path of each section that leads to a step, by section id; a section without one has no Edit button. */
  pathBySectionId: Readonly<Record<string, string>>;
};

const resolveSpecTarget = (
  schema: CustomizationSchema,
  flowId: CustomizationFlowId,
  spec: EditSpec,
): CustomizationTarget | null =>
  "screen" in spec
    ? resolveScreenTarget(schema, flowId, spec.screen)
    : (spec.attributeIds
        .map((attributeId) => resolveAttributeTarget(schema, flowId, attributeId))
        .find((target) => target !== null) ?? null);

/**
 * Example: Mako in the custom flow → menu `Cabinet Builder` (/custom/cabinet-builder) and `Color`
 * (/custom/color); `countertop` → /custom/countertop; no `cabinet-options`, which Mako does not show.
 */
export const resolveSummaryEditTargets = (
  schema: CustomizationSchema,
  flowId: CustomizationFlowId,
): SummaryEditTargets => {
  const entry = resolveEntryStep(schema, flowId);
  const finish = resolveSpecTarget(schema, flowId, { attributeIds: CABINET_FINISH_ATTRIBUTE_IDS });
  const cabinetMenu: SummaryEditMenuItem[] = [
    ...(entry ? [{ ...ENTRY_ITEM[flowId], path: entry.path }] : []),
    ...(finish ? [{ id: "color", label: "Color", path: finish.path }] : []),
  ];

  const pathBySectionId = Object.fromEntries(
    Object.entries(SECTION_SPECS).flatMap(([sectionId, spec]) => {
      const target = resolveSpecTarget(schema, flowId, spec);
      return target ? [[sectionId, target.path]] : [];
    }),
  );

  return { cabinetMenu, pathBySectionId };
};
