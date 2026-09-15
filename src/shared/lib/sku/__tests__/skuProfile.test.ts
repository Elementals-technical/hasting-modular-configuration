import { beforeEach, describe, expect, it, vi } from "vitest";

import ushCabinetSkuMappings from "../../../../../public/collections/urban-standard-height/cabinet-sku-mappings.json";

import { createSkuBuilders } from "../createSkuBuilders";
import { resolveSkuProfile } from "../resolveSkuProfile";
import { ushSkuProfile } from "./ushSkuProfileFixture";

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

describe("resolveSkuProfile", () => {
  it("resolves USH with its series and the mappings the collection ships", () => {
    expect(ushSkuProfile.collectionId).toBe("urban-standard-height");
    expect(ushSkuProfile.series).toMatchObject({ cabinet: "URSTD", countertopPrefix: "UR", fallback: "X" });
    expect(ushSkuProfile.cabinetMappings).toEqual(ushCabinetSkuMappings);
    expect(ushSkuProfile.cabinetMappings.handle).toEqual({
      handle_urban_topcut: "UG",
      handle_urban_botcut: "CG",
      handle_pto: "PTO",
    });
  });

  it("says why a collection has no SKUs instead of borrowing the USH series", () => {
    expect(resolveSkuProfile(null)).toEqual({ status: "unsupported", collectionId: null, reason: "no-collection" });
    expect(resolveSkuProfile({ id: "mako", cabinetSkuMappings: ushCabinetSkuMappings })).toEqual({
      status: "unsupported",
      collectionId: "mako",
      reason: "no-sku-series",
    });
    expect(resolveSkuProfile({ id: "urban-standard-height" })).toEqual({
      status: "unsupported",
      collectionId: "urban-standard-height",
      reason: "no-cabinet-mappings",
    });
  });
});

describe("createSkuBuilders", () => {
  const cabinet = {
    cabinetType: "Sink-Base",
    drawers: "1D",
    handle: "handle_urban_topcut",
    pattern: null,
    width: 60,
    height: 53,
    depth: 50.5,
    cab: { materialSku: "3D", colorCode: "1C2" },
    hdl: null,
    msp: null,
    bkpl: null,
  };
  const countertop = {
    style: "integrated",
    width: 60,
    depth: 50.5,
    thickness: "0.5",
    basinType: "Top_Tekorlux_Rectangular",
    faucetHolesAmount: "1",
    countertopMaterialSku: "SSTKR",
    countertopColorCode: "FF",
  };

  const buildAll = (builders: ReturnType<typeof createSkuBuilders>) => [
    builders.buildProductSku(cabinet),
    builders.buildProductBaseSku(cabinet),
    builders.buildOpenShelfSku({
      width: 35,
      height: 56,
      depth: 50,
      cabinetMaterialSku: "LACM",
      cabinetColorCode: "TKH",
    }),
    builders.buildOpenSideShelfSku({
      side: "R",
      width: 15,
      height: 50,
      depth: 46,
      cabinetMaterialSku: "HPL",
      cabinetColorCode: "FE",
    }),
    builders.buildSidePanelSku({ panelType: "UpperG", width: 1, height: 53, depth: 50, cabMaterialSku: "LACM" }),
    builders.buildDividerSku({ dividerStyle: "Option A", cabinetDepth: 50 }),
    builders.buildTowelBarSku({ side: "L", width: 40, height: 3.5, depth: 5, materialSku: "LACM", colorCode: "43 MT" }),
    builders.buildBookMatchingSku({ direction: "V", materialSku: "HPL" }),
    builders.buildCountertopSku(countertop),
    builders.buildCountertopSkuIfComplete(countertop),
    builders.buildVesselSku({
      vesselType: "Vessel_Blade11",
      width: 50,
      height: 15,
      depth: 46,
      materialSku: "CER",
      colorCode: "OCB",
    }),
  ];

  it("builds the USH SKUs through the collection's profile", () => {
    const builders = createSkuBuilders(
      resolveSkuProfile({ id: "urban-standard-height", cabinetSkuMappings: ushCabinetSkuMappings }),
    );

    expect(builders).toMatchObject({ status: "ready", reason: null, profile: ushSkuProfile });
    expect(builders.buildProductSku(cabinet)).toBe("VAN-URSTD-SB/1DW/UG/X-23.6W-20.9H-19.7D-CAB-3D-1C2");
  });

  it("builds nothing, and no USH series, for a collection without an SKU profile", () => {
    const builders = createSkuBuilders(resolveSkuProfile({ id: "mako", cabinetSkuMappings: ushCabinetSkuMappings }));
    const built = buildAll(builders);

    expect(builders).toMatchObject({ status: "unsupported", reason: "no-sku-series", profile: null });
    expect(built).toEqual(["", "", "", "", null, null, null, "", [], [], ""]);
    expect(JSON.stringify(built)).not.toContain("UR");
  });
});
