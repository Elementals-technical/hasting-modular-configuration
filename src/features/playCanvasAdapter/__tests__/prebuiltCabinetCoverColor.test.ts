import { describe, expect, it } from "vitest";

import sceneBundle from "../../../../public/HastingCabinetsParametrization/js/esm.mjs?raw";
import ulhPresets from "../../../../public/collections/urban-low-height/presets.json";
import { toCompactPreset } from "../lib/applyCompactPreset";

type CoverPlan = {
  status: string;
  diagnostics: unknown[];
  segments: {
    cabinetIds: string[];
    materialId: string;
    xMinM: number;
    xMaxM: number;
    yBottomM: number;
    thicknessM: number;
  }[];
};

// Execute the shipped pure cover-planner module without booting the PlayCanvas application.
// Its neighbouring module boundaries isolate geometry policy from the browser/runtime imports.
const plannerStart = sceneBundle.indexOf("const COVER_DIAGNOSTIC_CODE");
const plannerEnd = sceneBundle.indexOf("const KNOWN_ROLES", plannerStart);
if (plannerStart < 0 || plannerEnd <= plannerStart) throw new Error("Published cover planner could not be located");
const coverPolicy = new Function(`${sceneBundle.slice(plannerStart, plannerEnd)}; return coverPolicy;`)() as {
  planCabinetCovers: (input: Record<string, unknown>) => CoverPlan;
};

const coverSettings = {
  enabled: true,
  profileId: "ulh-v1",
  eligibilityMode: "all",
  thicknessM: 0.012700083809585871,
  tolerances: { contactM: 0.001, adjacencyM: 0.001, numericalM: 1e-6 },
};

const planTwoLevels = (settings: Record<string, unknown>) => {
  const supports = [
    {
      supportId: "lower-support",
      cabinetId: "lower-cabinet",
      productType: "ULH-side-cabinet",
      compatibilityKey: "ulh-v1",
      materialId: "Rox Black TKQ",
      eligibility: "direct",
      xMinM: 0,
      xMaxM: 1.2,
      yTopM: 0,
      zMinM: 0,
      zMaxM: 0.46,
    },
    {
      supportId: "upper-support",
      cabinetId: "upper-cabinet",
      productType: "ULH-sink-cabinet",
      compatibilityKey: "ulh-v1",
      materialId: "Rox Black TKQ",
      eligibility: "direct",
      xMinM: 1.02,
      xMaxM: 2.22,
      yTopM: 0.38,
      zMinM: 0,
      zMaxM: 0.46,
    },
  ];
  const result = coverPolicy.planCabinetCovers({
    version: 1,
    compositionId: "ulh-multi-level",
    revision: 0,
    frame: "world",
    units: "m",
    profileId: "ulh-v1",
    settings,
    tolerances: coverSettings.tolerances,
    supports,
    basinTops: [{ productId: "upper-top", xMinM: 1.02, xMaxM: 2.22, yBottomM: 0.38, zMinM: 0, zMaxM: 0.46 }],
  });
  return { result, supports };
};

describe("Urban Low Height Multi-Level starting countertop colours", () => {
  const multiLevelPresets = ulhPresets.filter((preset) => preset.title.endsWith("Multi-Level"));

  it.each(multiLevelPresets)("opens preset $id with the lower cover matching the upper countertop", (preset) => {
    const compact = toCompactPreset(preset);
    const settings = compact.featureSettings?.cabinetCover as Record<string, unknown>;
    const { result, supports } = planTwoLevels(settings);

    expect(result.status).toBe("ready");
    expect(result.diagnostics).toEqual([]);
    expect(result.segments).toEqual([
      expect.objectContaining({
        cabinetIds: ["lower-cabinet"],
        materialId: compact.top?.CountertopColor,
        xMinM: 0,
        xMaxM: 1.2,
        yBottomM: 0,
        thicknessM: settings.thicknessM,
      }),
    ]);
    expect(compact.top?.CountertopColor).toBe("Bianco Male TFA");
    expect(compact.shared?.CabinetColor).toBe("Rox Black TKQ");
    expect(supports.every((support) => support.materialId === "Rox Black TKQ")).toBe(true);
  });

  it("uses the cabinet finish when a cover has no explicit material", () => {
    const { result } = planTwoLevels(coverSettings);
    expect(result.status).toBe("ready");
    expect(result.segments.map((segment) => segment.materialId)).toEqual(["Rox Black TKQ"]);
  });

  it.each([undefined, null, "", "   ", 42])(
    "keeps the cabinet finish for an unset cover material (%s)",
    (materialId) => {
      const { result } = planTwoLevels({ ...coverSettings, materialId });
      expect(result.status).toBe("ready");
      expect(result.segments.map((segment) => segment.materialId)).toEqual(["Rox Black TKQ"]);
    },
  );
});
