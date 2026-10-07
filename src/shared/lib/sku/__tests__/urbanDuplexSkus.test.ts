import { describe, expect, it } from "vitest";

import urbanDuplexProfileDocument from "../../../../../public/collections/urban-duplex/product-profile.json";
import urbanDuplexSkuProfileDocument from "../../../../../public/collections/urban-duplex/sku-profile.json";

import configurator4 from "@/entities/collection/__tests__/fixtures/remote/configurator-4.json";
import { collectionSkuProfileSchema, parseProductProfile } from "@/entities/collection";
import type { ConfiguratorGroupCatalog } from "@/entities/collection/model/types";
import type { ConfiguratorAvailableOption } from "@/entities/configurator/api/types";

import { buildCollectionCabinetSku, type CollectionValueReader } from "../buildCollectionSkus";
import { createConfiguratorColorReader } from "../configuratorColors";

/**
 * Urban Duplex SKUs from its `sku-profile.json`. Each expected SKU is a row of the Pricing sheet of
 * the price workbook, or an example the client gave, as the builder writes it: `22H`, `15H` and `11H`
 * where the sheet writes `22.0H`, `15.0H` and `11.0H`, which the price server prices alike. The
 * handle element is HNDL, as the Pricing rows write it. The price server has not been asked for these.
 */

const parsed = parseProductProfile(urbanDuplexProfileDocument);
if (!parsed.ok) throw new Error("Urban Duplex profile failed validation");
const profile = parsed.profile;
const skuProfile = collectionSkuProfileSchema.parse(urbanDuplexSkuProfileDocument);

/** Cabinet colours of configurator 4 beyond the 3D ones the frozen fixture keeps, as the Master File names them. */
const CONFIGURATOR_4_CABINET_COLORS: readonly { value: string; sku: string; material: string }[] = [
  { value: "Bianco Calce DA ST", sku: "ST", material: "Soft-Touch" },
  { value: "Nero 03 ST", sku: "ST", material: "Soft-Touch" },
  { value: "Pulpis Chiaro TKH", sku: "HPL", material: "HPL" },
  { value: "Rovere Valdweg TKK", sku: "HPL", material: "HPL" },
  { value: "Metallizzato Copper M7 MT", sku: "LACM", material: "Lacquered MT" },
  { value: "Nero 03 MT", sku: "LACM", material: "Lacquered MT" },
  { value: "Blu Laguna A7 MT", sku: "LACM", material: "Lacquered MT" },
  { value: "Rosa Etoile 45 GL", sku: "LACG", material: "Lacquered GL" },
  { value: "Rovere Avena 06E", sku: "ESS", material: "Essenze" },
  { value: "Rovere Bianco 06A", sku: "ESS", material: "Essenze" },
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

/** The colours of the website's default model: a Soft-Touch base panel and an HPL lateral panel. */
const DEFAULT_PANELS = { BasePanelColor: "Bianco Calce DA ST", LateralPanelColor: "Pulpis Chiaro TKH" };

const cabinet = (values: Record<string, string>, widthCm: number, heightCm: number, depthCm = 50) =>
  buildCollectionCabinetSku(skuProfile, profile, {
    read: reader({ CabinetType: "Sink-Base", Series: "URDPX", Handle: "UG", ...DEFAULT_PANELS, ...values }),
    widthCm,
    heightCm,
    depthCm,
    readConfiguratorColor,
  });

describe("Urban Duplex cabinet SKU", () => {
  it("spells the side of the lateral panel after the cabinet style, and the three panel elements", () => {
    // VAN-URDPX-SB/2DWL/UG/X-27.6W-22.0H-19.7D-BASP-LACM-M7-LTLP-LACM-03-HNDL-LACM-03.
    expect(
      cabinet(
        {
          Drawers: "2",
          LateralPanelSide: "L",
          BasePanelColor: "Metallizzato Copper M7 MT",
          LateralPanelColor: "Nero 03 MT",
        },
        70,
        56,
      ),
    ).toEqual({ sku: "VAN-URDPX-SB/2DWL/UG/X-27.6W-22H-19.7D-BASP-LACM-M7-LTLP-LACM-03-HNDL-LACM-03", missing: [] });
  });

  it("spells each cabinet style at its heights, the handle groove in the lateral panel colour", () => {
    // VAN-URDPX-SB/1DWR/UG/X-23.6W-15.0H-19.7D-BASP-LACM-A7-LTLP-HPL-TKK-HNDL-HPL-TKK.
    expect(
      cabinet(
        {
          Drawers: "1",
          LateralPanelSide: "R",
          BasePanelColor: "Blu Laguna A7 MT",
          LateralPanelColor: "Rovere Valdweg TKK",
        },
        60,
        38,
      ).sku,
    ).toBe("VAN-URDPX-SB/1DWR/UG/X-23.6W-15H-19.7D-BASP-LACM-A7-LTLP-HPL-TKK-HNDL-HPL-TKK");
    // VAN-URDPX-SB/1DWIDL/UG/X-47.2W-20.9H-19.7D-BASP-ESS-06E-LTLP-ESS-06A-HNDL-ESS-06A.
    expect(
      cabinet(
        {
          Drawers: "1+inner",
          LateralPanelSide: "L",
          BasePanelColor: "Rovere Avena 06E",
          LateralPanelColor: "Rovere Bianco 06A",
        },
        120,
        53,
      ).sku,
    ).toBe("VAN-URDPX-SB/1DWIDL/UG/X-47.2W-20.9H-19.7D-BASP-ESS-06E-LTLP-ESS-06A-HNDL-ESS-06A");
    // VAN-URDPX-SC/1DWL/UG/X-27.6W-11.0H-18.1D-BASP-LACG-45-LTLP-ST-03-HNDL-ST-03.
    expect(
      cabinet(
        {
          CabinetType: "Sink-Cabinet",
          Drawers: "1",
          LateralPanelSide: "L",
          BasePanelColor: "Rosa Etoile 45 GL",
          LateralPanelColor: "Nero 03 ST",
        },
        70,
        28,
        46,
      ).sku,
    ).toBe("VAN-URDPX-SC/1DWL/UG/X-27.6W-11H-18.1D-BASP-LACG-45-LTLP-ST-03-HNDL-ST-03");
  });

  it("spells the default model's colours and reads the drawer spellings of the presets", () => {
    expect(cabinet({ Drawers: "2D", LateralPanelSide: "R" }, 70, 56).sku).toBe(
      "VAN-URDPX-SB/2DWR/UG/X-27.6W-22H-19.7D-BASP-ST-DA-LTLP-HPL-TKH-HNDL-HPL-TKH",
    );
    expect(cabinet({ Drawers: "1D", LateralPanelSide: "R" }, 90, 53).sku).toBe(
      "VAN-URDPX-SB/1DWR/UG/X-35.4W-20.9H-19.7D-BASP-ST-DA-LTLP-HPL-TKH-HNDL-HPL-TKH",
    );
  });

  it("writes X for a side not chosen, as for any code without a value", () => {
    expect(cabinet({ Drawers: "2" }, 60, 56).sku).toBe(
      "VAN-URDPX-SB/2DWX/UG/X-23.6W-22H-19.7D-BASP-ST-DA-LTLP-HPL-TKH-HNDL-HPL-TKH",
    );
  });
});

describe("the Urban Standard Height and Urban Low Height cabinets of an Urban Duplex model", () => {
  it("are spelled as those products spell them, in the base panel colour with the groove in the lateral one", () => {
    // VAN-URSTD-SC/2DW/UG/X-19.7W-22.0H-19.7D-CAB-ST-DA-HDL-HPL-TKH, a client example.
    expect(
      cabinet({ CabinetType: "Sink-Cabinet", Series: "URSTD", Drawers: "2", LateralPanelSide: "R" }, 50, 56),
    ).toEqual({ sku: "VAN-URSTD-SC/2DW/UG/X-19.7W-22H-19.7D-CAB-ST-DA-HDL-HPL-TKH", missing: [] });
    // VAN-URLH-SC/1DW/UG/X-13.8W-11.0H-19.7D-CAB-ST-DA-HDL-HPL-TKH, a client example.
    expect(cabinet({ CabinetType: "Sink-Cabinet", Series: "URLH", Drawers: "1D" }, 35, 28).sku).toBe(
      "VAN-URLH-SC/1DW/UG/X-13.8W-11H-19.7D-CAB-ST-DA-HDL-HPL-TKH",
    );
    expect(cabinet({ Series: "URSTD", Drawers: "2D" }, 105, 56).sku).toBe(
      "VAN-URSTD-SB/2DW/UG/X-41.3W-22H-19.7D-CAB-ST-DA-HDL-HPL-TKH",
    );
    expect(cabinet({ Series: "URLH", Drawers: "1D" }, 90, 38).sku).toBe(
      "VAN-URLH-SB/1DW/UG/X-35.4W-15H-19.7D-CAB-ST-DA-HDL-HPL-TKH",
    );
  });
});

describe("the Urban Duplex shelves", () => {
  it("spell the open shelf with two or one shelves by its height, in the base panel colour", () => {
    const openShelf = (widthCm: number, heightCm: number, depthCm = 50) =>
      cabinet({ CabinetType: "Open-Shelf" }, widthCm, heightCm, depthCm).sku;

    // VAN-UROS-2S-35W-56H-50D, VAN-UROS-2S-25W-53H-50D, VAN-UROS-1S-25W-38H-46D and VAN-UROS-1S-35W-28H-50D.
    expect(openShelf(35, 56)).toBe("VAN-UROS-2S-13.8W-22H-19.7D-CAB-ST-DA");
    expect(openShelf(25, 53)).toBe("VAN-UROS-2S-9.8W-20.9H-19.7D-CAB-ST-DA");
    expect(openShelf(25, 38, 46)).toBe("VAN-UROS-1S-9.8W-15H-18.1D-CAB-ST-DA");
    expect(openShelf(35, 28)).toBe("VAN-UROS-1S-13.8W-11H-19.7D-CAB-ST-DA");
  });

  it("spell the open side shelf with its end and the Pricing height, in the lateral panel colour", () => {
    const sideShelf = (side: string, heightCm: number, depthCm = 50) =>
      cabinet({ CabinetType: "Side-Shelf", OpenSideShelfSide: side }, 15, heightCm, depthCm).sku;

    // VAN-UROSS-L-15W-56H-50D and VAN-UROSS-R-15W-28H-46D: the price server takes 22H for a 19.7H shelf.
    expect(sideShelf("L", 56)).toBe("VAN-UROSS-L-5.9W-22.0H-19.7D-CAB-HPL-TKH");
    expect(sideShelf("R", 53)).toBe("VAN-UROSS-R-5.9W-20.9H-19.7D-CAB-HPL-TKH");
    expect(sideShelf("R", 28, 46)).toBe("VAN-UROSS-R-5.9W-11.0H-18.1D-CAB-HPL-TKH");
  });

  it("keep their own series whatever series a model's first cabinet lends them", () => {
    expect(cabinet({ CabinetType: "Open-Shelf", Series: "URSTD" }, 35, 56).sku).toBe(
      "VAN-UROS-2S-13.8W-22H-19.7D-CAB-ST-DA",
    );
    expect(cabinet({ CabinetType: "Side-Shelf", Series: "URLH", OpenSideShelfSide: "L" }, 15, 38).sku).toBe(
      "VAN-UROSS-L-5.9W-15.0H-19.7D-CAB-HPL-TKH",
    );
  });
});
