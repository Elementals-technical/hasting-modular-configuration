import { beforeEach, describe, expect, it, vi } from "vitest";

import { convertSkuToInchesForSummary } from "@/shared/lib/summaryFormatters";

import {
  buildBookMatchingSku,
  buildCountertopSku,
  buildDividerSku,
  buildOpenShelfSku,
  buildOpenSideShelfSku,
  buildProductBaseSku,
  buildProductSku,
  buildSidePanelSku,
  buildTowelBarSku,
  buildVesselSku,
} from "..";
import { buildCabinetSku } from "../buildCabinetSku";
import { ushSkuProfile } from "./ushSkuProfileFixture";

/**
 * The SKUs USH builds today, fixed before the builders read a collection profile (D01).
 *
 * The strings were captured from the builders as they stood before the profile existed,
 * including the "X" fallbacks, so moving the series and mappings into the profile must not
 * change a single character of a USH SKU.
 */

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

describe("USH SKU parity", () => {
  it("cabinets", () => {
    expect({
      withMaterialsAndGrain: buildProductSku(ushSkuProfile, {
        cabinetType: "Sink-Base",
        drawers: "1D",
        handle: "handle_urban_topcut",
        pattern: null,
        width: 60,
        height: 53,
        depth: 50.5,
        cab: { materialSku: "3D", colorCode: "1C2", grainDirection: "H" },
        hdl: { materialSku: "LACG", colorCode: "77" },
        msp: null,
        bkpl: null,
      }),
      flutedFromRuntimeId: buildProductSku(ushSkuProfile, {
        cabinetType: "SinkBase60-runtime",
        drawers: "2D",
        handle: "handle_pto",
        pattern: "FlutingVerticalA",
        width: 70,
        height: 56,
        depth: 46,
        cab: { materialSku: "LACM", colorCode: "TKH" },
        hdl: null,
        msp: null,
        bkpl: null,
      }),
      alreadyACode: buildProductBaseSku(ushSkuProfile, {
        cabinetType: "SC",
        drawers: "1DWID",
        handle: "handle_urban_botcut",
        pattern: "None",
        width: 80,
        height: 50,
        depth: 50,
        cab: null,
        hdl: null,
        msp: null,
        bkpl: null,
      }),
      fallbacks: buildProductSku(ushSkuProfile, {
        cabinetType: "Mystery-Cabinet",
        drawers: null,
        handle: "handle_unknown",
        pattern: "Unknown",
        width: null,
        height: null,
        depth: null,
        cab: null,
        hdl: null,
        msp: null,
        bkpl: null,
      }),
      legacyCabinet: buildCabinetSku(ushSkuProfile, {
        cabinetType: "Sink-Cabinet",
        drawers: "1DWID",
        handle: "handle_urban_botcut",
        pattern: "FlutingHorizontalB",
        width: 80,
        height: 53,
        depth: 46,
        sidePanel: "UpperG",
        divider: "Option B",
        towelBar: "Left",
        cabinetMaterialSku: "HPL",
      }),
      legacyCabinetFallbacks: buildCabinetSku(ushSkuProfile, {
        cabinetType: null,
        drawers: null,
        handle: null,
        pattern: null,
        width: null,
        height: null,
        depth: null,
        sidePanel: "None",
        divider: null,
        towelBar: "None",
        cabinetMaterialSku: null,
      }),
    }).toMatchInlineSnapshot(`
      {
        "alreadyACode": "VAN-URSTD-SC/1DWID/CG/X-31.5W-19.7H-19.7D",
        "fallbacks": "VAN-URSTD-X/X/X/X-X-X-X",
        "flutedFromRuntimeId": "VAN-URSTD-SB/2DW/PTO/CVA-27.6W-22H-18.1D-CAB-LACM-TKH",
        "legacyCabinet": "VAN-URSTD-SC/1DWID/CG/CHB-80W-53H-46D-UPG-DVB-TBL-CAB-HPL",
        "legacyCabinetFallbacks": "VAN-URSTD-X/X/X/X-XW-XH-XD",
        "withMaterialsAndGrain": "VAN-URSTD-SB/1DW/UG/X-23.6W-20.9H-19.7D-CAB-3D-1C2/H-HDL-LACG-77",
      }
    `);
  });

  it("shelves, side panels, dividers, towel bars and book matching", () => {
    expect({
      openShelf: buildOpenShelfSku(ushSkuProfile, {
        width: 35,
        height: 56,
        depth: 50,
        cabinetMaterialSku: "LACM",
        cabinetColorCode: "TKH",
        grainDirection: "V",
      }),
      openShelfWithoutMaterial: buildOpenShelfSku(ushSkuProfile, {
        width: null,
        height: 53,
        depth: 46,
        cabinetMaterialSku: null,
        cabinetColorCode: null,
      }),
      openSideShelf: buildOpenSideShelfSku(ushSkuProfile, {
        side: "L",
        width: 15,
        height: 50,
        depth: 50,
        cabinetMaterialSku: "HPL",
        cabinetColorCode: "FE",
      }),
      sidePanelGrooved: buildSidePanelSku(ushSkuProfile, {
        panelType: "UpperG",
        width: 1,
        height: 53,
        depth: 50,
        cabMaterialSku: "LACM",
        cabColorCode: "90",
        hdlMaterialSku: "LACM",
        hdlColorCode: "DD",
      }),
      sidePanelPlain: buildSidePanelSku(ushSkuProfile, {
        panelType: "NoG",
        width: 1,
        height: 56,
        depth: 46,
        cabMaterialSku: "HPL",
      }),
      sidePanelNone: buildSidePanelSku(ushSkuProfile, { panelType: "None", width: 1, height: 56, depth: 46 }),
      dividerA: buildDividerSku(ushSkuProfile, { dividerStyle: "Option A", cabinetDepth: 50.5 }),
      dividerC: buildDividerSku(ushSkuProfile, { dividerStyle: "Option C", cabinetDepth: 46 }),
      dividerNone: buildDividerSku(ushSkuProfile, { dividerStyle: "None", cabinetDepth: 50 }),
      towelBarRight: buildTowelBarSku(ushSkuProfile, {
        side: "R",
        width: 40,
        height: 3.5,
        depth: 5,
        materialSku: "LACM",
        colorCode: "Carbone 43 MT",
      }),
      towelBarLeftWithoutColor: buildTowelBarSku(ushSkuProfile, {
        side: "L",
        width: 40,
        height: 3.5,
        depth: 5,
        materialSku: "LACM",
        colorCode: null,
      }),
      towelBarWithoutMaterial: buildTowelBarSku(ushSkuProfile, {
        side: "L",
        width: 40,
        height: 3.5,
        depth: 5,
        materialSku: null,
        colorCode: "43 MT",
      }),
      bookMatchingHorizontal: buildBookMatchingSku(ushSkuProfile, { direction: "H" }),
      bookMatchingVertical: buildBookMatchingSku(ushSkuProfile, { direction: "V", materialSku: "HPL" }),
    }).toMatchInlineSnapshot(`
      {
        "bookMatchingHorizontal": "VAN-URBMG-HOR",
        "bookMatchingVertical": "VAN-URBMG-VER-HPL",
        "dividerA": "VAN-URDIV-A-5.3W-2.4H-15D",
        "dividerC": "VAN-URDIV-C-8.7W-2.4H-13D",
        "dividerNone": null,
        "openShelf": "VAN-UROS-2S-13.8W-22H-19.7D-CAB-LACM-TKH/V",
        "openShelfWithoutMaterial": "VAN-UROS-2S-XW-20.9H-18.1D",
        "openSideShelf": "VAN-UROSS-L-5.9W-19.7H-19.7D-CAB-HPL-FE",
        "sidePanelGrooved": "VAN-URSP-1GU-.4W-20.9H-19.7D-CAB-LACM-90-HDL-LACM-DD",
        "sidePanelNone": null,
        "sidePanelPlain": "VAN-URSP-0G-.4W-22H-17.9D-CAB-HPL",
        "towelBarLeftWithoutColor": "VAN-URTWLBR-STB/L-15.7W-1.4H-2D-LACM",
        "towelBarRight": "VAN-URTWLBR-STB/R-15.7W-1.4H-2D-LACM-43 MT",
        "towelBarWithoutMaterial": null,
      }
    `);
  });

  it("countertops, basins and vessels", () => {
    expect({
      integrated: buildCountertopSku(ushSkuProfile, {
        style: "integrated",
        width: 60,
        depth: 50.5,
        thickness: "0.5",
        basinType: "Top_Tekorlux_Rectangular",
        faucetHolesAmount: "0",
        countertopMaterialSku: "SSTKR",
        countertopColorCode: "FF",
      }),
      vesselWithFaucetHoles: buildCountertopSku(ushSkuProfile, {
        style: "vessel",
        width: 120,
        depth: 50.5,
        thickness: "2.375",
        basinType: null,
        faucetHolesAmount: "2",
        countertopMaterialSku: "FX",
        countertopColorCode: "37GL",
      }),
      vessel: buildVesselSku({
        vesselType: "Vessel_Blade11",
        width: 50,
        height: 15,
        depth: 46,
        materialSku: "CER",
        colorCode: "OCB",
      }),
      unknownVessel: buildVesselSku({
        vesselType: "Vessel_Unknown",
        width: null,
        height: null,
        depth: null,
        materialSku: null,
        colorCode: null,
      }),
    }).toMatchInlineSnapshot(`
      {
        "integrated": [
          "CT-URSSTKR-INTG-23.6W-.5H-19.9D-SSTKR-FF",
          "CT-URSSTKR-RECT-.5H-SSTKR-FF",
        ],
        "unknownVessel": "VES-X-X-XW-XH-XD",
        "vessel": "VES-BLD11-X-19.7W-5.9H-15D-CER-OCB",
        "vesselWithFaucetHoles": [
          "CT-URFX-VES-47.2W-2.4H-19.9D-FX-37GL",
          "CT-URFX-FAHO/2",
          "CT-URFX-HCUT",
        ],
      }
    `);
  });

  it("summary inch conversion", () => {
    expect({
      sidePanel: convertSkuToInchesForSummary("VAN-URSP-1GU-1W-53H-50D-CAB-LACM-90", ushSkuProfile),
      cabinet: convertSkuToInchesForSummary("VAN-URSTD-SB/1DW/UG/X-60W-53H-50D", ushSkuProfile),
      countertop: convertSkuToInchesForSummary("CT-URSSTKR-INTG-23.6W-.5H-19.9D-SSTKR-FF", ushSkuProfile),
    }).toMatchInlineSnapshot(`
      {
        "cabinet": "VAN-URSTD-SB/1DW/UG/X-23.6W-20.9H-19.7D",
        "countertop": "CT-URSSTKR-INTG-23.6W-.5H-19.9D-SSTKR-FF",
        "sidePanel": "VAN-URSP-1GU-.4W-20.9H-19.7D-CAB-LACM-90",
      }
    `);
  });
});
