import type {
  AttributeValue,
  IMapUIData,
  IMaterialMetadata,
  IProductElementOption,
  IThreekitConfiguration,
} from "../model/types";

const uid = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `sw-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;

const trimOrUndefined = (value: string | undefined): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const pickString = (...candidates: unknown[]): string | undefined => {
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c;
  }
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
        if (!variant.enabled) continue;

        const outer = (variant.metadata ?? {}) as Record<string, unknown>;
        const nested = (
          typeof outer.metadata === "object" && outer.metadata
            ? outer.metadata
            : {}
        ) as Record<string, unknown>;

        const label = pickString(
          outer.label,
          outer.Label,
          nested.label,
          nested.Label,
          variant.name,
        );
        if (!label) continue;

        const value = pickString(outer.value, nested.value, variant.name) ?? label;

        const material =
          pickString(nested.Material, outer.Material) ?? option.name;
        const image =
          pickString(nested.image, outer.image, outer.Image, nested.Image) ??
          (typeof variant.image === "string" ? variant.image : undefined);
        const hex = pickString(nested.hex, outer.hex, nested.Hex, outer.Hex);
        const color = trimOrUndefined(pickString(nested.Color, outer.Color));
        const look = trimOrUndefined(pickString(nested.Look, outer.Look));
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
