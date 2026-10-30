import { describe, expect, it } from "vitest";

import { CUSTOMIZATION_FLOW_IDS, type CustomizationSchema } from "@/entities/collection";
import { readCustomizationSchema } from "@/entities/collection/__tests__/fixtures/readCustomizationSchema";

import classUi from "../../../../public/collections/class/ui.json";
import lameUi from "../../../../public/collections/lame/ui.json";
import makoUi from "../../../../public/collections/mako/ui.json";
import tricotUi from "../../../../public/collections/tricot/ui.json";
import urbanDuplexUi from "../../../../public/collections/urban-duplex/ui.json";
import urbanFreestandingUi from "../../../../public/collections/urban-freestanding/ui.json";
import urbanLowHeightUi from "../../../../public/collections/urban-low-height/ui.json";
import ushUi from "../../../../public/collections/urban-standard-height/ui.json";
import { resolveFlowForPath } from "../lib/computeNavigation";
import { resolveSummaryEditTargets } from "../lib/summaryEditTargets";

const shipped: Record<string, CustomizationSchema> = {
  "urban-standard-height": readCustomizationSchema(ushUi),
  "urban-low-height": readCustomizationSchema(urbanLowHeightUi),
  "urban-freestanding": readCustomizationSchema(urbanFreestandingUi),
  "urban-duplex": readCustomizationSchema(urbanDuplexUi),
  class: readCustomizationSchema(classUi),
  mako: readCustomizationSchema(makoUi),
  lame: readCustomizationSchema(lameUi),
  tricot: readCustomizationSchema(tricotUi),
};

const everyFlow = Object.entries(shipped).flatMap(([collectionId, schema]) =>
  CUSTOMIZATION_FLOW_IDS.map((flowId) => [collectionId, flowId, schema] as const),
);

describe("resolveSummaryEditTargets", () => {
  it.each(everyFlow)("keeps %s in its %s flow: every Edit leads to a step of that flow", (_id, flowId, schema) => {
    const { cabinetMenu, pathBySectionId } = resolveSummaryEditTargets(schema, flowId);
    const paths = [...cabinetMenu.map(({ path }) => path), ...Object.values(pathBySectionId)];

    expect(paths.length).toBeGreaterThan(0);
    paths.forEach((path) => expect(resolveFlowForPath(schema, path)).toBe(flowId));
  });

  it.each(everyFlow)("offers %s in the %s flow its entry step and its colour step", (_id, flowId, schema) => {
    const { cabinetMenu } = resolveSummaryEditTargets(schema, flowId);

    expect(cabinetMenu.map(({ id }) => id)).toEqual([
      flowId === "prebuilt" ? "model-selection" : "cabinet-builder",
      "color",
    ]);
    expect(cabinetMenu[0].path).toBe(
      schema.flows[flowId].steps.find(({ stepId }) => stepId === schema.flows[flowId].entryStepId)?.path,
    );
  });

  it("leads Mako's custom Summary to its own custom steps, never to the prebuilt ones", () => {
    expect(resolveSummaryEditTargets(shipped.mako, "custom")).toEqual({
      cabinetMenu: [
        { id: "cabinet-builder", label: "Cabinet Builder", path: "/custom/cabinet-builder" },
        { id: "color", label: "Color", path: "/custom/color" },
      ],
      pathBySectionId: {
        countertop: "/custom/countertop",
        basin: "/custom/countertop",
        accessories: "/custom/accessories",
        faucet: "/custom/faucet-holes",
      },
    });
  });

  it("finds the colour step of Urban Duplex by its panel colour, which stands in for CabinetColor", () => {
    expect(resolveSummaryEditTargets(shipped["urban-duplex"], "prebuilt").cabinetMenu).toContainEqual({
      id: "color",
      label: "Color",
      path: "/prebuilt/color",
    });
  });

  it("leads Cabinet Options to the step that shows the pattern, whatever the collection names it", () => {
    const optionsPath = (id: string, flowId: "prebuilt" | "custom") =>
      resolveSummaryEditTargets(shipped[id], flowId).pathBySectionId["cabinet-options"];

    expect(optionsPath("urban-standard-height", "prebuilt")).toBe("/prebuilt/color");
    expect(optionsPath("urban-standard-height", "custom")).toBe("/custom/cabinet-colors");
    expect(optionsPath("urban-low-height", "prebuilt")).toBe("/prebuilt/color");
    expect(optionsPath("tricot", "custom")).toBe("/custom/color");
  });

  it.each(["class", "mako", "lame", "urban-duplex"])(
    "gives %s no Cabinet Options target, as no step of it shows a pattern",
    (id) => {
      expect(resolveSummaryEditTargets(shipped[id], "prebuilt").pathBySectionId).not.toHaveProperty("cabinet-options");
    },
  );

  it("leads Accessories to the accessories screen, which Tricot calls `side-panels`", () => {
    expect(resolveSummaryEditTargets(shipped.tricot, "prebuilt").pathBySectionId.accessories).toBe(
      "/prebuilt/side-panels",
    );
  });

  it("gives Urban Low Height, which has no Faucet Details step, no Faucet target", () => {
    expect(resolveSummaryEditTargets(shipped["urban-low-height"], "custom").pathBySectionId).not.toHaveProperty(
      "faucet",
    );
  });

  it("keeps the Urban Standard Height targets both Summary pages had", () => {
    expect(resolveSummaryEditTargets(shipped["urban-standard-height"], "prebuilt")).toEqual({
      cabinetMenu: [
        { id: "model-selection", label: "Model Selection", path: "/prebuilt/model" },
        { id: "color", label: "Color", path: "/prebuilt/color" },
      ],
      pathBySectionId: {
        "cabinet-options": "/prebuilt/color",
        countertop: "/prebuilt/countertop",
        basin: "/prebuilt/countertop",
        accessories: "/prebuilt/accessories",
        faucet: "/prebuilt/faucet-holes",
      },
    });
    expect(resolveSummaryEditTargets(shipped["urban-standard-height"], "custom")).toEqual({
      cabinetMenu: [
        { id: "cabinet-builder", label: "Cabinet Builder", path: "/custom/cabinet-builder" },
        { id: "color", label: "Color", path: "/custom/cabinet-colors" },
      ],
      pathBySectionId: {
        "cabinet-options": "/custom/cabinet-colors",
        countertop: "/custom/countertop",
        basin: "/custom/countertop",
        accessories: "/custom/accessories",
        faucet: "/custom/faucet-holes",
      },
    });
  });
});
