import {
  resolveCountertopFallbackHex,
  resolveCountertopFallbackTexture,
  resolveCountertopNeedsLightBorder,
} from "@/entities/countertop";
import type { ProductProfile, SyntesiFinishTransform, SyntesiRuleData } from "@/entities/collection";
import { selectRuleData } from "@/entities/collection";
import type { ProductOptionData } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";

import { normalizeMaterialToken } from "./parse";
import type { CountertopMatrixRule } from "./types";

/**
 * Syntesi countertop options. The material, its SKU token, the finishes it is offered in and
 * the swatches those finishes borrow come from `ruleData.syntesi` of the active collection; a
 * collection without that section offers no Syntesi.
 */

type CountertopOptionWithSource = ProductOptionData & {
  sourceGroup?: string;
};

export const isSyntesiCountertopMaterialSku = (
  value: string | null | undefined,
  profile: ProductProfile | null,
): boolean => {
  const syntesi = selectRuleData(profile, "syntesi");
  if (!syntesi) return false;

  const token = normalizeMaterialToken(value ?? "");
  return (
    token === normalizeMaterialToken(syntesi.material) || token === normalizeMaterialToken(syntesi.materialSkuToken)
  );
};

/** UI value of a Syntesi finish from any of its spellings (label, value, scene value). */
export const findSyntesiCountertopUiValue = (
  value: string | null | undefined,
  profile: ProductProfile | null,
): string | null => {
  const syntesi = selectRuleData(profile, "syntesi");
  const normalized = normalizeMaterialToken(value ?? "");
  if (!syntesi || !normalized) return null;

  const finish = syntesi.finishTransforms.find(({ label, value: uiValue, runtimeValue }) =>
    [label, uiValue, runtimeValue].some((candidate) => normalizeMaterialToken(candidate) === normalized),
  );

  return finish?.value ?? null;
};

const getOptionCodeCandidates = (option: ProductOptionData): string[] => [
  option.title,
  option.name ?? "",
  option.desc ?? "",
  option.metadata?.value ?? "",
  option.metadata?.sku ?? "",
];

const getOptionMaterialTokens = (option: ProductOptionData): string[] =>
  [option.desc, ...(option.metadata?.materials ?? [])]
    .map((value) => normalizeMaterialToken(value ?? ""))
    .filter(Boolean);

const hasMaterialToken = (option: ProductOptionData, token: string): boolean => {
  const normalizedToken = normalizeMaterialToken(token);
  return getOptionMaterialTokens(option).some((material) => material === normalizedToken);
};

const hasSyntesiOption = (options: ProductOptionData[], material: string): boolean =>
  options.some((option) => hasMaterialToken(option, material));

const hasSyntesiRule = (rules: CountertopMatrixRule[], material: string): boolean =>
  rules.some((rule) => normalizeMaterialToken(rule.material) === normalizeMaterialToken(material));

const getAllowedSyntesiFinishes = (
  rules: CountertopMatrixRule[],
  syntesi: SyntesiRuleData,
): SyntesiFinishTransform[] => {
  const ruleFinishes = new Set<string>();

  rules.forEach((rule) => {
    if (normalizeMaterialToken(rule.material) !== normalizeMaterialToken(syntesi.material)) return;
    rule.allowedFinishes.forEach((finish) => {
      const normalized = finish.trim().toUpperCase();
      if (normalized) ruleFinishes.add(normalized);
    });
  });

  if (ruleFinishes.size === 0) return syntesi.finishTransforms;

  return syntesi.finishTransforms.filter((finish) => ruleFinishes.has(finish.finish));
};

const matchesSourceFinish = (option: ProductOptionData, sourceFinish: string): boolean =>
  getOptionCodeCandidates(option).some((candidate) => {
    const tokens = candidate
      .split(/[\s()_-]+/g)
      .map((token) => token.trim().toUpperCase())
      .filter(Boolean);
    return tokens.includes(sourceFinish);
  });

const findSourceSwatch = (
  options: ProductOptionData[],
  finish: SyntesiFinishTransform,
  sourceMaterialTokens: readonly string[],
): ProductOptionData | null => {
  const sourceOptions = options.filter((option) => matchesSourceFinish(option, finish.sourceFinish));
  const materialSource = sourceOptions.find((option) =>
    getOptionMaterialTokens(option).some((token) => sourceMaterialTokens.includes(token)),
  );

  return materialSource ?? sourceOptions[0] ?? null;
};

const buildSyntesiOption = (
  source: ProductOptionData | null,
  finish: SyntesiFinishTransform,
  syntesi: SyntesiRuleData,
): CountertopOptionWithSource => {
  const sourceVariantName = source?.metadata?.value ?? source?.name ?? source?.title ?? `Bianco ${finish.sourceFinish}`;
  const fallbackHex = resolveCountertopFallbackHex(sourceVariantName);
  const fallbackImage = resolveCountertopFallbackTexture(sourceVariantName);

  return {
    id: `syntesi-countertop-${finish.finish}`,
    title: finish.label,
    name: finish.value,
    sourceGroup: "countertop color",
    desc: syntesi.material,
    isShortDesc: false,
    metadata: {
      image: source?.metadata?.image ?? fallbackImage,
      value: finish.value,
      configValue: finish.runtimeValue,
      sku: syntesi.materialSkuToken,
      materials: [syntesi.material],
      colors: source?.metadata?.colors?.length ? source.metadata.colors : ["White"],
      looks: source?.metadata?.looks ?? [],
      hex: source?.metadata?.hex ?? fallbackHex,
      lightBorder: source?.metadata?.lightBorder ?? resolveCountertopNeedsLightBorder(sourceVariantName),
    },
  };
};

export const appendSyntesiCountertopOptions = (
  options: ProductOptionData[],
  rules: CountertopMatrixRule[],
  profile: ProductProfile | null,
): CountertopOptionWithSource[] => {
  const syntesi = selectRuleData(profile, "syntesi");

  if (!syntesi) return options;
  if (!hasSyntesiRule(rules, syntesi.material)) return options;
  if (hasSyntesiOption(options, syntesi.material)) return options;

  const syntesiOptions = getAllowedSyntesiFinishes(rules, syntesi).map((finish) =>
    buildSyntesiOption(findSourceSwatch(options, finish, syntesi.sourceMaterialTokens), finish, syntesi),
  );

  return [...options, ...syntesiOptions];
};
