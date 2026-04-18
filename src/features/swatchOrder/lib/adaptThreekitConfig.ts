import type {
  AttributeValue,
  IMapUIData,
  IMaterialMetadata,
  IProductElementOption,
  IThreekitConfiguration,
} from "../model/types";
import {
  getCountertopMaterialTokensBySku,
  getCountertopMaterialTokensFromBasinType,
} from "@/shared/lib/sku";
import {
  resolveCountertopFallbackHex,
  resolveCountertopNeedsLightBorder,
  resolveCountertopFallbackTexture,
} from "@/entities/countertop";
import { getConfiguratorVariantOverrides } from "@/entities/configurator/lib/getConfiguratorVariantOverrides";
import { isVisibleConfiguratorVariant } from "@/entities/configurator/lib/isVisibleConfiguratorVariant";

const uid = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `sw-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;

const trimOrUndefined = (value: string | undefined): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const splitCsv = (value: string | undefined): string[] =>
  value
    ?.split(",")
    .map((part) => part.trim())
    .filter(Boolean) ?? [];

const pickString = (...candidates: unknown[]): string | undefined => {
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c;
  }
  return undefined;
};

const COUNTERTOP_PRODUCT_ELEMENT = "Countertop Color";

const inferCountertopMaterial = ({
  explicitMaterial,
  optionName,
  variantName,
  sku,
}: {
  explicitMaterial?: string;
  optionName: string;
  variantName: string;
  sku?: string;
}): string | undefined => {
  const normalizedExplicit = explicitMaterial?.trim().toLowerCase() ?? "";
  const inferredTokens = new Set<string>([
    ...getCountertopMaterialTokensBySku(sku),
    ...getCountertopMaterialTokensFromBasinType(optionName),
    ...getCountertopMaterialTokensFromBasinType(variantName),
  ]);

  if (!inferredTokens.size) return explicitMaterial;
  if (
    inferredTokens.has("tekorlux") ||
    inferredTokens.has("sstkr") ||
    inferredTokens.has("tal") ||
    inferredTokens.has("tam")
  ) {
    return "Tekorlux";
  }
  if (
    inferredTokens.has("tekormud") ||
    inferredTokens.has("tekorund") ||
    inferredTokens.has("sstm")
  ) {
    return "Tekormud";
  }
  if (inferredTokens.has("ocritech") || inferredTokens.has("ssocr")) return "Ocritech";
  if (
    inferredTokens.has("mineralmarmo") ||
    inferredTokens.has("minermalmaro") ||
    inferredTokens.has("ssmmo")
  ) {
    return "Mineralmarmo";
  }
  if (inferredTokens.has("porcelain") || inferredTokens.has("por")) return "Porcelain";
  if (
    inferredTokens.has("fenix") ||
    inferredTokens.has("fx") ||
    inferredTokens.has("hplfenix")
  ) {
    return "Fenix";
  }
  if (inferredTokens.has("hpl")) return "HPL";
  if (inferredTokens.has("glassmt")) return "Glass MT";
  if (inferredTokens.has("glassgl")) return "Glass GL";
  if (inferredTokens.has("glass")) return "Glass";
  if (normalizedExplicit) return explicitMaterial;

  return undefined;
};

export const adaptThreekitConfig = (
  data: IThreekitConfiguration | null | undefined,
): IMapUIData => {
  if (!data?.availableOptions?.length) {
    return { allMaterialValues: [], productElementOptions: [] };
  }

  const productElementOptions: IProductElementOption[] = [];
  const allMaterialValues: AttributeValue[] = [];

  for (const group of data.availableOptions) {
    if (!group.enabled) continue;
    if (group.proxyType !== "material") continue;

    const parentName = group.proxyName;
    const valuesArray: AttributeValue[] = [];

    for (const option of group.options ?? []) {
      for (const variant of option.variants ?? []) {
        if (!isVisibleConfiguratorVariant({ proxyName: parentName, variant })) continue;

        const outer = (variant.metadata ?? {}) as Record<string, unknown>;
        const nested = (
          typeof outer.metadata === "object" && outer.metadata
            ? outer.metadata
            : {}
        ) as Record<string, unknown>;
        const overrides = getConfiguratorVariantOverrides({ proxyName: parentName, variant });

        const label = pickString(
          outer.label,
          outer.Label,
          nested.label,
          nested.Label,
          overrides.label,
          variant.name,
        );
        if (!label) continue;

        const value = pickString(outer.value, nested.value, overrides.value, variant.name) ?? label;

        const explicitMaterial = pickString(nested.Material, outer.Material);
        const material =
          parentName === COUNTERTOP_PRODUCT_ELEMENT
            ? inferCountertopMaterial({
                explicitMaterial,
                optionName: option.name,
                variantName: variant.name,
                sku: pickString(outer.sku, nested.sku),
              }) ?? explicitMaterial ?? option.name
            : explicitMaterial ?? option.name;
        const rawImage =
          overrides.image ??
          pickString(nested.image, outer.image, outer.Image, nested.Image) ??
          (typeof variant.image === "string" ? variant.image : undefined);
        const image =
          parentName === COUNTERTOP_PRODUCT_ELEMENT
            ? rawImage ?? resolveCountertopFallbackTexture(variant.name)
            : rawImage;
        const rawHex = pickString(nested.hex, outer.hex, nested.Hex, outer.Hex);
        const hex =
          parentName === COUNTERTOP_PRODUCT_ELEMENT
            ? rawHex ?? resolveCountertopFallbackHex(variant.name)
            : rawHex;
        const rawColor = trimOrUndefined(pickString(nested.Color, outer.Color));
        const rawLook = trimOrUndefined(pickString(nested.Look, outer.Look));
        const rawCodeColor = trimOrUndefined(
          pickString(nested.codeColor, nested.codecolor, outer.codeColor, outer.codecolor),
        );
        const color =
          parentName === COUNTERTOP_PRODUCT_ELEMENT
            ? splitCsv(rawColor).join(", ") || rawCodeColor
            : rawColor;
        const inferredLook =
          parentName === COUNTERTOP_PRODUCT_ELEMENT
            ? (() => {
                const codeTokens = (rawCodeColor ?? "").split(/\s+/).filter(Boolean);
                if (codeTokens.length <= 1) return undefined;
                const suffix = codeTokens[codeTokens.length - 1];
                return /^[A-Za-z]{2,3}$/.test(suffix) ? suffix : undefined;
              })()
            : undefined;
        const look =
          parentName === COUNTERTOP_PRODUCT_ELEMENT
            ? splitCsv(rawLook).join(", ") || inferredLook
            : rawLook;
        const zoomIconColor = pickString(nested.zoomIconColor, outer.zoomIconColor);

        const metadata: IMaterialMetadata = {
          label,
          value,
          Material: material,
          Finish: material,
          Color: color,
          Look: look,
          image,
          hex,
          zoomIconColor,
          lightBorder:
            parentName === COUNTERTOP_PRODUCT_ELEMENT
              ? resolveCountertopNeedsLightBorder(variant.name)
              : undefined,
        };

        const item: AttributeValue = {
          id: uid(),
          assetId: String(variant.id),
          name: variant.name,
          parentName,
          optionName: parentName,
          label,
          value,
          count: 1,
          metadata,
        };

        valuesArray.push(item);
        allMaterialValues.push(item);
      }
    }

    if (valuesArray.length) {
      productElementOptions.push({
        id: `pe-${group.id}`,
        value: parentName,
        label: parentName,
        valuesArray,
      });
    }
  }

  allMaterialValues.sort((a, b) =>
    (a.label?.toLowerCase() ?? "").localeCompare(b.label?.toLowerCase() ?? ""),
  );

  return { allMaterialValues, productElementOptions };
};
