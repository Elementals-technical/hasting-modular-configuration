import {
  resolveCountertopFallbackHex,
  resolveCountertopFallbackTexture,
  resolveCountertopNeedsLightBorder,
} from "@/entities/countertop";
import {
  appendSyntesiCountertopOptions,
  getMaterialAliases,
  normalizeMaterialToken,
} from "@/features/configurator-rule-core/countertop";
import { fromCsv, pick } from "@/features/collectionCustomization";
import { buildMaterialFilters, toFilterOptions, type FilterOption } from "@/shared/constants/materialFilters";
import { extractColorCode } from "@/shared/lib/sku";

import type { ProductProfile } from "@/entities/collection";
import type { ConfiguratorAvailableOption } from "@/entities/configurator/api/types";
import type { ProductOptionData } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import type { useCountertopRules } from "@/features/configurator-rule-core/countertop";

/** A countertop or vessel colour option, with the configurator section it came from. */
type CountertopOption = ProductOptionData & { sourceGroup?: string };

export type MaterialFilterOption = FilterOption & {
  disabled?: boolean;
  reason?: string;
  children?: MaterialFilterOption[];
};

export type MaterialFilters = ReturnType<typeof buildMaterialFilters>;

type CountertopRules = ReturnType<typeof useCountertopRules>;

const COUNTERTOP_OPTION = "Counertops materials";
const VESSEL_GROUP = "vessels";

export const VESSEL_SINK_NONE_OPTION_VALUE = "__vessel_sink_none__";

export const VESSEL_SINK_NONE_OPTION: ProductOptionData = {
  id: "vessel-sink-none",
  title: "None",
  name: VESSEL_SINK_NONE_OPTION_VALUE,
  isShortDesc: false,
};

/** Material filters the collection hides from the countertop step (`ruleData.countertopFallbacks`). */
const isExcludedCountertopMaterialFilter = (value: string, excludedTokens: readonly string[]) =>
  excludedTokens.includes(normalizeMaterialToken(value));

// The part after the last ":" is the material name.
const normalizeMaterialLabel = (value: string) => {
  const parts = value
    .split(":")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : value;
};

const normalizeMaterialAlias = (value: string) => {
  const trimmed = value.trim();
  const normalized = normalizeMaterialToken(trimmed);
  if (normalized === "tekorund") return "Tekormud";
  if (normalized === "sstkr" || normalized === "tal" || normalized === "tam") return "Tekorlux";
  return trimmed;
};

type ConfiguratorVariant = ConfiguratorAvailableOption["options"][number]["variants"][number];

const getVariantMeta = (variant: ConfiguratorVariant) => {
  const meta = (variant.metadata ?? {}) as Record<string, unknown>;
  const nested = typeof meta.metadata === "object" && meta.metadata ? (meta.metadata as Record<string, unknown>) : {};

  return {
    material: pick(nested.Material, meta.Material),
    color: pick(nested.Color, meta.Color),
    look: pick(nested.Look, meta.Look),
    codeColor: pick(nested.codeColor, nested.codecolor, meta.codeColor, meta.codecolor),
    hex: pick(nested.hex, meta.hex),
    image: pick(nested.image, meta.image, variant.image),
    value: pick(meta.value, nested.value, variant.name),
    label: pick(meta.label, meta.Label, nested.label, nested.Label, variant.name),
    sku: pick(meta.sku),
  };
};

const buildMaterialTokens = (name: string, metaMaterial?: string, extraTokens: string[] = []) => {
  const tokens = new Set<string>();
  fromCsv(metaMaterial).forEach((token) => tokens.add(normalizeMaterialAlias(token)));
  if (name) tokens.add(normalizeMaterialAlias(name));
  extraTokens.filter(Boolean).forEach((token) => tokens.add(normalizeMaterialAlias(token)));

  const parts = name
    .split(":")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length > 1) tokens.add(normalizeMaterialAlias(parts[parts.length - 1]));
  return Array.from(tokens);
};

/** Countertop and vessel colours of the configurator, plus the Syntesi options the rules add. */
export const buildCountertopColorOptions = (
  groups: ConfiguratorAvailableOption[],
  rules: CountertopRules,
  profile: ProductProfile | null,
): CountertopOption[] => {
  const colorGroups = groups.filter((g) => g.proxyName === "Countertop Color" || g.proxyName === "Vessels");
  if (!colorGroups.length) return appendSyntesiCountertopOptions([], rules, profile);

  const seen = new Set<string>();

  const apiOptions = colorGroups.flatMap((group) =>
    group.options.flatMap((option) =>
      option.variants
        .filter((variant) => variant.enabled)
        .flatMap((variant) => {
          const normalizedName = variant.name.trim().toLowerCase();
          const normalizedMaterialName = (option.name ?? "").trim().toLowerCase();
          const normalizedProxyName = (group.proxyName ?? "").trim().toLowerCase();
          const dedupeKey = `${normalizedProxyName}::${normalizedMaterialName}::${normalizedName}`;
          if (seen.has(dedupeKey)) return [];
          seen.add(dedupeKey);

          const meta = getVariantMeta(variant);
          const metaCodeColor = meta.codeColor?.trim();
          const isCemento = variant.name.toLowerCase().startsWith("cemento");
          const baseColors = fromCsv(meta.color);
          const colors = baseColors.length > 0 ? baseColors : metaCodeColor ? [metaCodeColor] : [];

          const baseLooks = fromCsv(meta.look);
          const codeTokens = (metaCodeColor ?? "").split(/\s+/).filter(Boolean);
          const inferredLook =
            codeTokens.length > 1 && /^[A-Za-z]{2,3}$/.test(codeTokens[codeTokens.length - 1])
              ? codeTokens[codeTokens.length - 1]
              : undefined;
          const looks = baseLooks.length > 0 ? baseLooks : inferredLook ? [inferredLook] : [];

          return [
            {
              id: `${normalizedProxyName}:${option.id}:${variant.id}`,
              title: meta.label ?? variant.name,
              name: variant.name,
              sourceGroup: normalizedProxyName,
              desc: normalizeMaterialLabel(option.name || group.proxyName || variant.name),
              isShortDesc: false,
              metadata: {
                image: meta.image ?? resolveCountertopFallbackTexture(variant.name),
                value: meta.value ?? variant.name,
                codeColor: metaCodeColor,
                sku: meta.sku,
                materials: buildMaterialTokens(option.name || variant.name, meta.material ?? option.name, [
                  ...(group.proxyName ? [group.proxyName] : []),
                  ...(isCemento ? ["Cemento"] : []),
                ]),
                colors,
                looks,
                hex: meta.hex?.trim() ?? resolveCountertopFallbackHex(variant.name),
                lightBorder: resolveCountertopNeedsLightBorder(variant.name),
              },
            },
          ];
        }),
    ),
  );

  return appendSyntesiCountertopOptions(apiOptions, rules, profile);
};

export const isVesselApiOption = (option: CountertopOption) => option.sourceGroup === VESSEL_GROUP;

const VESSEL_COMPATIBLE_MATERIALS = new Set(["hpl", "porcelain", "tekorlux", "tal", "tam", "solidsurface"]);

const isVesselCompatibleCountertopOption = (option: CountertopOption) =>
  !isVesselApiOption(option) &&
  (option.metadata?.materials ?? []).some((material) =>
    getMaterialAliases(material).some((alias) => VESSEL_COMPATIBLE_MATERIALS.has(alias)),
  );

export const isVesselColorOption = (option: CountertopOption) =>
  isVesselApiOption(option) || isVesselCompatibleCountertopOption(option);

export const buildDefaultMaterialFilters = (excludedTokens: readonly string[]): MaterialFilters => {
  const baseFilters = buildMaterialFilters(COUNTERTOP_OPTION);

  return {
    ...baseFilters,
    materials: baseFilters.materials.filter(
      (option) => !isExcludedCountertopMaterialFilter(option.value, excludedTokens),
    ),
  };
};

type CountertopMaterialFilterArgs = {
  groups: ConfiguratorAvailableOption[];
  countertopOptions: CountertopOption[];
  defaultFilters: MaterialFilters;
  excludedTokens: readonly string[];
  matrixMaterials: ReadonlySet<string>;
  syntesiMaterial: string | null;
};

/** Filter values of the countertop colours: what the configurator declares and the matrix knows. */
export const buildCountertopMaterialFilters = ({
  groups,
  countertopOptions,
  defaultFilters,
  excludedTokens,
  matrixMaterials,
  syntesiMaterial,
}: CountertopMaterialFilterArgs): MaterialFilters => {
  const colorGroups = groups.filter((g) => g.proxyName === "Countertop Color");
  const syntesiOptions = countertopOptions.filter((option) =>
    option.metadata?.materials?.some(
      (material) =>
        syntesiMaterial !== null && normalizeMaterialToken(material) === normalizeMaterialToken(syntesiMaterial),
    ),
  );

  if (!colorGroups.length && !syntesiOptions.length) return defaultFilters;

  const materialSet = new Set<string>();
  const colorSet = new Set<string>();
  const lookSet = new Set<string>();
  const hexSet = new Set<string>();

  colorGroups.forEach((group) => {
    group.options.forEach((option) => {
      option.variants?.forEach((variant) => {
        if (!variant.enabled) return;

        const meta = getVariantMeta(variant);
        const candidateMaterials = [option.name, ...fromCsv(meta.material ?? option.name)]
          .filter(Boolean)
          .map((value) => normalizeMaterialAlias(value))
          .filter((value) => !isExcludedCountertopMaterialFilter(value, excludedTokens));

        if (!candidateMaterials.length) return;

        const matchesMatrix =
          matrixMaterials.size === 0 ||
          candidateMaterials.some((value) => getMaterialAliases(value).some((alias) => matrixMaterials.has(alias)));
        if (!matchesMatrix) return;

        candidateMaterials.forEach((value) => materialSet.add(value));
        if (variant.name.toLowerCase().startsWith("cemento")) materialSet.add("Cemento");

        fromCsv(meta.color).forEach((value) => colorSet.add(value));
        fromCsv(meta.look).forEach((value) => lookSet.add(value));
        if (meta.hex) hexSet.add(meta.hex.trim());
      });
    });
  });

  syntesiOptions.forEach((option) => {
    if (syntesiMaterial) materialSet.add(syntesiMaterial);
    (option.metadata?.colors ?? []).forEach((value) => colorSet.add(value));
    (option.metadata?.looks ?? []).forEach((value) => lookSet.add(value));
    const hex = option.metadata?.hex?.trim();
    if (hex) hexSet.add(hex);
  });

  return {
    materials: toFilterOptions(materialSet),
    colors: toFilterOptions(colorSet),
    looks: toFilterOptions(lookSet),
    hex: toFilterOptions(hexSet),
  };
};

/** Filter values of the vessel colours; HPL, Porcelain and Tekorlux are always offered. */
export const buildVesselMaterialFilters = (
  vesselColorOptions: CountertopOption[],
  defaultFilters: MaterialFilters,
): MaterialFilters => {
  if (!vesselColorOptions.length) return defaultFilters;

  const materialSet = new Set<string>(["HPL", "Porcelain", "Tekorlux"]);
  const colorSet = new Set<string>();
  const lookSet = new Set<string>();
  const hexSet = new Set<string>();

  vesselColorOptions.forEach((option) => {
    if (!isVesselColorOption(option)) return;

    const vesselMaterial = (option.desc ?? "").trim();
    if (vesselMaterial) materialSet.add(normalizeMaterialAlias(vesselMaterial));
    (option.metadata?.colors ?? []).forEach((value) => colorSet.add(value));
    (option.metadata?.looks ?? []).forEach((value) => lookSet.add(value));
    const hex = option.metadata?.hex?.trim();
    if (hex) hexSet.add(hex);
  });

  return {
    materials: toFilterOptions(materialSet),
    colors: toFilterOptions(colorSet),
    looks: toFilterOptions(lookSet),
    hex: toFilterOptions(hexSet),
  };
};

export const getVesselOptionMaterialTokens = (option: ProductOptionData): string[] => {
  const tokens = new Set<string>();
  const add = (raw?: string) => {
    if (!raw) return;
    const normalized = normalizeMaterialToken(raw);
    if (normalized) tokens.add(normalized);
    raw
      .split(/[\\/,&]/g)
      .map((chunk) => normalizeMaterialToken(chunk))
      .filter(Boolean)
      .forEach((chunk) => tokens.add(chunk));
  };

  add(option.desc ?? "");
  (option.metadata?.materials ?? []).forEach((material) => {
    add(material);
    getMaterialAliases(material).forEach((alias) => tokens.add(alias));
  });

  return Array.from(tokens);
};

const getSelectedVesselMaterialTokens = (selectedMaterial: string): Set<string> => {
  const normalized = normalizeMaterialToken(selectedMaterial);
  const tokens = new Set<string>([normalized, ...getMaterialAliases(selectedMaterial)]);

  if (normalized === "hpl" || normalized === "fenix") tokens.add("hplfenix");
  if (normalized === "tekorlux") {
    tokens.add("tal");
    tokens.add("tam");
  }

  return tokens;
};

export const vesselMaterialsMatchSelection = (option: ProductOptionData, selectedMaterial: string) => {
  const selectedTokens = getSelectedVesselMaterialTokens(selectedMaterial);
  return getVesselOptionMaterialTokens(option).some((token) => selectedTokens.has(token));
};

export const getVesselOptionColorCode = (option: ProductOptionData): string | null =>
  option.metadata?.codeColor ?? extractColorCode(option.metadata?.value ?? option.name ?? option.title);

export const getOptionConfigValue = (option: ProductOptionData): string =>
  option.metadata?.value ?? option.name ?? option.title;
