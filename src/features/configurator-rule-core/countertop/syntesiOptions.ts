import {
  resolveCountertopFallbackHex,
  resolveCountertopFallbackTexture,
  resolveCountertopNeedsLightBorder,
} from "@/entities/countertop";
import type { ProductOptionData } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";

import { normalizeMaterialToken } from "./parse";
import type { CountertopMatrixRule } from "./types";

export const SYNTESI_MATERIAL = "Syntesi";
export const SYNTESI_MATERIAL_SKU = "Syntesi";

type CountertopOptionWithSource = ProductOptionData & {
  sourceGroup?: string;
};

type SyntesiFinishConfig = {
  finish: string;
  sourceFinish: string;
  title: string;
  value: string;
  configValue: string;
};

const SYNTESI_FINISH_CONFIGS: SyntesiFinishConfig[] = [
  {
    finish: "TAN",
    sourceFinish: "TAL",
    title: "Bianco Gloss TAN",
    value: "Bianco Gloss TAN",
    configValue: "Bianco Gloss TAL",
  },
  {
    finish: "TAP",
    sourceFinish: "TAM",
    title: "Bianco Matte TAP",
    value: "Bianco Matte TAP",
    configValue: "Bianco Matte TAM",
  },
];

const SOURCE_MATERIAL_TOKENS = new Set(["tekorlux", "sstkr", "tal", "tam"]);
const SYNTESI_MATERIAL_SKU_TOKEN = normalizeMaterialToken(SYNTESI_MATERIAL_SKU);
const SYNTESI_UI_VALUE_BY_COLOR_KEY = new Map(
  SYNTESI_FINISH_CONFIGS.flatMap((config) => [
    [normalizeMaterialToken(config.title), config.value],
    [normalizeMaterialToken(config.value), config.value],
    [normalizeMaterialToken(config.configValue), config.value],
  ]),
);

export const isSyntesiCountertopMaterialSku = (value?: string | null): boolean =>
  normalizeMaterialToken(value ?? "") === SYNTESI_MATERIAL_SKU_TOKEN;

export const findSyntesiCountertopUiValue = (value?: string | null): string | null => {
  const normalized = normalizeMaterialToken(value ?? "");
  if (!normalized) return null;

  return SYNTESI_UI_VALUE_BY_COLOR_KEY.get(normalized) ?? null;
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

const hasSyntesiOption = (options: ProductOptionData[]): boolean =>
  options.some((option) => hasMaterialToken(option, SYNTESI_MATERIAL));

const hasSyntesiRule = (rules: CountertopMatrixRule[]): boolean =>
  rules.some((rule) => normalizeMaterialToken(rule.material) === normalizeMaterialToken(SYNTESI_MATERIAL));

const getAllowedSyntesiFinishConfigs = (rules: CountertopMatrixRule[]): SyntesiFinishConfig[] => {
  const ruleFinishes = new Set<string>();

  rules.forEach((rule) => {
    if (normalizeMaterialToken(rule.material) !== normalizeMaterialToken(SYNTESI_MATERIAL)) return;
    rule.allowedFinishes.forEach((finish) => {
      const normalized = finish.trim().toUpperCase();
      if (normalized) ruleFinishes.add(normalized);
    });
  });

  if (ruleFinishes.size === 0) return SYNTESI_FINISH_CONFIGS;

  return SYNTESI_FINISH_CONFIGS.filter((config) => ruleFinishes.has(config.finish));
};

const matchesSourceFinish = (option: ProductOptionData, sourceFinish: string): boolean =>
  getOptionCodeCandidates(option).some((candidate) => {
    const tokens = candidate
      .split(/[\s()_-]+/g)
      .map((token) => token.trim().toUpperCase())
      .filter(Boolean);
    return tokens.includes(sourceFinish);
  });

const findSourceSwatch = (options: ProductOptionData[], config: SyntesiFinishConfig): ProductOptionData | null => {
  const sourceOptions = options.filter((option) => matchesSourceFinish(option, config.sourceFinish));
  const tekorluxSource = sourceOptions.find((option) =>
    getOptionMaterialTokens(option).some((token) => SOURCE_MATERIAL_TOKENS.has(token)),
  );

  return tekorluxSource ?? sourceOptions[0] ?? null;
};

const buildSyntesiOption = (
  source: ProductOptionData | null,
  config: SyntesiFinishConfig,
): CountertopOptionWithSource => {
  const sourceVariantName = source?.metadata?.value ?? source?.name ?? source?.title ?? `Bianco ${config.sourceFinish}`;
  const fallbackHex = resolveCountertopFallbackHex(sourceVariantName);
  const fallbackImage = resolveCountertopFallbackTexture(sourceVariantName);

  return {
    id: `syntesi-countertop-${config.finish}`,
    title: config.title,
    name: config.value,
    sourceGroup: "countertop color",
    desc: SYNTESI_MATERIAL,
    isShortDesc: false,
    metadata: {
      image: source?.metadata?.image ?? fallbackImage,
      value: config.value,
      configValue: config.configValue,
      sku: SYNTESI_MATERIAL_SKU,
      materials: [SYNTESI_MATERIAL],
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
): CountertopOptionWithSource[] => {
  const visibleOptions = options;

  if (!hasSyntesiRule(rules)) return visibleOptions;
  if (hasSyntesiOption(visibleOptions)) return visibleOptions;

  const syntesiOptions = getAllowedSyntesiFinishConfigs(rules).map((config) =>
    buildSyntesiOption(findSourceSwatch(options, config), config),
  );

  return [...visibleOptions, ...syntesiOptions];
};
