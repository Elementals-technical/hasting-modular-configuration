import { describe, expect, it } from "vitest";

import configurator4 from "@/entities/collection/__tests__/fixtures/remote/configurator-4.json";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import type { ConfiguratorGroupCatalog } from "@/entities/collection/model/types";
import {
  getConfiguratorVariantOverrides,
  isHiddenConfiguratorDisplayValue,
} from "@/entities/configurator/lib/getConfiguratorVariantOverrides";
import { isVisibleConfiguratorVariant } from "@/entities/configurator/lib/isVisibleConfiguratorVariant";

import { resolveColorTraits } from "../lib/resolveColorTraits";

/**
 * DEV-05: the cabinet page used to read a colour's material and finish with its own table
 * (SKU → material, a regular expression of finish codes). It now asks the collection's
 * `cabinetColorTraits`. The page's former reading is kept here, verbatim, to prove that every
 * cabinet colour of configurator 4 reads the same through the profile.
 */

type Variant = { name: string; enabled: boolean; image?: string | null; metadata?: Record<string, unknown> };
type Group = { proxyName: string; options: { name: string; variants: Variant[] }[] };

const configurator = { groups: configurator4.availableOptions } as unknown as ConfiguratorGroupCatalog;
const cabinetColorGroups = (configurator4.availableOptions as unknown as Group[]).filter(
  ({ proxyName }) => proxyName === "Cabinet Color",
);

const fromCsv = (value: unknown): string[] =>
  typeof value === "string"
    ? value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
    : [];

/** The page's former material reading. */
const legacyMaterial = (sku: string, materials: string[]): string => {
  const normalizedSku = sku.trim().toUpperCase();
  const bySku: Record<string, string> = {
    ESS: "Essenze",
    HPL: "HPL",
    "3D": "3D",
    LACM: "LACM",
    LACG: "LACG",
    ST: "ST",
    BM: "BM",
  };
  if (bySku[normalizedSku]) return bySku[normalizedSku];

  const preferred = materials.filter((token) => token !== "Cabinet Color");
  return preferred.find((token) => ["Essenze", "HPL", "3D"].includes(token)) ?? preferred[0] ?? materials[0] ?? "";
};

/** The page's former finish reading. */
const legacyFinish = (text: string): string =>
  text.match(/\b(TKP|TKQ|TKN|10B|10F|10G|10N|1PE|1A1|1A2|1A3|1A4|1A5)\b/)?.[1] ?? "";

const colours = cabinetColorGroups.flatMap(({ proxyName, options }) =>
  options.flatMap((option) =>
    option.variants
      // The page offered only visible variants, and never the hidden special display value.
      .filter((variant) => isVisibleConfiguratorVariant({ proxyName, variant }))
      .flatMap((variant) => {
        const meta = variant.metadata ?? {};
        const nested = (typeof meta.metadata === "object" && meta.metadata ? meta.metadata : {}) as Record<
          string,
          unknown
        >;
        const overrides = getConfiguratorVariantOverrides({ proxyName, variant });
        const label = String(meta.label ?? meta.Label ?? nested.label ?? overrides.label ?? variant.name);
        const value = String(meta.value ?? nested.value ?? overrides.value ?? variant.name);
        if (isHiddenConfiguratorDisplayValue(label) || isHiddenConfiguratorDisplayValue(value)) return [];
        const materials = [
          ...new Set([proxyName, option.name, ...fromCsv(nested.Material ?? meta.Material)].filter(Boolean)),
        ];

        return [
          {
            value,
            material: legacyMaterial(String(meta.sku ?? ""), materials),
            finish: legacyFinish(`${value} ${label} ${option.name}`),
          },
        ];
      }),
  ),
);

describe("cabinet colour traits come from the profile (DEV-05)", () => {
  it("reads configurator 4 colours", () => {
    expect(colours.length).toBeGreaterThan(0);
  });

  it("gives every cabinet colour the material and finish the page used to read", () => {
    const mismatches = colours.flatMap(({ value, material, finish }) => {
      const traits = resolveColorTraits(value, configurator, ushProfile);
      return traits?.material === material && traits.finish === finish
        ? []
        : [{ value, expected: { material, finish }, actual: traits }];
    });

    expect(mismatches).toEqual([]);
  });
});
