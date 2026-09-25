import { describe, expect, it } from "vitest";

import urbanLowHeightProfileDocument from "../../../../../public/collections/urban-low-height/product-profile.json";
import urbanLowHeightSkuProfileDocument from "../../../../../public/collections/urban-low-height/sku-profile.json";

import configurator4 from "@/entities/collection/__tests__/fixtures/remote/configurator-4.json";
import { collectionSkuProfileSchema, parseProductProfile } from "@/entities/collection";
import type { ConfiguratorGroupCatalog } from "@/entities/collection/model/types";
import type { ConfiguratorAvailableOption } from "@/entities/configurator/api/types";

import {
  buildCollectionCabinetSku,
  buildCollectionCountertopSkus,
  type CollectionValueReader,
} from "../buildCollectionSkus";
import { createConfiguratorColorReader } from "../configuratorColors";

/**
 * Urban Low Height SKUs from its `sku-profile.json`. Each expected SKU is a form of the price
 * workbook (Pricing, in inches) that the price server resolved on 2026-09-25. The workbook writes
 * 38 and 28 cm as `15.0H` and `11.0H`; the SKU carries `15H` and `11H`, as the team spells them.
 */

const parsed = parseProductProfile(urbanLowHeightProfileDocument);
if (!parsed.ok) throw new Error("Urban Low Height profile failed validation");
const profile = parsed.profile;
const skuProfile = collectionSkuProfileSchema.parse(urbanLowHeightSkuProfileDocument);

/** Cabinet colours of configurator 4 beyond the two 3D ones the frozen fixture keeps, as it carries them. */
const CONFIGURATOR_4_CABINET_COLORS: readonly { value: string; sku: string; material: string }[] = [
  { value: "Cemento Cenere 1A1", sku: "3D", material: "3D" },
  { value: "Ardesia TKF", sku: "HPL", material: "HPL" },
  { value: "Arancio Zucca 09 MT", sku: "LACM", material: "Lacquered MT" },
  { value: "Bianco 0B MT", sku: "LACM", material: "Lacquered MT" },
  { value: "Rosso Rubino 19 ST", sku: "ST", material: "Soft-Touch" },
  { value: "Rovere Eucalipto 01A", sku: "ESS", material: "Essenze" },
  { value: "Metal acciaio 2MA", sku: "BM", material: "Brushed Metal" },
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
    read: reader({ CabinetType: "Sink-Base", Drawers: "1", Handle: "handle_urban_topcut", ...values }),
    widthCm,
    heightCm,
    depthCm,
    readConfiguratorColor,
  });

describe("Urban Low Height cabinet SKU", () => {
  it("spells a sink base with the upper groove and no fluting", () => {
    expect(cabinet({ CabinetColor: "Ardesia TKF" }, 90, 38)).toEqual({
      sku: "VAN-URLH-SB/1DW/UG/X-35.4W-15H-19.7D-CAB-HPL-TKF",
      missing: [],
    });
  });

  it("spells push-to-open and fluting, and the lacquer code without its finish", () => {
    expect(
      cabinet(
        { Handle: "handle_pto", DrawerPanelFluting: "FlutingVerticalB", CabinetColor: "Arancio Zucca 09 MT" },
        105,
        35,
      ).sku,
    ).toBe("VAN-URLH-SB/1DW/PTO/CVB-41.3W-13.8H-19.7D-CAB-LACM-09");
  });

  it("carries Bianco 0B, which the price server prices in the White GL/MT column", () => {
    expect(
      cabinet({ CabinetType: "Side-Cabinet", Handle: "handle_pto", CabinetColor: "Bianco 0B MT" }, 60, 35).sku,
    ).toBe("VAN-URLH-SC/1DW/PTO/X-23.6W-13.8H-19.7D-CAB-LACM-0B");
  });

  it("reads the colour codes the name does not carry as a number", () => {
    const sideCabinet = (CabinetColor: string) =>
      cabinet({ CabinetType: "Side-Cabinet", Handle: "handle_pto", CabinetColor }, 25, 25, 46).sku;

    expect(sideCabinet("Castagno Malto 1C2")).toBe("VAN-URLH-SC/1DW/PTO/X-9.8W-9.8H-18.1D-CAB-3D-1C2");
    expect(sideCabinet("Rovere Eucalipto 01A")).toBe("VAN-URLH-SC/1DW/PTO/X-9.8W-9.8H-18.1D-CAB-ESS-01A");
    expect(sideCabinet("Metal acciaio 2MA")).toBe("VAN-URLH-SC/1DW/PTO/X-9.8W-9.8H-18.1D-CAB-BM-2MA");
    expect(sideCabinet("Rosso Rubino 19 ST")).toBe("VAN-URLH-SC/1DW/PTO/X-9.8W-9.8H-18.1D-CAB-ST-19");
  });

  it("reads the legacy drawer spelling through the profile aliases, at the 28 cm height", () => {
    expect(cabinet({ Drawers: "1D", CabinetColor: "Castagno Malto 1C2" }, 120, 28).sku).toBe(
      "VAN-URLH-SB/1DW/UG/X-47.2W-11H-19.7D-CAB-3D-1C2",
    );
  });

  it('spells the sink base and the open shelf of the 42" 1-Drawer 2 model as the price list does', () => {
    const cabinetOfModel = (CabinetType: string, widthCm: number) =>
      cabinet({ CabinetType, CabinetColor: "Cemento Cenere 1A1" }, widthCm, 38, 46).sku;

    expect(cabinetOfModel("Sink-Base", 80)).toBe("VAN-URLH-SB/1DW/UG/X-31.5W-15H-18.1D-CAB-3D-1A1");
    // The open shelf has a series of its own and no drawer or handle.
    expect(cabinetOfModel("Open-Shelf", 25)).toBe("VAN-UROS-1S-9.8W-15H-18.1D-CAB-3D-1A1");
  });
});

describe("Urban Low Height countertop SKUs", () => {
  const countertop = (style: string) =>
    buildCollectionCountertopSkus(skuProfile, profile, {
      style,
      color: "Ardesia TKF",
      basins: ["Top_HPLPrisma"],
      widthCm: 120,
      faucetHoles: "1",
      readConfiguratorColor,
    });

  it("prices the vessel cutout and faucet holes Urban Standard Height sells, and no top", () => {
    expect(countertop("vessel")).toEqual({
      material: "HPL",
      thickness: null,
      top: null,
      basins: [null],
      holeCut: "CT-URHPL-HCUT",
      faucetHoles: "CT-URHPL-FAHO/1",
      bracket: null,
    });
  });

  it("has no top or basin SKU for an integrated countertop", () => {
    expect(countertop("integrated")).toMatchObject({ top: null, basins: [null], holeCut: null });
  });
});
