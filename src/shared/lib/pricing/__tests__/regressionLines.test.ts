import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildPricingLines } from "../buildPricingLines";
import { expandLineSkus } from "../pricingLines";
import { PRICING_SCENARIOS, PRICING_SCENARIO_IDS, type PricingScenarioId } from "./fixtures/pricingScenarios";

/**
 * The USH order of each reference scenario, fixed line by line (D03).
 *
 * Captured from the current build after D01 and D02. A changed SKU, a changed count, a lost
 * piece or a countertop priced for another width fails here before it reaches a quote.
 */

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

const orderOf = (scenario: PricingScenarioId) =>
  buildPricingLines(PRICING_SCENARIOS[scenario].input).map(
    ({ id, group, sku, quantity, widthCm }) =>
      `${id} | ${group} | ${sku} | x${quantity}${widthCm != null ? ` | ${widthCm}cm` : ""}`,
  );

describe("USH order regression", () => {
  it("custom composition, 60 cm sink bases", () => {
    expect(orderOf("custom-composition-60")).toMatchInlineSnapshot(`
      [
        "cabinet:Sink-Base-aaaaaa | cabinet | VAN-URSTD-SB/1DW/UG/X-23.6W-20.9H-19.7D-CAB-3D-1C1 | x1",
        "cabinet:Sink-Base-bbbbbb | cabinet | VAN-URSTD-SB/1DW/UG/X-23.6W-20.9H-19.7D-CAB-3D-1C1 | x1",
        "cabinet:Open-Shelf-cccccc | openShelf | VAN-UROS-2S-15.7W-20.9H-19.7D-CAB-3D-1C1 | x1",
        "countertop:0 | countertop | CT-URSSTKR-INTG-63.8W-.5H-19.9D-SSTKR-FF | x1 | 162cm",
        "countertop:basin:config-0 | basin | CT-URSSTKR-RECT-.5H-SSTKR-FF | x1",
        "countertop:basin:config-1 | basin | CT-URSSTKR-RECT-.5H-SSTKR-FF | x1",
        "countertop:faucetDefault | faucetHoles | CT-URSSTKR-FAHO/0 | x1",
        "towelBar:right | towelBar | VAN-URTWLBR-STB/R-15.7W-1.4H-2D-LACM-43 MT | x1",
        "towelBar:left | towelBar | VAN-URTWLBR-STB/L-15.7W-1.4H-2D-LACM-43 MT | x1",
        "sidePanel | sidePanel | VAN-URSP-0G-.4W-20.9H-19.7D-CAB-3D-1C1 | x2",
        "divider:Sink-Base-aaaaaa:0 | divider | VAN-URDIV-A-5.3W-2.4H-15D | x1",
      ]
    `);
  });

  it("custom composition, 80 cm sink bases", () => {
    expect(orderOf("custom-composition-80")).toMatchInlineSnapshot(`
      [
        "cabinet:Sink-Base-aaaaaa | cabinet | VAN-URSTD-SB/1DW/UG/X-31.5W-20.9H-19.7D-CAB-3D-1C1 | x1",
        "cabinet:Sink-Base-bbbbbb | cabinet | VAN-URSTD-SB/1DW/UG/X-31.5W-20.9H-19.7D-CAB-3D-1C1 | x1",
        "cabinet:Open-Shelf-cccccc | openShelf | VAN-UROS-2S-15.7W-20.9H-19.7D-CAB-3D-1C1 | x1",
        "countertop:0 | countertop | CT-URSSTKR-INTG-79.5W-.5H-19.9D-SSTKR-FF | x1 | 202cm",
        "countertop:basin:config-0 | basin | CT-URSSTKR-RECT-.5H-SSTKR-FF | x1",
        "countertop:basin:config-1 | basin | CT-URSSTKR-RECT-.5H-SSTKR-FF | x1",
        "countertop:faucetDefault | faucetHoles | CT-URSSTKR-FAHO/0 | x1",
        "towelBar:right | towelBar | VAN-URTWLBR-STB/R-15.7W-1.4H-2D-LACM-43 MT | x1",
        "towelBar:left | towelBar | VAN-URTWLBR-STB/L-15.7W-1.4H-2D-LACM-43 MT | x1",
        "sidePanel | sidePanel | VAN-URSP-0G-.4W-20.9H-19.7D-CAB-3D-1C1 | x2",
        "divider:Sink-Base-aaaaaa:0 | divider | VAN-URDIV-A-5.3W-2.4H-15D | x1",
      ]
    `);
  });

  it("custom vessel countertop with faucet holes", () => {
    expect(orderOf("custom-vessel")).toMatchInlineSnapshot(`
      [
        "cabinet:Sink-Base-aaaaaa | cabinet | VAN-URSTD-SB/1DW/UG/X-23.6W-20.9H-19.7D-CAB-3D-1C1 | x1",
        "cabinet:Sink-Base-bbbbbb | cabinet | VAN-URSTD-SB/1DW/UG/X-23.6W-20.9H-19.7D-CAB-3D-1C1 | x1",
        "countertop:0 | countertop | CT-URSSTKR-VES-47.2W-.5H-19.9D-SSTKR-FF | x1 | 120cm",
        "countertop:1 | faucetHoles | CT-URSSTKR-FAHO/2 | x1",
        "countertop:2 | holeCut | CT-URSSTKR-HCUT | x2",
        "vessel | vessel | VES-URMOD-X-19.7W-5.5H-13D | x2",
      ]
    `);
  });

  it("prebuilt set with an added cabinet", () => {
    expect(orderOf("prebuilt-set-with-added-cabinet")).toMatchInlineSnapshot(`
      [
        "cabinet:preset-0 | cabinet | VAN-URSTD-SB/1DW/UG/X-23.6W-20.9H-19.7D-CAB-3D-1C1 | x1",
        "cabinet:preset-1 | openShelf | VAN-UROS-2S-15.7W-20.9H-19.7D-CAB-3D-1C1 | x1",
        "cabinet:Sink-Base-dddddd | cabinet | VAN-URSTD-SB/1DW/UG/X-23.6W-20.9H-19.7D-CAB-3D-1C1 | x1",
        "countertop:0 | countertop | CT-URSSTKR-INTG-63W-.5H-19.9D-SSTKR-FF | x1 | 160cm",
        "countertop:basin:preset-0 | basin | CT-URSSTKR-RECT-.5H-SSTKR-FF | x1",
        "countertop:basin:config-0 | basin | CT-URSSTKR-RECT-.5H-SSTKR-FF | x1",
        "countertop:faucetDefault | faucetHoles | CT-URSSTKR-FAHO/0 | x1",
      ]
    `);
  });

  it("prices a prebuilt set the same once its handle is recorded as the composition's", () => {
    // Placing a preset records the handle its cabinets carry as the selection, as the handle command does.
    const { input } = PRICING_SCENARIOS["prebuilt-set-with-added-cabinet"];

    expect(buildPricingLines({ ...input, selectedProductConfig: { Handle: "handle_urban_topcut" } })).toEqual(
      buildPricingLines(input),
    );
  });

  it("covers every scenario", () => {
    expect(PRICING_SCENARIO_IDS).toEqual([
      "custom-composition-60",
      "custom-composition-80",
      "custom-vessel",
      "prebuilt-set-with-added-cabinet",
    ]);
  });

  it("orders two identical cabinets as two pieces", () => {
    const lines = buildPricingLines(PRICING_SCENARIOS["custom-composition-60"].input);
    const cabinets = lines.filter(({ group }) => group === "cabinet");
    const skus = expandLineSkus(lines);

    expect(cabinets).toHaveLength(2);
    expect(cabinets[0].sku).toBe(cabinets[1].sku);
    expect(skus.filter((sku) => sku === cabinets[0].sku)).toHaveLength(2);
  });

  it("prices a wider composition with its own countertop", () => {
    const narrow = buildPricingLines(PRICING_SCENARIOS["custom-composition-60"].input);
    const wide = buildPricingLines(PRICING_SCENARIOS["custom-composition-80"].input);
    const top = (lines: ReturnType<typeof buildPricingLines>) => lines.find(({ id }) => id === "countertop:0");

    expect(top(wide)?.widthCm).toBeGreaterThan(top(narrow)?.widthCm ?? 0);
    expect(top(wide)?.sku).not.toBe(top(narrow)?.sku);
  });

  it("orders a vessel cutout for every sink base", () => {
    const lines = buildPricingLines(PRICING_SCENARIOS["custom-vessel"].input);

    expect(lines.filter(({ group }) => group === "holeCut").map(({ quantity }) => quantity)).toEqual([2]);
  });
});
