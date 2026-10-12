import type { CollectionPreset } from "../model/schemas";
import type { ProductProfile } from "../model/productProfile";
import type { ConfiguratorAvailableOption } from "@/entities/configurator/api/types";
import { isVisibleConfiguratorVariant } from "@/entities/configurator/lib/isVisibleConfiguratorVariant";

import { normalizeOptionValue, selectConfiguratorGroup, selectOption } from "./productProfileSelectors";
import { isPatternMaterialAllowed } from "./materialEligibility";
import { parseMasterTable } from "./importMasterCatalog";

export type PresetCompositionHandoff = {
  sourceModel: string;
  img: string;
  presetProducts: CollectionPreset["presetProducts"];
  basinPositions: { cabinetIndex: number }[];
};

/** Imports explicit module rows, not nominal-width recipes. Fails on incomplete or conflicting source data. */
export const importPresetCompositionCsv = (
  csv: string,
  masters: readonly CollectionPreset[],
  profile: ProductProfile,
  /** The configurator sections a colour the profile does not list is taken from (Tricot's configurator 12). */
  configurator: { groups: readonly ConfiguratorAvailableOption[] } | null = null,
): PresetCompositionHandoff[] => {
  const [headers, ...cells] = parseMasterTable(csv, ",");
  const required = [
    "id",
    "model",
    "products",
    "img",
    "size",
    "style",
    "position",
    "name",
    "Width",
    "Height",
    "Depth",
    "Drawers",
    "CabinetColor",
    "CabinetPattern",
    "HandleColor",
    "SidePanels",
    "CountertopColor",
    "BasinStyle",
  ];
  if (!headers || new Set(headers).size !== headers.length || required.some((h) => !headers.includes(h)))
    throw new Error("Invalid preset CSV headers");
  const groups = new Map<string, Record<string, string>[]>();
  for (const values of cells) {
    if (values.length !== headers.length) throw new Error("Invalid preset CSV row width");
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index].trim()]));
    if (!masters.some((p) => p.sourceModel === row.model)) throw new Error(`Unknown source model: ${row.model}`);
    groups.set(row.model, [...(groups.get(row.model) ?? []), row]);
  }
  // A colour the profile takes from a configurator section is the one that section offers.
  const offered = (id: string, value: string) =>
    selectConfiguratorGroup(profile, id, configurator)
      ?.options.flatMap(({ variants }) => variants)
      .find((variant) => isVisibleConfiguratorVariant(variant) && (variant.metadata?.value ?? variant.name) === value);
  const canonical = (id: string, value: string) => {
    const normalized = normalizeOptionValue(profile, id, value) ?? (offered(id, value) ? value : null);
    if (!normalized) throw new Error(`Unsupported ${id}: ${value}`);
    return normalized;
  };
  const dimension = (value: string) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) throw new Error(`Invalid module dimension: ${value}`);
    return n;
  };
  return masters.map((master) => {
    const rows = groups.get(master.sourceModel ?? "");
    if (!rows?.length) throw new Error(`Missing source model: ${master.sourceModel}`);
    rows.sort((a, b) => Number(a.position) - Number(b.position));
    const first = rows[0];
    for (const [index, row] of rows.entries()) {
      if (Number(row.position) !== index + 1) throw new Error(`Duplicate/missing module position: ${row.model}`);
      if (["id", "model", "products", "img", "size", "style"].some((key) => row[key] !== first[key]))
        throw new Error(`Inconsistent preset metadata: ${row.model}`);
    }
    if (
      first.size !== master.size ||
      [...first.style.split("|")].sort().join("|") !== [...master.style].sort().join("|")
    )
      throw new Error(`Preset filter mismatch: ${first.model}`);
    const basinPositions: { cabinetIndex: number }[] = [];
    const presetProducts = rows.map((row, index) => {
      const name = canonical("CabinetType", row.name);
      const module = profile.ruleData.cabinetModules?.find((m) => m.cabinetType === name);
      if (!module) throw new Error(`Missing module contract: ${name}`);
      const Width = dimension(row.Width),
        Height = dimension(row.Height),
        Depth = dimension(row.Depth);
      const Drawers = canonical("Drawers", row.Drawers);
      if (
        !module.widthsCm.includes(Width) ||
        !module.heightsCm.includes(Height) ||
        !module.depthsCm.includes(Depth) ||
        !module.drawerValues.includes(Drawers)
      )
        throw new Error(`Unsupported module: ${row.model}`);
      if (module.hasSink) basinPositions.push({ cabinetIndex: index });
      const CabinetColor = canonical("CabinetColor", row.CabinetColor);
      const DrawerPanelFluting = canonical("DrawerPanelFluting", row.CabinetPattern);
      // The material of a listed colour is its category's; of a configurator colour, its SKU's.
      const category = selectOption(profile, "CabinetColor", CabinetColor)?.category;
      const sku = offered("CabinetColor", CabinetColor)?.metadata?.sku;
      const traits = profile.ruleData.cabinetColorTraits;
      const material = category
        ? traits?.materialByCategory?.[category]
        : typeof sku === "string"
          ? traits?.materialBySku?.[sku]
          : undefined;
      if (!isPatternMaterialAllowed(profile, DrawerPanelFluting, material))
        throw new Error(`Incompatible cabinet pattern: ${row.model}`);
      return {
        name,
        Width,
        Height,
        Depth,
        Drawers,
        CabinetColor,
        DrawerPanelFluting,
        HandleGrooveColor: canonical("HandleGrooveColor", row.HandleColor),
        SidePanels: canonical("SidePanels", row.SidePanels),
        CountertopColor: canonical("CountertopColor", row.CountertopColor),
        ...(module.hasSink ? { sinkType: canonical("sinkType", row.BasinStyle) } : {}),
      };
    });
    const groupsUsed = new Set(
      presetProducts.map((p) => profile.ruleData.drawerStyleGroups?.findIndex((g) => g.includes(p.Drawers)) ?? -1),
    );
    if (groupsUsed.size > 1) throw new Error(`Mixed drawer groups: ${first.model}`);
    return { sourceModel: first.model, img: first.img, presetProducts, basinPositions };
  });
};
