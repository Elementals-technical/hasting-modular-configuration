import type { UnknownAction } from "@reduxjs/toolkit";

import type { ProductProfile } from "@/entities/collection";
import { selectAttribute, selectLegacySpelling } from "@/entities/collection";
import type { ConfiguratorGroupCatalog } from "@/entities/collection/model/types";
import { getAttributeOwnership, setAttributeValue } from "@/entities/configuration";
import {
  addProductPreset,
  commitRuleSelection,
  setActiveCountertopThickness,
  setActiveBasinStyle,
  setActiveCountertopColor,
  setBookMatching,
  setCabinetColor,
  setCabinetColorFinish,
  setCabinetColorMaterial,
  setCountertopStyle,
  setDividersOption,
  setDividersStyle,
  setDrawerPanelFluting,
  setFaucetHolesAmount,
  setFaucetHolesSpacing,
  setGrainDirection,
  setHandleGrooveColor,
  setHandleGrooveColorSku,
  setLedOption,
  setPlacedCabinetStyle,
  setSidePanelSideStatus,
  setSidePanelsOption,
  setSelectedProductConfig,
  setSelectedDimensions,
  setTowelBarColor,
  setTowelBarOption,
  setVesselColor,
} from "@/entities/product/model/store/slice";
import type { PresetProduct } from "@/entities/product/types";

import { resolveColorTraits } from "./resolveColorTraits";
import type { PlannedChange } from "../model/types";

/**
 * Writes an applied change into state.
 *
 * Every applied value is first recorded in the scoped configuration map. The explicit
 * committers below maintain the old product-slice cache while legacy pages still select
 * from it; they are fed only by this function, so they are a compatibility projection,
 * not a second command path or persistence owner.
 */

export type CommitContext = {
  /** Current per-product config, so a partial patch does not drop sibling values. */
  selectedProductConfig: Parameters<typeof setSelectedProductConfig>[0];
  /** Stable key -> runtime id, for state that is still keyed by runtime id. */
  resolveRuntimeId: (cabinetId: string) => string | null;
  /** Active profile, for the legacy spelling state still stores. */
  profile: ProductProfile | null;
  /** Configurator sections of the active collection, for the material and finish of a colour. */
  configurator?: ConfiguratorGroupCatalog | null;
  /** Presets of the composition, which carry the colours into Customize. */
  productsPresets?: readonly PresetProduct[];
};

type Committer = (change: PlannedChange, context: CommitContext) => UnknownAction[];

const asText = (change: PlannedChange): string => String(change.value ?? "");

/** Pricing and derived fields can be carried by runtime data, but are never semantic C state. */
const recordSemanticChange = (change: PlannedChange): UnknownAction | null => {
  // Dimensions are persisted in each product's scene config. The selected dimensions
  // below are a UI projection; I04 replaces them with the scene's actual values.
  if (change.attributeId === "Width" || change.attributeId === "Depth" || change.attributeId === "Height") return null;

  const owner = getAttributeOwnership(change.attributeId)?.owner;
  if (owner === "pricing" || owner === "derived") return null;

  return setAttributeValue({
    attributeId: change.attributeId,
    target: change.target,
    value: change.value,
  }) as unknown as UnknownAction;
};

const COMMITTERS: Record<string, Committer> = {
  // The command already planned the dependent height and groove reset, so the reducer
  // records the handle without deriving them a second time.
  Handle: (change) => [commitRuleSelection({ handle: String(change.value) })],

  Drawers: (change, context) => {
    if (change.target.scope !== "cabinet") return [];

    const runtimeId = context.resolveRuntimeId(change.target.cabinetId);
    if (!runtimeId) return [];

    return [setPlacedCabinetStyle({ id: runtimeId, value: String(change.value) })];
  },

  Height: (change) => (typeof change.value === "number" ? [commitRuleSelection({ height: change.value })] : []),

  // The material and finish decide fluting and grain availability, so they are recorded with
  // the colour. A colour that cannot be read keeps the recorded ones. The SKU belongs to D.
  CabinetColor: (change, context) => {
    const color = asText(change);
    const traits = resolveColorTraits(color, context.configurator ?? null, context.profile);

    return [
      setCabinetColor(color),
      ...(traits ? [setCabinetColorMaterial(traits.material), setCabinetColorFinish(traits.finish)] : []),
    ];
  },

  // Clearing the colour also clears its SKU, so the pricing input cannot outlive the value.
  HandleGrooveColor: (change, context) => {
    const color = asText(change);

    if (!color) return [setHandleGrooveColor(""), setHandleGrooveColorSku("")];

    return [
      setSelectedProductConfig({ ...(context.selectedProductConfig ?? {}), HandleGrooveColor: color }),
      setHandleGrooveColor(color),
    ];
  },

  DrawerPanelFluting: (change) => [setDrawerPanelFluting(asText(change))],
  // useAvailabilityResets drops a book matching the new grain no longer allows.
  GrainDirection: (change) => [setGrainDirection(asText(change))],
  TowelBarOption: (change) => [setTowelBarOption(asText(change))],
  TowelBarColor: (change) => [setTowelBarColor(asText(change))],
  // Written as the change carries it, so the stored format and the SKU input stay the same.
  Thickness: (change) => [setActiveCountertopThickness(asText(change))],
  CountertopColor: (change) => [setActiveCountertopColor(asText(change))],
  CountertopStyle: (change) => [setCountertopStyle(asText(change))],
  // The scene keeps the cutout token of a vessel where state keeps "no basin chosen". The
  // profile names that token as the attribute's noneValue, so no page spells it out.
  sinkType: (change, context) => {
    const value = asText(change);
    const noneValue = selectAttribute(context.profile, "sinkType")?.noneValue;

    return [setActiveBasinStyle(noneValue !== undefined && value === noneValue ? "" : value)];
  },
  VesselColor: (change) => [setVesselColor(asText(change))],
  BookMatching: (change) => [setBookMatching(asText(change))],
  SidePanels: (change) => [setSidePanelsOption(asText(change))],
  SidePanelLeft: (change) => {
    const status = asText(change);
    return status === "active" || status === "none" || status === "auto-removed"
      ? [setSidePanelSideStatus({ side: "left", status })]
      : [];
  },
  SidePanelRight: (change) => {
    const status = asText(change);
    return status === "active" || status === "none" || status === "auto-removed"
      ? [setSidePanelSideStatus({ side: "right", status })]
      : [];
  },
  LedOption: (change) => [setLedOption(asText(change))],
  DividersOption: (change) => [setDividersOption(asText(change))],
  DividersStyle: (change) => [setDividersStyle(asText(change))],
  FaucetHolesAmount: (change) => [setFaucetHolesAmount(asText(change))],
  FaucetHolesSpacing: (change) => [setFaucetHolesSpacing(asText(change))],
  Width: (change) => (typeof change.value === "number" ? [setSelectedDimensions({ width: change.value })] : []),
  Depth: (change) => (typeof change.value === "number" ? [setSelectedDimensions({ depth: change.value })] : []),
};

/** Colours a preset carries, so Customize starts from the colours the user chose. */
const PRESET_COLOR_ATTRIBUTE_IDS = ["CabinetColor", "HandleGrooveColor"] as const;

type PresetColorAttributeId = (typeof PRESET_COLOR_ATTRIBUTE_IDS)[number];

const isPresetColor = (attributeId: string): attributeId is PresetColorAttributeId =>
  PRESET_COLOR_ATTRIBUTE_IDS.some((id) => id === attributeId);

/** Actions that record one planned change. Empty when the change cannot be addressed. */
export const commitChange = (change: PlannedChange, context: CommitContext): UnknownAction[] => {
  const committer = COMMITTERS[change.attributeId];
  const record = recordSemanticChange(change);

  if (committer) {
    return [...(record ? [record] : []), ...committer(change, context)];
  }

  return record ? [record] : [];
};

type RuleSelectionCommit = { handle?: string; height?: number; drawers?: string };

/**
 * Actions that record an applied set.
 *
 * Handle, height and drawers go into one commitRuleSelection after the per-cabinet actions,
 * so availability is refreshed once for the whole set and sees the new drawers of every
 * cabinet, rather than once per value against a half-written state. The presets get the
 * colours of the whole set in one write, so a groove that follows the cabinet colour does
 * not overwrite the colour written before it.
 */
export const commitPlan = (changes: readonly PlannedChange[], context: CommitContext): UnknownAction[] => {
  const actions: UnknownAction[] = [];
  const ruleSelection: RuleSelectionCommit = {};
  const presetColors: Partial<Record<PresetColorAttributeId, string>> = {};

  for (const change of changes) {
    switch (change.attributeId) {
      case "Handle":
        {
          const record = recordSemanticChange(change);
          if (record) actions.push(record);
        }
        ruleSelection.handle = String(change.value);
        break;

      case "Height":
        {
          const record = recordSemanticChange(change);
          if (record) actions.push(record);
        }
        if (typeof change.value === "number") ruleSelection.height = change.value;
        break;

      case "Drawers":
        actions.push(...commitChange(change, context));
        ruleSelection.drawers = selectLegacySpelling(context.profile, "Drawers", String(change.value));
        break;

      default:
        actions.push(...commitChange(change, context));

        // A cleared groove is not written into the presets, as the handle change never did.
        if (isPresetColor(change.attributeId) && asText(change)) {
          presetColors[change.attributeId] = asText(change);
        }
    }
  }

  const presets = context.productsPresets ?? [];

  if (presets.length > 0 && Object.keys(presetColors).length > 0) {
    actions.push(addProductPreset(presets.map((preset) => ({ ...preset, ...presetColors }))));
  }

  if (Object.keys(ruleSelection).length > 0) {
    actions.push(commitRuleSelection(ruleSelection));
  }

  return actions;
};

/** Attribute ids that are written into the typed product slice rather than the scoped map. */
export const TYPED_COMMIT_ATTRIBUTE_IDS: readonly string[] = Object.keys(COMMITTERS);
