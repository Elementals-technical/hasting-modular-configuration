import {
  getCountertopRuleMaxWidthsForStyle,
  isCountertopRuleWidthAllowed,
  matchesDepthForStyle,
  materialMatchesRule,
  normalizeMaterialToken,
  resolveCountertopCabinetCompositionConstraint,
  resolveCountertopWidthRuleStyle,
} from "@/features/configurator-rule-core/countertop";
import { cmToInches } from "@/shared/lib/sku";

import type { MaterialFilterOption } from "./countertopColorOptions";
import type { CountertopContext } from "./useCountertopContext";
import type { ProductOptionData } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";

type MaterialFailure = "total" | "selected" | "depth" | "composition" | null;

type MaterialEvaluation = { isCompatible: boolean; failedBy: MaterialFailure };

/** What the countertop matrix is judged against for one colour: sizes, style and composition. */
export type MaterialRuleInputs = Pick<
  CountertopContext,
  "activeBasinStyle" | "activeCountertopStyle" | "activeProfile" | "cabinetCompositionCount" | "countertopRules"
> & {
  depth: number | null;
  sinkBaseWidth: number | null | undefined;
  totalWidth: number | null | undefined;
};

type Messages = CountertopContext["messages"];

/** Whether a colour's materials pass the composition, depth and width rules, and which check failed first. */
export const evaluateMaterialOption = (option: ProductOptionData, inputs: MaterialRuleInputs): MaterialEvaluation => {
  const optionMaterials = option.metadata?.materials ?? [];
  if (!optionMaterials.length) return { isCompatible: true, failedBy: null };

  const composition = resolveCountertopCabinetCompositionConstraint({
    materialTokens: optionMaterials,
    cabinetCount: inputs.cabinetCompositionCount,
    profile: inputs.activeProfile,
  });
  if (!composition.isWithinCabinetLimit) return { isCompatible: false, failedBy: "composition" };

  const widthRuleStyle = resolveCountertopWidthRuleStyle(inputs);
  const materialRules = inputs.countertopRules.filter((rule) =>
    optionMaterials.some((material) => materialMatchesRule(material, rule.material)),
  );
  const applicableRules = materialRules.filter((rule) => matchesDepthForStyle(rule, inputs.depth, widthRuleStyle));

  if (!applicableRules.length) {
    if (materialRules.length > 0) return { isCompatible: false, failedBy: "depth" };
    const isCeramic = optionMaterials.some((material) => normalizeMaterialToken(material) === "ceramic");
    return { isCompatible: isCeramic, failedBy: isCeramic ? null : "total" };
  }

  const matchesWidth = (width: number, context: "generic" | "sink-base") =>
    applicableRules.some((rule) =>
      isCountertopRuleWidthAllowed({
        rule,
        width,
        style: widthRuleStyle,
        context,
        activeBasinStyle: inputs.activeBasinStyle,
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

export const reasonForFailure = (failedBy: MaterialFailure, messages: Messages) => {
  if (failedBy === "total") return messages.totalWidth;
  if (failedBy === "depth") return messages.depth;
  if (failedBy === "selected") return messages.width;
  if (failedBy === "composition") return messages.syntesiSingleCabinet;
  return messages.selection;
};

/** The widest countertop the rules allow for a material at the current depth. */
const maxMaterialWidth = (materialValue: string, inputs: MaterialRuleInputs): number | null => {
  const widthRuleStyle = resolveCountertopWidthRuleStyle(inputs);
  const limits = inputs.countertopRules
    .filter(
      (rule) =>
        matchesDepthForStyle(rule, inputs.depth, widthRuleStyle) && materialMatchesRule(materialValue, rule.material),
    )
    .flatMap((rule) => getCountertopRuleMaxWidthsForStyle(rule, widthRuleStyle))
    .filter((value) => Number.isFinite(value));
  return limits.length ? Math.max(...limits) : null;
};

/** Why a material filter entry is disabled, or undefined while any colour of it is compatible. */
export const materialFilterReason = (
  materialValue: string,
  evaluations: MaterialEvaluation[],
  inputs: MaterialRuleInputs,
  messages: Messages,
): string | undefined => {
  if (!evaluations.length) return messages.size;
  if (evaluations.some((item) => item.isCompatible)) return undefined;
  if (evaluations.every((item) => item.failedBy === "depth")) return messages.depth;

  if (evaluations.some((item) => item.failedBy === "total")) {
    const maxWidth = maxMaterialWidth(materialValue, inputs);
    const { totalWidth } = inputs;
    if (maxWidth !== null && typeof totalWidth === "number") {
      return `${messages.totalWidth}. Current ${totalWidth} cm (${cmToInches(totalWidth)}"), ${materialValue} max ${maxWidth} cm (${cmToInches(maxWidth)}").`;
    }
    if (maxWidth !== null)
      return `${messages.totalWidth}. ${materialValue} max ${maxWidth} cm (${cmToInches(maxWidth)}").`;
    return messages.totalWidth;
  }
  if (evaluations.some((item) => item.failedBy === "selected")) return messages.width;
  if (evaluations.some((item) => item.failedBy === "composition")) return messages.syntesiSingleCabinet;
  return messages.size;
};

/** Disables material filters; a group is disabled when all its children are, with the most telling reason. */
export const annotateMaterialFilters = (
  materials: MaterialFilterOption[],
  reasonOf: (materialValue: string) => string | undefined,
  messages: Messages,
): MaterialFilterOption[] => {
  const annotate = (option: MaterialFilterOption): MaterialFilterOption => {
    if (!option.children?.length) {
      const reason = reasonOf(option.value);
      return { ...option, disabled: reason !== undefined, reason };
    }

    const children = option.children.map(annotate);
    const disabled = children.every((child) => child.disabled);
    const reasons = children.map((child) => child.reason).filter((reason): reason is string => Boolean(reason));
    const reason =
      reasons.length > 0 && reasons.every((item) => item === messages.depth)
        ? messages.depth
        : (reasons.find((item) => item.startsWith(messages.totalWidth)) ??
          reasons.find((item) => item === messages.size) ??
          reasons[0] ??
          messages.size);

    return { ...option, children, disabled, reason: disabled ? reason : undefined };
  };

  return materials.map(annotate);
};
