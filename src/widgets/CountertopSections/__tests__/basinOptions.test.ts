import { describe, expect, it } from "vitest";

import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import type { ProductOptionData } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import type { CountertopMatrixRule } from "@/features/configurator-rule-core/countertop";

import { resolveIntegratedBasinOptions, resolveVesselBasinOptions } from "../lib/basinOptions";
import { VESSEL_SINK_NONE_OPTION } from "../lib/countertopColorOptions";

// A refused basin carries the reason code its text is the fallback of, so the grid shows the profile's words for it
// instead of the generic "not available".

const rule = (overrides: Partial<CountertopMatrixRule>): CountertopMatrixRule =>
  ({
    material: "HPL",
    basinStyle: "Quadra 50",
    topThicknesses: [],
    maxIntegratedCm: null,
    minSbCm: null,
    integratedAllowedSizesOnly: [],
    ...overrides,
  }) as unknown as CountertopMatrixRule;

const QUADRA: ProductOptionData = { id: "Quadra_50", title: "Quadra 50", name: "Quadra_50", isShortDesc: false };

const integratedBasin = (rules: CountertopMatrixRule[], sinkBaseWidth: number, totalWidth: number) => {
  const [basin] = resolveIntegratedBasinOptions({
    catalog: [QUADRA],
    integratedNames: new Set([QUADRA.name ?? ""]),
    matchingRules: rules,
    allowedMaterials: new Set(),
    activeMaterials: [],
    activeThickness: null,
    widthContext: { sinkBaseWidth, totalWidth },
    profile: ushProfile,
  });
  return basin;
};

describe("resolveIntegratedBasinOptions", () => {
  it.each([
    [
      "total width over the basin maximum",
      [rule({ maxIntegratedCm: 160 })],
      60,
      180,
      {
        disabledReasonCode: "countertop.totalWidthAboveMax",
        disabledReasonParams: { currentCm: 180, currentIn: "70.9", maxCm: 160, maxIn: "63" },
        disabledReason:
          'Not available for current total cabinets width on scene. Current 180 cm (70.9"), max 160 cm (63").',
      },
    ],
    [
      "sink base under its minimum",
      [rule({ minSbCm: 80 })],
      60,
      60,
      {
        disabledReasonCode: "countertop.sinkBaseBelowMin",
        disabledReasonParams: { currentCm: 60, currentIn: "23.6", minCm: 80, minIn: "31.5" },
        disabledReason: 'Not available for current sink base width. Current 60 cm (23.6"), minimum 80 cm (31.5").',
      },
    ],
    [
      "sink base outside the exact sizes",
      [rule({ integratedAllowedSizesOnly: [80, 100] })],
      60,
      60,
      {
        disabledReasonCode: "countertop.sinkBaseWidthNotAllowed",
        disabledReasonParams: { allowedWidths: '80 cm (31.5"), 100 cm (39.4")' },
        disabledReason: 'Not available for current sink base width. Allowed widths: 80 cm (31.5"), 100 cm (39.4").',
      },
    ],
    [
      // Each row fails another width, so no single width explains the refusal.
      "rows that fail different widths",
      [rule({ maxIntegratedCm: 200, minSbCm: 80 }), rule({ maxIntegratedCm: 100, minSbCm: 50 })],
      60,
      150,
      {
        disabledReasonCode: "countertop.materialNotAvailableForSelection",
        disabledReasonParams: undefined,
        disabledReason: "Not available for selected cabinet width/depth/thickness on scene",
      },
    ],
  ])("refuses a basin for %s with its reason code", (_case, rules, sinkBaseWidth, totalWidth, reason) => {
    expect(integratedBasin(rules, sinkBaseWidth, totalWidth)).toMatchObject({ isAvailable: false, ...reason });
  });

  it("offers a basin a row allows without a reason", () => {
    expect(integratedBasin([rule({ minSbCm: 60 })], 60, 60)).toMatchObject({
      isAvailable: true,
      disabledReason: undefined,
      disabledReasonCode: undefined,
    });
  });
});

describe("resolveVesselBasinOptions", () => {
  it("refuses every vessel below the Sink Base minimum with the rule state's code and values, and keeps None", () => {
    const vesselSinkBaseMin = {
      reasonCode: "countertop.vesselSinkBaseMin",
      reasonParams: { minCm: 80, minIn: "31.5" },
      disabledReason: 'Not available for selected sink base cabinet width. Minimum width required 80cm (31.5")',
    };
    const context = {
      activeCountertopColor: "Ardesia TKF",
      activeMaterialTokens: ["hpl"],
      activeProfile: ushProfile,
      messages: {},
      ruleState: {
        styleAvailability: { vessel: { isAvailable: false, maxCompatibleWidthCm: null, ...vesselSinkBaseMin } },
        vesselSinkAvailability: { isAvailable: false, minSinkBaseWidthCm: 80, ...vesselSinkBaseMin },
      },
    } as unknown as Parameters<typeof resolveVesselBasinOptions>[1];

    const [none, ...vessels] = resolveVesselBasinOptions(
      [{ id: "Vessel_UrbanModo", title: "Vessel Urban Modo", name: "Vessel_UrbanModo", isShortDesc: false }],
      context,
    );

    expect(none).toEqual(VESSEL_SINK_NONE_OPTION);
    expect(vessels).toMatchObject([
      {
        name: "Vessel_UrbanModo",
        isAvailable: false,
        disabledReason: vesselSinkBaseMin.disabledReason,
        disabledReasonCode: "countertop.vesselSinkBaseMin",
        disabledReasonParams: { minCm: 80, minIn: "31.5" },
      },
    ]);
  });
});
