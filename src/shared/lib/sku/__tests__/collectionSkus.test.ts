import { describe, expect, it } from "vitest";

import { CLASS, MAKO } from "@/shared/lib/pricing/__tests__/fixtures/collectionPricingScenarios";

import {
  buildCollectionCabinetSku,
  buildCollectionCountertopSkus,
  resolveCollectionDividerSku,
  type CollectionValueReader,
} from "../buildCollectionSkus";

/**
 * Class and Mako SKUs from their `sku-profile.json` (D04). Each expected SKU is a form the
 * collection's price workbook names (SKU Curation, CabinetPricing, CountertopPricing, Basin
 * StylePricing, AccessoriesPricing) and the price server resolved on 2026-09-18.
 */

const reader =
  (values: Record<string, string>): CollectionValueReader =>
  (attributeId) =>
    values[attributeId] ?? null;

const classCabinet = (values: Record<string, string>, widthCm = 60, heightCm = 52) =>
  buildCollectionCabinetSku(CLASS.skuProfile, CLASS.profile, {
    read: reader({ CabinetType: "Sink-Base", Drawers: "2", ...values }),
    widthCm,
    heightCm,
    depthCm: 52,
  });

const makoCabinet = (values: Record<string, string>, widthCm = 60, heightCm = 52) =>
  buildCollectionCabinetSku(MAKO.skuProfile, MAKO.profile, {
    read: reader({ CabinetType: "Sink-Base", Drawers: "2", Handle: "G57", ...values }),
    widthCm,
    heightCm,
    depthCm: 52,
  });

describe("Class cabinet SKU", () => {
  it("prices a black frame as /B", () => {
    expect(
      classCabinet({ CabinetColor: "Nero 433 MT", CabinetSideColor: "Nero 433 MT", FrameColor: "Nero 433 MT" }),
    ).toEqual({ sku: "VAN-CLSV-SB/2DW-23.6W-20.5H-20.5D-CABF-LACM/B-433-CABS-LACM-433-FRM-LACM-433", missing: [] });
  });

  it("prices any other frame colour as /C, with the material of the front", () => {
    expect(
      classCabinet({
        CabinetColor: "CALACATTA BLACK 338",
        CabinetSideColor: "Nativo Cotto 961",
        FrameColor: "Turchese 410 MT",
      }).sku,
    ).toBe("VAN-CLSV-SB/2DW-23.6W-20.5H-20.5D-CABF-POR/C-338-CABS-LAM-961-FRM-LACM-410");
  });

  it("spells the smoke glass front with its SG code, and 1+inner as 1DWID at 40 cm", () => {
    expect(
      classCabinet(
        { Drawers: "1+inner", CabinetColor: "Fume", CabinetSideColor: "Nero 433 MT", FrameColor: "Nero 433 MT" },
        100,
        40,
      ).sku,
    ).toBe("VAN-CLSV-SB/1DWID-39.4W-15.7H-20.5D-CABF-SGLS/B-SG-CABS-LACM-433-FRM-LACM-433");
  });

  it("reads glass colours through their G-prefixed values", () => {
    expect(classCabinet({ CabinetColor: "GGrigio Argento 403 GL", FrameColor: "Nero 433 MT" }).sku).toBe(
      "VAN-CLSV-SB/2DW-23.6W-20.5H-20.5D-CABF-GLSG/B-403-FRM-LACM-433",
    );
  });

  it("reports a missing frame colour, which would otherwise price the default frame", () => {
    expect(classCabinet({ CabinetColor: "Nero 433 MT" })).toEqual({
      sku: "VAN-CLSV-SB/2DW-23.6W-20.5H-20.5D-CABF-LACM-433",
      missing: ["FrameColor"],
    });
  });
});

describe("Mako cabinet SKU", () => {
  it("carries the handle in the model and the handle finish as HDL", () => {
    expect(makoCabinet({ CabinetColor: "Zafferano 412 MT", HandleColor: "Silver" }).sku).toBe(
      "VAN-MAKOV-SB/2DW/G57-23.6W-20.5H-20.5D-CAB-LACM-412-HDL-MTL-SLV",
    );
  });

  it("builds a one-drawer side cabinet with G50 at 26 cm", () => {
    expect(
      makoCabinet(
        { CabinetType: "Sink-Cabinet", Drawers: "1", Handle: "G50", CabinetColor: "Grigio Argento 403 GL" },
        80,
        26,
      ).sku,
    ).toBe("VAN-MAKOV-SC/1DW/G50-31.5W-10.2H-20.5D-CAB-LACG-403");
  });

  it("reads the legacy drawer spelling through the profile aliases", () => {
    expect(makoCabinet({ Drawers: "2D", CabinetColor: "Nero 433 MT" }).sku).toBe(
      "VAN-MAKOV-SB/2DW/G57-23.6W-20.5H-20.5D-CAB-LACM-433",
    );
  });
});

describe("countertop SKUs", () => {
  const countertop = (collection: typeof CLASS, input: Partial<Parameters<typeof buildCollectionCountertopSkus>[2]>) =>
    buildCollectionCountertopSkus(collection.skuProfile, collection.profile, {
      style: "integrated",
      color: null,
      basins: [],
      widthCm: 120,
      faucetHoles: null,
      ...input,
    });

  it("prices an HPL top with its basin and faucet holes", () => {
    expect(countertop(CLASS, { color: "CALACATTA 259", basins: ["VA024"], faucetHoles: "1" })).toEqual({
      material: "HPL",
      thickness: ".5",
      top: "CT-GBHPL-INTG-47.2W-.5H-20.7D-HPL-259",
      basins: ["CT-GBHPL-VA024-.5H"],
      holeCut: null,
      faucetHoles: "CT-GBHPL-FAHO/1",
      bracket: null,
    });
  });

  it("gives Porcelain its .8 token and each sink base its own basin", () => {
    const skus = countertop(MAKO, { color: "ARDESIA NERA 328", basins: ["LV890", "LV892"], widthCm: 160 });

    expect(skus.top).toBe("CT-GBPOR-INTG-63W-.8H-20.7D-POR-328");
    expect(skus.basins).toEqual(["CT-GBPOR-LV890-.8H", "CT-GBPOR-LV892-.8H"]);
  });

  it("cuts a vessel top per sink base and has no basin SKU", () => {
    const skus = countertop(MAKO, { style: "vessel", color: "Matte White", basins: ["Iris"] });

    expect(skus.top).toBe("CT-GBSSTL-VES-47.2W-.5H-20.7D");
    expect(skus.basins).toEqual([null]);
    expect(skus.holeCut).toBe("CT-GBSSTL-HCUT");
  });

  it("lets a basin decide the Solid Surface group", () => {
    expect(countertop(MAKO, { color: "Matte White", basins: ["VA030"] }).basins).toEqual(["CT-GBSSTEX-VA030-.5H"]);
  });

  it("prices the thick Technomat top of VA023 with two brackets", () => {
    const skus = countertop(CLASS, { color: "Matte White", basins: ["VA023"] });

    expect(skus.top).toBe("CT-GBSSTMT-INTG-47.2W-3.1H-20.7D");
    expect(skus.basins).toEqual(["CT-GBSSTMT-VA023-3.1H"]);
    expect(skus.bracket).toEqual({ sku: "CT-GB-BRKT", quantity: 2 });
  });

  it("builds nothing it cannot price: no material, no style or no width", () => {
    expect(countertop(CLASS, { color: null }).top).toBeNull();
    expect(countertop(CLASS, { color: "CALACATTA 259", style: null }).top).toBeNull();
    expect(countertop(CLASS, { color: "CALACATTA 259", widthCm: null }).top).toBeNull();
  });
});

describe("organizer SKUs", () => {
  it("has one SKU per divider style", () => {
    expect(resolveCollectionDividerSku(MAKO.skuProfile, "Metal")).toBe("VAN-GBDIV-MTL-3.9W-2H-16.9D");
    expect(resolveCollectionDividerSku(CLASS.skuProfile, "Oak")).toBe("VAN-GBDIV-OAK-3.8W-2.6H-16.9D");
    expect(resolveCollectionDividerSku(CLASS.skuProfile, "A")).toBeNull();
  });
});
