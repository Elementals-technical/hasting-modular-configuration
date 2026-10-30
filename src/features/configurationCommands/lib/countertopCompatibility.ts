import type { RootState } from "@/app/store";
import {
  isVesselBasin,
  normalizeOptionValue,
  selectAttribute,
  selectConfiguratorGroup,
  selectOption,
  selectDefaultValue,
  selectMessage,
  type ProductProfile,
} from "@/entities/collection";
import type { ConfiguratorGroupCatalog } from "@/entities/collection/model/types";
import {
  getAttributeValue,
  getCabinetEntries,
  getDimensionsByCabinet,
  isSinkBase,
  type ValueTarget,
} from "@/entities/configuration";
import {
  buildCountertopRuleState,
  type CountertopRuleResult,
} from "@/features/configurator-rule-core/countertop/rules";
import { parseThicknessValue, normalizeBasinKey } from "@/features/configurator-rule-core/countertop/parse";
import {
  INTEGRATED_DRAWERS_REASON,
  selectSinkBasesUnavailableWithIntegrated,
} from "@/features/configurator-rule-core/countertop/integratedCountertop";
import { calcTotalCountertopWidthCm, getSidePanelWidthCm } from "@/entities/countertop";
import type { AttributeChange, ChangeBlockedReason, ConfirmationReason, PlannedChange } from "../model/types";

/** The material a configurator section lists a countertop colour under, as the matrix names it ("Glass MT"). */
const configuratorMaterialOf = (
  profile: ProductProfile,
  configurator: ConfiguratorGroupCatalog | null,
  value: string,
): string | undefined => {
  const variant = selectConfiguratorGroup(profile, "CountertopColor", configurator)
    ?.options.flatMap(({ variants }) => variants)
    .find((candidate) => (candidate.metadata?.value ?? candidate.name) === value);
  const material = variant?.metadata?.Material;
  return typeof material === "string" && material ? material : undefined;
};

/** Uses the exact loaded matrix for opt-in collections; legacy command behavior is unchanged. */
export const evaluateCountertopChange = (
  change: AttributeChange,
  target: ValueTarget,
  state: RootState,
  profile: ProductProfile,
  /** The configurator sections a colour the profile does not list is taken from (Tricot's configurator 12). */
  configurator: ConfiguratorGroupCatalog | null = null,
): { blocked?: ChangeBlockedReason; dependencies: PlannedChange[]; confirmation?: ConfirmationReason[] } => {
  const dependencies: PlannedChange[] = [];
  if (
    !profile.ruleData.countertopCompatibility ||
    !["CountertopColor", "Thickness", "sinkType", "Drawers", "CountertopStyle"].includes(change.attributeId) ||
    change.value === ""
  )
    return { dependencies };
  const unknown = (): ChangeBlockedReason => ({
    attributeId: change.attributeId,
    reasonCode: "product.missingData",
    reason: "Approved countertop matrix and actual module dimensions are required.",
    compatibility: "undetermined",
  });
  const invalid = (): ChangeBlockedReason => ({
    attributeId: change.attributeId,
    reasonCode: "change.notAvailable",
    reason: "This material, thickness or basin does not fit the supplied countertop matrix.",
  });
  const vesselOnly: ChangeBlockedReason = {
    attributeId: change.attributeId,
    reasonCode: "change.notAvailable",
    reason: "A Sink Base in this design is only compatible with a vessel countertop.",
  };
  const cabinets = getCabinetEntries(state),
    dimensions = getDimensionsByCabinet(state);
  const sinkBases = cabinets.filter(
    (c) =>
      isSinkBase(state, c.runtimeId) &&
      (target.scope !== "basin" || !target.sinkBaseId || c.stableKey === target.sinkBaseId),
  );
  const options = state.rootStateUI.product.productOptions;
  const read = (id: string, legacy: string) =>
    id === change.attributeId ? String(change.value) : legacy || selectDefaultValue(profile, id);
  const style = read("CountertopStyle", options.CountertopStyle);
  // An integrated countertop leaves out some Sink Bases (Tricot: 60 cm with an inner drawer).
  const leftOut =
    style === "integrated"
      ? selectSinkBasesUnavailableWithIntegrated(state, {
          sinkBases,
          drawers: change.attributeId === "Drawers" ? String(change.value) : undefined,
        })
      : [];
  // The style itself is judged by that alone: the matrix rules the material, thickness and basin. Chosen
  // over Sink Bases it leaves out, it takes them to the drawers of their group it takes, once approved.
  if (change.attributeId === "CountertopStyle") {
    const switches = leftOut.flatMap(({ cabinet, integratedDrawers }): PlannedChange[] =>
      integratedDrawers
        ? [
            {
              attributeId: "Drawers",
              target: { scope: "cabinet", cabinetId: cabinet.stableKey },
              value: integratedDrawers,
              origin: "dependency",
              reasonCode: INTEGRATED_DRAWERS_REASON,
            },
          ]
        : [],
    );
    if (switches.length < leftOut.length) return { blocked: vesselOnly, dependencies };
    if (!switches.length) return { dependencies };
    return {
      dependencies: switches,
      confirmation: [
        {
          attributeId: change.attributeId,
          reasonCode: INTEGRATED_DRAWERS_REASON,
          reason: selectMessage(profile, INTEGRATED_DRAWERS_REASON),
        },
      ],
    };
  }
  if (!profile.countertopRules?.length) return { blocked: unknown(), dependencies };
  if (
    !cabinets.length ||
    !sinkBases.length ||
    cabinets.some((c) => !dimensions[c.stableKey]?.width || !dimensions[c.stableKey]?.depth)
  )
    return { blocked: unknown(), dependencies };
  const color = read("CountertopColor", options.CountertopColor);
  const canonical = normalizeOptionValue(profile, "CountertopColor", color) ?? color;
  const category =
    selectOption(profile, "CountertopColor", canonical)?.category ??
    configuratorMaterialOf(profile, configurator, canonical);
  if (!category) return { blocked: invalid(), dependencies };
  const colorChange = change.attributeId === "CountertopColor";
  const thickness = colorChange ? "" : read("Thickness", options.Thickness);
  if (leftOut.length) return { blocked: vesselOnly, dependencies };
  if (change.attributeId === "Drawers") return { dependencies };
  const basinFor = (key: string) =>
    change.attributeId === "sinkType"
      ? String(change.value)
      : String(
          getAttributeValue(state, "sinkType", { scope: "basin", sinkBaseId: key }) ??
            getAttributeValue(state, "sinkType", { scope: "basin" }) ??
            options.sinkType ??
            selectDefaultValue(profile, "sinkType"),
        );
  const totalWidth = calcTotalCountertopWidthCm(
    cabinets.reduce((sum, c) => sum + (dimensions[c.stableKey]?.width ?? 0), 0),
    options.SidePanelLeft,
    options.SidePanelRight,
    getSidePanelWidthCm(profile),
  );
  const buildResults = (activeThickness: string) =>
    sinkBases.map((c) =>
      buildCountertopRuleState({
        rules: profile.countertopRules ?? [],
        activeMaterialTokens: [category],
        width: dimensions[c.stableKey]?.width ?? null,
        sinkBaseWidth: dimensions[c.stableKey]?.width ?? null,
        totalWidth,
        depth: dimensions[c.stableKey]?.depth ?? null,
        activeCountertopStyle: style,
        activeBasinStyle: basinFor(c.stableKey),
        activeThickness,
        profile,
      }),
    );
  // The matrix lists integrated basins only. A vessel, and the vessel cutout without one, are judged by
  // its vessel rules, as the basin field judges them.
  const noneBasin = selectAttribute(profile, "sinkType")?.noneValue;
  const fits = (result: CountertopRuleResult, basin: string) => {
    if (noneBasin && (normalizeOptionValue(profile, "sinkType", basin) ?? basin) === noneBasin) return true;
    if (isVesselBasin(profile, basin)) return result.vesselSinkAvailability.isAvailable;
    return result.allowedBasinKeys.has(normalizeBasinKey(basin));
  };
  let results = buildResults(thickness);
  if (colorChange) {
    const allowedThicknesses = [...results[0].allowedThicknesses].filter((v) =>
      results.every((r) => r.allowedThicknesses.has(v)),
    );
    if (!allowedThicknesses.length) return { blocked: invalid(), dependencies };
    const previous = parseThicknessValue(options.Thickness);
    const next = previous !== null && allowedThicknesses.includes(previous) ? previous : allowedThicknesses[0];
    if (next !== previous)
      dependencies.push({
        attributeId: "Thickness",
        target: { scope: "countertop" },
        value: String(next),
        origin: "dependency",
      });
    results = buildResults(String(next));
  } else if (change.attributeId === "Thickness") {
    const value = parseThicknessValue(String(change.value));
    if (value === null || !results.every((r) => r.allowedThicknesses.has(value)))
      return { blocked: invalid(), dependencies };
  } else if (!results.every((r, index) => fits(r, basinFor(sinkBases[index].stableKey))))
    return { blocked: invalid(), dependencies };
  if (change.attributeId !== "sinkType") {
    for (const [index, c] of sinkBases.entries()) {
      const basin = basinFor(c.stableKey);
      if (basin && !fits(results[index], basin))
        dependencies.push({
          attributeId: "sinkType",
          target: { scope: "basin", sinkBaseId: c.stableKey },
          value: "",
          origin: "dependency",
        });
    }
    const globalBasin = String(getAttributeValue(state, "sinkType", { scope: "basin" }) ?? options.sinkType ?? "");
    if (globalBasin && !results.every((r) => fits(r, globalBasin)))
      dependencies.push({ attributeId: "sinkType", target: { scope: "basin" }, value: "", origin: "dependency" });
  }
  return { dependencies };
};
