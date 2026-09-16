import type { CabinetColorTraitsRuleData, ProductProfile } from "@/entities/collection";
import { selectAttribute, selectRuleData } from "@/entities/collection";
import type { ConfiguratorGroupCatalog } from "@/entities/collection/model/types";
import {
  getConfiguratorVariantOverrides,
  isHiddenConfiguratorDisplayValue,
} from "@/entities/configurator/lib/getConfiguratorVariantOverrides";
import { isVisibleConfiguratorVariant } from "@/entities/configurator/lib/isVisibleConfiguratorVariant";

/**
 * Material and finish of a configurator colour, as the fluting and grain rules read them.
 *
 * Mirrors how the colour pages turn a variant into an option (`buildOptionsFromGroups` and
 * `getVariantMeta`), so a colour recorded by the command service drives the rules exactly
 * as a colour the page records. The tokens come from `ruleData.cabinetColorTraits`.
 */

export type ColorTraits = { material: string; finish: string };

const CONFIGURATOR_SOURCE_PREFIX = "configurator:";

type ColorOption = {
  label: string;
  optionName: string;
  sku: string;
  materials: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const pick = (...values: unknown[]): string | undefined =>
  values.find((value): value is string => typeof value === "string" && value.length > 0);

const fromCsv = (value: unknown): string[] =>
  typeof value === "string"
    ? value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
    : [];

/** The configurator section an attribute's options come from ("configurator:Cabinet Color" -> "Cabinet Color"). */
export const selectConfiguratorSection = (profile: ProductProfile | null, attributeId: string): string | null => {
  const source = selectAttribute(profile, attributeId)?.optionsSource;
  return source?.startsWith(CONFIGURATOR_SOURCE_PREFIX) ? source.slice(CONFIGURATOR_SOURCE_PREFIX.length) : null;
};

const findColorOption = (
  colorName: string,
  configurator: ConfiguratorGroupCatalog,
  section: string,
): ColorOption | null => {
  for (const group of configurator.groups.filter(({ proxyName }) => proxyName === section)) {
    for (const option of group.options) {
      for (const variant of option.variants) {
        if (!isVisibleConfiguratorVariant({ proxyName: group.proxyName, variant })) continue;

        const meta: Record<string, unknown> = variant.metadata ?? {};
        const nested = isRecord(meta.metadata) ? meta.metadata : {};
        const overrides = getConfiguratorVariantOverrides({ proxyName: group.proxyName, variant });
        const label = pick(meta.label, meta.Label, nested.label, nested.Label, overrides.label, variant.name);
        const value = pick(meta.value, nested.value, overrides.value, variant.name);

        if (isHiddenConfiguratorDisplayValue(label) || isHiddenConfiguratorDisplayValue(value)) continue;
        if ((value ?? variant.name) !== colorName && variant.name !== colorName) continue;

        return {
          label: label ?? variant.name,
          optionName: option.name,
          sku: pick(meta.sku) ?? "",
          materials: [
            ...new Set(
              [group.proxyName, option.name, ...fromCsv(pick(nested.Material, meta.Material))].filter(Boolean),
            ),
          ],
        };
      }
    }
  }

  return null;
};

const resolveMaterial = (option: ColorOption, section: string, traits: CabinetColorTraitsRuleData): string => {
  const sku = option.sku.trim().toUpperCase();
  const mapped = Object.entries(traits.materialBySku).find(([key]) => key.trim().toUpperCase() === sku)?.[1];
  if (sku && mapped) return mapped;

  const preferred = option.materials.filter((token) => token !== section);
  return preferred.find((token) => traits.knownMaterials.includes(token)) ?? preferred[0] ?? option.materials[0] ?? "";
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const resolveFinish = (text: string, finishCodes: readonly string[]): string => {
  if (finishCodes.length === 0) return "";

  const match = text.match(new RegExp(`\\b(${finishCodes.map(escapeRegExp).join("|")})\\b`));
  return match?.[1] ?? "";
};

/**
 * `null` when the colour cannot be read at all — the collection declares no colour traits,
 * the attribute has no configurator section, or the configurator is not loaded — so the
 * caller keeps the recorded material instead of wiping it on missing data.
 */
export const resolveColorTraits = (
  colorName: string,
  configurator: ConfiguratorGroupCatalog | null,
  profile: ProductProfile | null,
  attributeId = "CabinetColor",
): ColorTraits | null => {
  const traits = selectRuleData(profile, "cabinetColorTraits");
  const section = selectConfiguratorSection(profile, attributeId);
  if (!traits || !section || !configurator) return null;

  const option = findColorOption(colorName, configurator, section);

  return {
    material: option ? resolveMaterial(option, section, traits) : "",
    finish: resolveFinish(`${colorName} ${option?.label ?? ""} ${option?.optionName ?? ""}`, traits.finishCodes),
  };
};
