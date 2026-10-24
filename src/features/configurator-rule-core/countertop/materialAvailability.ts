import type { ProductProfile } from "@/entities/collection";

import { REASON_SYNTESI_SINGLE_CABINET, resolveCountertopCabinetCompositionConstraint } from "./compositionConstraints";
import {
  matchesDepthForStyle,
  materialMatchesRule,
  normalizeMaterialToken,
  parseThicknessValue,
  selectMaterialAliasTable,
} from "./parse";
import { isCountertopRuleWidthAllowed, resolveCountertopWidthRuleStyle } from "./sizeFilters";
import { canThicknessFloat } from "./thicknessCapabilities";
import type { CountertopMatrixRule } from "./types";

/**
 * The check a colour's materials failed first: the total width, the Sink Base width, the depth, the composition,
 * or none of its tops may float while the basin is off its Sink Base.
 */
export type CountertopMaterialFailure = "total" | "selected" | "depth" | "composition" | "offSinkBase" | null;

export type CountertopMaterialEvaluation = { isCompatible: boolean; failedBy: CountertopMaterialFailure };

/** What the countertop matrix is judged against for one colour: sizes, style and composition. */
export type CountertopMaterialRuleInputs = {
  activeBasinStyle: string | null | undefined;
  activeCountertopStyle: string | null | undefined;
  activeProfile: ProductProfile | null;
  cabinetCompositionCount: number;
  countertopRules: CountertopMatrixRule[];
  depth: number | null;
  sinkBaseWidth: number | null | undefined;
  /** No Sink Base under the basin (`isSinkOffSinkBase`): only the rows of a top that floats count. */
  sinkOffSinkBase?: boolean;
  totalWidth: number | null | undefined;
};

/** The reason code of each failed check, as the countertop step words it. */
export const REASON_COUNTERTOP_MATERIAL_BY_FAILURE: Record<NonNullable<CountertopMaterialFailure>, string> = {
  total: "countertop.materialNotAvailableForTotalWidth",
  selected: "countertop.materialNotAvailableForWidth",
  depth: "countertop.materialNotAvailableForDepth",
  composition: REASON_SYNTESI_SINGLE_CABINET,
  offSinkBase: "countertop.materialNotAvailableOffSinkBase",
};

// A row that makes a top which may carry its basin off the Sink Base: one of its thicknesses lifts.
const offersFloatingTop = (rule: CountertopMatrixRule, profile: ProductProfile | null) =>
  rule.topThicknesses.some((raw) => {
    const thickness = parseThicknessValue(raw);
    return thickness !== null && canThicknessFloat(profile, thickness);
  });

/** The reason code of colours that failed different checks. */
export const REASON_COUNTERTOP_MATERIAL_SELECTION = "countertop.materialNotAvailableForSelection";

/** Whether a colour's materials pass the composition, depth and width rules, and which check failed first. */
export const evaluateCountertopMaterial = (
  materials: readonly string[],
  inputs: CountertopMaterialRuleInputs,
): CountertopMaterialEvaluation => {
  if (!materials.length) return { isCompatible: true, failedBy: null };

  const composition = resolveCountertopCabinetCompositionConstraint({
    materialTokens: materials,
    cabinetCount: inputs.cabinetCompositionCount,
    profile: inputs.activeProfile,
  });
  if (!composition.isWithinCabinetLimit) return { isCompatible: false, failedBy: "composition" };

  const widthRuleStyle = resolveCountertopWidthRuleStyle({ ...inputs, profile: inputs.activeProfile });
  const aliasTable = selectMaterialAliasTable(inputs.activeProfile);
  const materialRules = inputs.countertopRules.filter((rule) =>
    materials.some((material) => materialMatchesRule(material, rule.material, aliasTable)),
  );
  // A material none of whose tops lifts, at any depth, can never ride off its Sink Base: that is its reason
  // while the basin is away, before the depth or widths that may refuse it as well (Glass at 46 cm).
  if (
    inputs.sinkOffSinkBase &&
    materialRules.length > 0 &&
    !materialRules.some((rule) => offersFloatingTop(rule, inputs.activeProfile))
  ) {
    return { isCompatible: false, failedBy: "offSinkBase" };
  }
  const applicableRules = materialRules.filter((rule) => matchesDepthForStyle(rule, inputs.depth, widthRuleStyle));

  if (!applicableRules.length) {
    if (materialRules.length > 0) return { isCompatible: false, failedBy: "depth" };
    const isCeramic = materials.some((material) => normalizeMaterialToken(material) === "ceramic");
    return { isCompatible: isCeramic, failedBy: isCeramic ? null : "total" };
  }

  // Off its Sink Base the basin rides a top that lifts only: the widths are judged on those rows. A material that
  // lifts at another depth but not at this one is refused here too: lowering the top would allow it.
  const rulesForTop = inputs.sinkOffSinkBase
    ? applicableRules.filter((rule) => offersFloatingTop(rule, inputs.activeProfile))
    : applicableRules;
  if (!rulesForTop.length) return { isCompatible: false, failedBy: "offSinkBase" };

  const matchesWidth = (width: number, context: "generic" | "sink-base") =>
    rulesForTop.some((rule) =>
      isCountertopRuleWidthAllowed({
        rule,
        width,
        style: widthRuleStyle,
        context,
        activeBasinStyle: inputs.activeBasinStyle,
        profile: inputs.activeProfile,
      }),
    );
  if (typeof inputs.sinkBaseWidth === "number" && !matchesWidth(inputs.sinkBaseWidth, "sink-base")) {
    return { isCompatible: false, failedBy: "selected" };
  }
  if (typeof inputs.totalWidth === "number" && !matchesWidth(inputs.totalWidth, "generic")) {
    return { isCompatible: false, failedBy: "total" };
  }
  return { isCompatible: true, failedBy: null };
};
