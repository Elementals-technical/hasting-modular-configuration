import { describe, expect, it } from "vitest";

import lameProfileDocument from "../../../../../public/collections/lame/product-profile.json";
import lameSkuProfileDocument from "../../../../../public/collections/lame/sku-profile.json";

import configurator14Document from "@/entities/collection/__tests__/fixtures/remote/configurator-14.json";
import {
  collectionSkuProfileSchema,
  configuratorSchema,
  hasOwnCountertop,
  parseProductProfile,
  type ConfiguratorGroupCatalog,
} from "@/entities/collection";

import {
  buildCollectionCabinetSku,
  buildCollectionCountertopSkus,
  buildCollectionLegCapSku,
  buildCollectionLegsSku,
  buildCollectionUndertopSku,
  resolveCollectionDividerSku,
  resolveCollectionVessel,
  type CollectionCountertopSkuInput,
  type CollectionValueReader,
} from "../buildCollectionSkus";
import { createConfiguratorColorReader } from "../configuratorColors";

/**
 * Lame SKUs from its `sku-profile.json`. Each expected SKU is a form of the Lame price workbook (SKU
 * Structure, CabinetPricing) or, for the countertop, its basins, the cutout, the faucet holes and the
 * organizers, of the Class workbook the Lame one refers to. On 2026-10-20 the price server answered every
 * cabinet form of CabinetPricing (5 patterns, LACM and LACG) with its workbook price, and the undertop
 * forms per cm ($7.28 metal, $9.25 lacquer).
 */

const parsed = parseProductProfile(lameProfileDocument);
if (!parsed.ok) throw new Error("Lame profile failed validation");
const profile = parsed.profile;
const skuProfile = collectionSkuProfileSchema.parse(lameSkuProfileDocument);

const configurator14 = configuratorSchema.parse(configurator14Document);
const configurator: ConfiguratorGroupCatalog = {
  groups: configurator14.availableOptions,
  groupsByName: Object.fromEntries(configurator14.availableOptions.map((group) => [group.proxyName, group])),
};
const readConfiguratorColor = createConfiguratorColorReader(profile, configurator);

const reader =
  (values: Record<string, string>): CollectionValueReader =>
  (attributeId) =>
    values[attributeId] ?? null;

const cabinet = (values: Record<string, string>, widthCm = 60, heightCm = 52) =>
  buildCollectionCabinetSku(skuProfile, profile, {
    read: reader({ CabinetType: "Sink-Base", Drawers: "2", Handle: "G58", CabinetPattern: "Oxford", ...values }),
    widthCm,
    heightCm,
    depthCm: 52,
    readConfiguratorColor,
  });

describe("Lame cabinet SKU", () => {
  it("spells the example of the price workbook: the pattern in the model, both finishes as elements", () => {
    expect(cabinet({ CabinetColor: "Latte 417 MT", HandleColor: "Nero 433 MT" })).toEqual({
      sku: "VAN-LAMEV-SB/2DW/G58/OXF-23.6W-20.5H-20.5D-CAB-LACM-417-HDL-LACM-433",
      missing: [],
    });
  });

  it.each([
    [{ Drawers: "2", CabinetPattern: "Oxford" }, 120, 52, "VAN-LAMEV-SB/2DW/G58/OXF-47.2W-20.5H-20.5D"],
    [{ Drawers: "1", CabinetPattern: "Plisse" }, 80, 26, "VAN-LAMEV-SB/1DW/G58/PLIS-31.5W-10.2H-20.5D"],
    [
      { CabinetType: "Sink-Cabinet", Drawers: "2", CabinetPattern: "Gessato" },
      40,
      52,
      "VAN-LAMEV-SC/2DW/G58/GES-15.7W-20.5H-20.5D",
    ],
    [
      { CabinetType: "Sink-Cabinet", Drawers: "1", CabinetPattern: "Galles" },
      100,
      26,
      "VAN-LAMEV-SC/1DW/G58/GAL-39.4W-10.2H-20.5D",
    ],
    [
      { CabinetType: "Sink-Cabinet", Drawers: "1D", CabinetPattern: "Piquet" },
      120,
      26,
      "VAN-LAMEV-SC/1DW/G58/PIQ-47.2W-10.2H-20.5D",
    ],
    // The scene's spelling of Gessato, as a saved scene config carries it.
    [
      { CabinetType: "Sink-Cabinet", Drawers: "2", CabinetPattern: "Gessatto" },
      60,
      52,
      "VAN-LAMEV-SC/2DW/G58/GES-23.6W-20.5H-20.5D",
    ],
  ])("spells the CabinetPricing row of %o at %i x %i cm", (values, widthCm, heightCm, sku) => {
    // A cabinet is priced only with both finishes (requireCompleteInput); the row is the SKU before them.
    const finishes = { CabinetColor: "Antracite 400 MT", HandleColor: "Antracite 400 MT" };
    expect(cabinet({ ...finishes, ...values }, widthCm, heightCm).sku).toBe(`${sku}-CAB-LACM-400-HDL-LACM-400`);
  });

  it("spells no SKU before the scene reports a size, for a size table 596 lacks or without a finish", () => {
    const finishes = { CabinetColor: "Antracite 400 MT", HandleColor: "Antracite 400 MT" };
    // The sizes are read from the scene a moment after a cabinet is placed: no XW-XH-XD SKU meanwhile.
    expect(
      buildCollectionCabinetSku(skuProfile, profile, {
        read: reader({ CabinetType: "Sink-Base", Drawers: "1", Handle: "G58", CabinetPattern: "Oxford", ...finishes }),
        widthCm: null,
        heightCm: null,
        depthCm: null,
        readConfiguratorColor,
      }),
    ).toEqual({
      sku: "",
      missing: [
        { attributeId: "Width", cause: "invalid-dimension" },
        { attributeId: "Height", cause: "invalid-dimension" },
        { attributeId: "Depth", cause: "invalid-dimension" },
      ],
    });
    // A Sink Base is 60 cm wide at least, a cabinet 26 or 52 cm high.
    expect(cabinet(finishes, 40).sku).toBe("");
    expect(cabinet(finishes, 60, 40).sku).toBe("");
    expect(cabinet({ HandleColor: "Antracite 400 MT" }).missing).toEqual([
      { attributeId: "CabinetColor", cause: "not-chosen" },
    ]);
  });

  it("spells a gloss cabinet as LACG and a metal handle with its colour code", () => {
    expect(cabinet({ CabinetColor: "Zaffiro 411 GL", HandleColor: "Gold" }).sku).toBe(
      "VAN-LAMEV-SB/2DW/G58/OXF-23.6W-20.5H-20.5D-CAB-LACG-411-HDL-MTL-GLD",
    );
    expect(cabinet({ CabinetColor: "Zaffiro 411 GL", HandleColor: "Silver" }).sku).toBe(
      "VAN-LAMEV-SB/2DW/G58/OXF-23.6W-20.5H-20.5D-CAB-LACG-411-HDL-MTL-SLV",
    );
  });
});

describe("Lame countertop SKUs", () => {
  if (!hasOwnCountertop(skuProfile)) throw new Error("Lame spells its countertop itself");
  const ownCountertop = skuProfile;

  const countertop = (input: Partial<CollectionCountertopSkuInput>) =>
    buildCollectionCountertopSkus(ownCountertop, profile, {
      style: "integrated",
      color: null,
      thickness: null,
      basins: [],
      widthCm: 120,
      faucetHoles: null,
      readConfiguratorColor,
      ...input,
    });

  it("prices a thin HPL top with its basin and faucet holes", () => {
    expect(countertop({ color: "CALACATTA 259", basins: ["VA024"], faucetHoles: "1" })).toEqual({
      material: "HPL",
      thickness: ".5",
      top: "CT-GBHPL-INTG-47.2W-.5H-20.7D-HPL-259",
      basins: ["CT-GBHPL-VA024-.5H"],
      holeCut: null,
      isVessel: false,
      faucetHoles: "CT-GBHPL-FAHO/1",
      bracket: null,
    });
  });

  it("gives Porcelain its .8 token and each sink base its own basin", () => {
    const skus = countertop({ color: "CALACATTA BLACK 338", basins: ["LV890", "LV892"], widthCm: 160 });

    expect(skus.top).toBe("CT-GBPOR-INTG-63W-.8H-20.7D-POR-338");
    expect(skus.basins).toEqual(["CT-GBPOR-LV890-.8H", "CT-GBPOR-LV892-.8H"]);
    expect(skus.bracket).toBeNull();
  });

  it("prices matte glass by its own group", () => {
    const skus = countertop({ color: "Antracite 400 MT", basins: ["VA002"] });

    expect(skus.top).toBe("CT-GBGLSM-INTG-47.2W-.5H-20.7D-GLSM-400");
    expect(skus.basins).toEqual(["CT-GBGLSM-VA002-.5H"]);
  });

  it("prices Matte White as SS Technolite, unless VA030 makes it SS Texturizzato", () => {
    expect(countertop({ color: "Matte White", basins: ["LB440"] }).basins).toEqual(["CT-GBSSTL-LB440-.5H"]);
    expect(countertop({ color: "Matte White", basins: ["VA030"] }).basins).toEqual(["CT-GBSSTEX-VA030-.5H"]);
  });

  it("cuts a vessel top per sink base and has no basin SKU", () => {
    const skus = countertop({ style: "vessel", color: "Matte White", basins: ["Plaza"] });

    expect(skus.top).toBe("CT-GBSSTL-VES-47.2W-.5H-20.7D");
    expect(skus.basins).toEqual([null]);
    expect(skus.holeCut).toBe("CT-GBSSTL-HCUT");
  });
});

describe("Lame vessel and organizer SKUs", () => {
  it.each([
    ["Iris", "Latte 417 MT", "VES-IRIS-X-16.5W-4.3H-16.5D-LACM-417"],
    ["Frame", "Antracite 400 MT", "VES-FRM-X-19.7W-4.3H-13.8D-LACM-400"],
    ["Plaza", "Zaffiro 411 GL", "VES-PLZ-X-23.6W-4.7H-18.9D-LACG-411"],
  ])("spells %s in %s", (basin, color, sku) => {
    expect(resolveCollectionVessel(skuProfile, profile, { basin, color, readConfiguratorColor })?.sku).toBe(sku);
  });

  it("has the Class organizers", () => {
    expect(resolveCollectionDividerSku(skuProfile, "Metal")).toBe("VAN-GBDIV-MTL-3.9W-2H-16.9D");
    expect(resolveCollectionDividerSku(skuProfile, "Oak")).toBe("VAN-GBDIV-OAK-3.8W-2.6H-16.9D");
  });
});

// Lame CountertopPricing: CT-GB{MTL|LACM}-UDTP-W-.7H-20.5D, priced per cm of the composition.
describe("Lame undertop SKU", () => {
  const undertop = (value: string | null, fallbackColor: string | null = "Nero 433 MT", widthCm: number | null = 120) =>
    buildCollectionUndertopSku(skuProfile, profile, { value, fallbackColor, widthCm, readConfiguratorColor });

  it.each([
    ["Gold", "CT-GBMTL-UDTP-47.2W-.7H-20.5D-MTL-GLD"],
    ["Silver", "CT-GBMTL-UDTP-47.2W-.7H-20.5D-MTL-SLV"],
    ["Seta 406 MT", "CT-GBLACM-UDTP-47.2W-.7H-20.5D-LACM-406"],
  ])("spells an undertop in %s along the composition", (value, sku) => {
    expect(undertop(value)).toBe(sku);
  });

  it("spells one without a colour of its own in the handle colour, as the scene paints it", () => {
    expect(undertop("None", "Gold")).toBe("CT-GBMTL-UDTP-47.2W-.7H-20.5D-MTL-GLD");
    expect(undertop("None", "Nero 433 MT", 160)).toBe("CT-GBLACM-UDTP-63W-.7H-20.5D-LACM-433");
  });

  it("orders none while it is off, or before the composition has a width", () => {
    expect(undertop("")).toBeNull();
    expect(undertop(null)).toBeNull();
    expect(undertop("Gold", "Gold", null)).toBeNull();
  });
});

describe("Lame legs and cap SKUs", () => {
  const legs = (color: string, drawers: string | null) =>
    buildCollectionLegsSku(skuProfile, profile, { color, attributeId: "CabinetColor", drawers, readConfiguratorColor });
  const cap = (value: string | null, fallbackColor: string | null = "Nero 433 MT") =>
    buildCollectionLegCapSku(skuProfile, profile, { value, fallbackColor, readConfiguratorColor });

  it.each([
    ["Antracite 400 MT", "1", "VAN-LAMEV-LEG/1DW-22.6H-CAB-LACM-400"],
    ["Zaffiro 411 GL", "1D", "VAN-LAMEV-LEG/1DW-22.6H-CAB-LACG-411"],
    ["Latte 417 MT", "2", "VAN-LAMEV-LEG/2DW-12.4H-CAB-LACM-417"],
    ["Zaffiro 411 GL", "2DW", "VAN-LAMEV-LEG/2DW-12.4H-CAB-LACG-411"],
  ])(
    "spells the leg under %s cabinets with Drawers %s as its CabinetPricing row, in their finish",
    (color, drawers, sku) => {
      expect(legs(color, drawers)).toBe(sku);
    },
  );

  it("spells no leg for a drawer style the workbook has none for", () => {
    expect(legs("Antracite 400 MT", null)).toBeNull();
    expect(legs("Antracite 400 MT", "3")).toBeNull();
  });

  it("spells the cap in its own colour, or in the handle colour while none is chosen, as the scene paints it", () => {
    expect(cap("Gold")).toBe("VAN-LAMEV-LEGCAP-MTL-GLD");
    expect(cap("Silver")).toBe("VAN-LAMEV-LEGCAP-MTL-SLV");
    expect(cap("Seta 406 MT")).toBe("VAN-LAMEV-LEGCAP-LACM-406");
    expect(cap("None")).toBe("VAN-LAMEV-LEGCAP-LACM-433");
    expect(cap("None", "Gold")).toBe("VAN-LAMEV-LEGCAP-MTL-GLD");
  });

  it("spells no cap while the legs are off", () => {
    expect(cap("")).toBeNull();
    expect(cap(null)).toBeNull();
  });
});
