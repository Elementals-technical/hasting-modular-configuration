import { describe, expect, it } from "vitest";

import urbanFreestandingProfileDocument from "../../../../../public/collections/urban-freestanding/product-profile.json";
import urbanFreestandingSkuProfileDocument from "../../../../../public/collections/urban-freestanding/sku-profile.json";

import configurator4 from "@/entities/collection/__tests__/fixtures/remote/configurator-4.json";
import { collectionSkuProfileSchema, parseProductProfile } from "@/entities/collection";
import type { ConfiguratorGroupCatalog } from "@/entities/collection/model/types";
import type { ConfiguratorAvailableOption } from "@/entities/configurator/api/types";

import { buildCollectionCabinetSku, type CollectionValueReader } from "../buildCollectionSkus";
import { createConfiguratorColorReader } from "../configuratorColors";

/**
 * Urban Freestanding SKUs from its `sku-profile.json`. Each expected SKU is a form of the SKU
 * Curation sheet of the price workbook, with the sizes in inches as the Pricing sheet writes them
 * (60 × 91 × 50 cm is `23.6W-35.8H-19.7D`); the heights include the 3 cm plinth. The HDL of a
 * grooved cabinet follows the workbook's SKU formula (element #2). The price server has not been
 * asked for these forms.
 */

const parsed = parseProductProfile(urbanFreestandingProfileDocument);
if (!parsed.ok) throw new Error("Urban Freestanding profile failed validation");
const profile = parsed.profile;
const skuProfile = collectionSkuProfileSchema.parse(urbanFreestandingSkuProfileDocument);

/** Cabinet colours of configurator 4 beyond the 3D one the frozen fixture keeps, as it carries them. */
const CONFIGURATOR_4_CABINET_COLORS: readonly { value: string; sku: string; material: string }[] = [
  { value: "Cemento Cenere 1A1", sku: "3D", material: "3D" },
  { value: "Ardesia TKF", sku: "HPL", material: "HPL" },
  { value: "Arancio Zucca 09 MT", sku: "LACM", material: "Lacquered MT" },
  { value: "Rovere Eucalipto 01A", sku: "ESS", material: "Essenze" },
];

const configurator: ConfiguratorGroupCatalog = (() => {
  const groups = (configurator4.availableOptions as unknown as ConfiguratorAvailableOption[]).map((group) =>
    group.proxyName === "Cabinet Color"
      ? {
          ...group,
          options: [
            ...group.options,
            ...CONFIGURATOR_4_CABINET_COLORS.map(({ value, sku, material }, position) => ({
              ...group.options[0],
              id: 90_000 + position,
              name: material,
              variants: [
                {
                  id: 90_000 + position,
                  name: value,
                  image: null,
                  enabled: true,
                  description: "",
                  metadata: { value, label: value, sku, Material: material },
                },
              ],
            })),
          ],
        }
      : group,
  );

  return { groups, groupsByName: Object.fromEntries(groups.map((group) => [group.proxyName, group])) };
})();

const readConfiguratorColor = createConfiguratorColorReader(profile, configurator);

const reader =
  (values: Record<string, string>): CollectionValueReader =>
  (attributeId) =>
    values[attributeId] ?? null;

const cabinet = (values: Record<string, string>, widthCm: number, heightCm: number, depthCm = 50) =>
  buildCollectionCabinetSku(skuProfile, profile, {
    read: reader({ CabinetType: "Sink-Base", Drawers: "2", Handle: "UG", ...values }),
    widthCm,
    heightCm,
    depthCm,
    readConfiguratorColor,
  });

describe("Urban Freestanding cabinet SKU", () => {
  it("spells a sink base with the upper groove and no fluting, its groove in the cabinet colour", () => {
    expect(cabinet({ CabinetColor: "Ardesia TKF" }, 60, 91)).toEqual({
      sku: "VAN-URFS-SB/2DW/UG/X-23.6W-35.8H-19.7D-CAB-HPL-TKF-HDL-HPL-TKF",
      missing: [],
    });
  });

  it("spells the central groove at the same 91 cm and push-to-open at 88 cm without a groove", () => {
    expect(cabinet({ Handle: "CG", CabinetColor: "Ardesia TKF" }, 60, 91).sku).toBe(
      "VAN-URFS-SB/2DW/CG/X-23.6W-35.8H-19.7D-CAB-HPL-TKF-HDL-HPL-TKF",
    );
    expect(cabinet({ Handle: "PTO", CabinetColor: "Ardesia TKF" }, 60, 88).sku).toBe(
      "VAN-URFS-SB/2DW/PTO/X-23.6W-34.6H-19.7D-CAB-HPL-TKF",
    );
  });

  it("spells the fluting and the lacquer code without its finish", () => {
    expect(
      cabinet({ Handle: "PTO", DrawerPanelFluting: "FlutingVerticalB", CabinetColor: "Arancio Zucca 09 MT" }, 105, 88)
        .sku,
    ).toBe("VAN-URFS-SB/2DW/PTO/CVB-41.3W-34.6H-19.7D-CAB-LACM-09");
  });

  it("spells a side cabinet at the shallow depth, reading the colour codes the name does not carry as a number", () => {
    const sideCabinet = (CabinetColor: string) =>
      cabinet({ CabinetType: "Sink-Cabinet", CabinetColor }, 25, 91, 46).sku;

    expect(sideCabinet("Cemento Cenere 1A1")).toBe("VAN-URFS-SC/2DW/UG/X-9.8W-35.8H-18.1D-CAB-3D-1A1-HDL-3D-1A1");
    expect(sideCabinet("Rovere Eucalipto 01A")).toBe("VAN-URFS-SC/2DW/UG/X-9.8W-35.8H-18.1D-CAB-ESS-01A-HDL-ESS-01A");
  });

  it("reads the legacy drawer spelling through the profile aliases", () => {
    expect(cabinet({ Drawers: "2D", CabinetColor: "Cemento Cenere 1A1" }, 120, 91).sku).toBe(
      "VAN-URFS-SB/2DW/UG/X-47.2W-35.8H-19.7D-CAB-3D-1A1-HDL-3D-1A1",
    );
  });
});
