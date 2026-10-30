import { beforeEach, describe, expect, it, vi } from "vitest";

import { store } from "@/app/store";
import { parseProductProfile } from "@/entities/collection/lib/parseProductProfile";
import { ulhRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/ulhRuntimeBindingsFixture";
import { resolveProductConfig } from "@/entities/collection/lib/runtimeBindings/resolveProductConfig";
import type { ScenePatch } from "@/entities/collection";
import { resetConfiguration, setActiveCollectionId, syncCabinets } from "@/entities/configuration";
import {
  addProductPreset,
  reset,
  setActiveProfile,
  setCabinetColor,
  setSelectedProductConfig,
} from "@/entities/product/model/store/slice";
import { changeAttribute } from "@/features/configurationCommands";
import { configuratorColors } from "@/features/configurationCommands/__tests__/configuratorColorsFixture";
import { resolveChangeRequest } from "@/features/configurationCommands/lib/resolveChangeRequest";
import type { SceneSelector } from "@/utils/functions/playcanvas/sceneBridge";

import sceneBundle from "../../../../public/HastingCabinetsParametrization/js/esm.mjs?raw";
import ulhProfileDocument from "../../../../public/collections/urban-low-height/product-profile.json";
import { createPlayCanvasRuntimePort } from "../lib/createPlayCanvasRuntimePort";

const parsed = parseProductProfile(ulhProfileDocument);
if (!parsed.ok) throw new Error("Invalid ULH profile");
const profile = parsed.profile;

type MaterialTarget = { name: string; material: string };
type MaterialRule = {
  entity: MaterialTarget[];
  execute(input: { currentState: Map<string, unknown> }): Promise<void>;
};

// Run the shipped ULH rule, replacing only its engine/material-loading dependencies.
// This verifies material targets and reset behaviour, not just a successful adapter response.
const ruleStart = sceneBundle.indexOf("const ULH_CABINET_GROOVE_NODE=");
const ruleEnd = sceneBundle.indexOf("var RuleMaterialsCabinetULH$1", ruleStart);
if (ruleStart < 0 || ruleEnd <= ruleStart) throw new Error("Published ULH material rule could not be located");
const MaterialRuleClass = new Function(
  "BaseProductRule",
  "SceneEntityHelper",
  "MaterialService",
  "LoggerService",
  `${sceneBundle.slice(ruleStart, ruleEnd)}; return RuleMaterialsCabinetULH;`,
)(
  class {},
  {
    collectByNames: (entities: MaterialTarget[], names: string[]) =>
      entities.filter(({ name }) => names.includes(name)),
  },
  {
    applyMaterialByName: async (material: string, entities: MaterialTarget[]) => {
      entities.forEach((entity) => {
        entity.material = material;
      });
    },
  },
  { log: () => undefined, warn: () => undefined },
) as new () => MaterialRule;

const createCabinet = (id: string, productType: string, handle = "handle_urban_topcut") => {
  const config: Record<string, unknown> = {
    CabinetColor: "Rovere Naturale",
    Handle: handle,
    Drawers: "1D",
  };
  const targets = ["ULH_Cabinet_Walls", "ULH_Drawer_HTopCut", "ULH_Cabinet_HGroove"].map((name) => ({
    name,
    material: "Rovere Naturale",
  }));
  const rule = new MaterialRuleClass();
  rule.entity = targets;
  return { id, productType, config, targets, rule };
};

const createScene = () => {
  const cabinets = [
    createCabinet("ULH-sink-cabinet-a", "ULH-sink-cabinet"),
    createCabinet("ULH-side-cabinet-b", "ULH-side-cabinet"),
  ];
  const calls: { selector: SceneSelector; patch: ScenePatch }[] = [];
  const runtime = createPlayCanvasRuntimePort({
    getBindings: () => ulhRuntimeBindings,
    scene: {
      isReady: () => true,
      async apply(selector, patch) {
        calls.push({ selector, patch });
        const selected = cabinets.filter(({ id }) => !selector.productIds || selector.productIds.includes(id));
        for (const cabinet of selected) {
          Object.assign(cabinet.config, patch);
          await cabinet.rule.execute({ currentState: new Map(Object.entries(cabinet.config)) });
        }
        return { status: "applied", updatedIds: selected.map(({ id }) => id) };
      },
    },
  });
  const pick = async (attributeId: string, value: string, flow: "custom" | "prebuilt" = "custom") => {
    const request = resolveChangeRequest(store.getState(), attributeId, value);
    if (!request) throw new Error(`No field target for ${attributeId}`);
    return changeAttribute(request, {
      getState: store.getState,
      dispatch: store.dispatch,
      runtime,
      flow,
      configurator: configuratorColors,
    });
  };
  return { cabinets, calls, pick };
};

describe("ULH handle groove colour from a preset through the command, binding and shipped scene rule", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(setActiveProfile(profile));
    store.dispatch(setActiveCollectionId("urban-low-height"));
    store.dispatch(setCabinetColor("Rovere Naturale"));
    store.dispatch(setSelectedProductConfig({ Handle: "handle_urban_topcut", Drawers: "1D" }));
    store.dispatch(syncCabinets(["ULH-sink-cabinet-a", "ULH-side-cabinet-b"]));
    store.dispatch(addProductPreset([{ name: "Sink-Base", CabinetColor: "Rovere Naturale" }]));
  });

  it.each(["custom", "prebuilt"] as const)("paints the groove of every drawer cabinet in %s", async (flow) => {
    const { cabinets, calls, pick } = createScene();
    const result = await pick("HandleGrooveColor", "Bianco LACM", flow);

    expect(result.status).toBe("applied");
    expect(calls).toEqual([{ selector: {}, patch: { HandleGrooveColor: "Bianco LACM" } }]);
    for (const { productType, targets } of cabinets) {
      expect(sceneBundle).toContain(`registerProduct("${productType}"`);
      expect(targets.map(({ material }) => material)).toEqual(["Rovere Naturale", "Rovere Naturale", "Bianco LACM"]);
    }
    expect(store.getState().rootStateUI.product.productOptions.HandleGrooveColor).toBe("Bianco LACM");
    expect(store.getState().rootStateUI.product.productsPresets[0].HandleGrooveColor).toBe("Bianco LACM");
  });

  it("preserves a separate groove colour on cabinet colour changes, then None follows the cabinet again", async () => {
    const { cabinets, calls, pick } = createScene();
    expect((await pick("HandleGrooveColor", "Bianco LACM")).status).toBe("applied");
    expect((await pick("CabinetColor", "Cepp Stone TKP")).status).toBe("applied");
    for (const { targets } of cabinets) {
      expect(targets.map(({ material }) => material)).toEqual(["Cepp Stone TKP", "Cepp Stone TKP", "Bianco LACM"]);
    }
    expect((await pick("HandleGrooveColor", "None")).status).toBe("applied");
    expect(calls.at(-1)?.patch).toEqual({ HandleGrooveColor: "None" });
    expect((await pick("CabinetColor", "Rovere Naturale")).status).toBe("applied");
    for (const { targets } of cabinets) {
      expect(targets.every(({ material }) => material === "Rovere Naturale")).toBe(true);
    }
  });

  it("keeps the PTO groove in the cabinet finish even if an old config carries a groove colour", async () => {
    const cabinet = createCabinet("ULH-side-cabinet-b", "ULH-side-cabinet", "handle_pto");
    cabinet.config.HandleGrooveColor = "Bianco LACM";
    await cabinet.rule.execute({ currentState: new Map(Object.entries(cabinet.config)) });
    expect(cabinet.targets.every(({ material }) => material === "Rovere Naturale")).toBe(true);
  });

  it.each(["Bianco LACM", "None", ""])("keeps groove colour %s in the placement/restore config", (value) => {
    expect(
      resolveProductConfig(ulhRuntimeBindings, { HandleGrooveColor: value, Handle: "handle_urban_topcut" }),
    ).toMatchObject({ HandleGrooveColor: value || "None", Handle: "handle_urban_topcut" });
  });

  it("does not report a colour as applied when the scene is not ready", async () => {
    const apply = vi.fn();
    const runtime = createPlayCanvasRuntimePort({
      getBindings: () => ulhRuntimeBindings,
      scene: { isReady: () => false, apply },
    });
    const request = resolveChangeRequest(store.getState(), "HandleGrooveColor", "Bianco LACM");
    if (!request) throw new Error("No groove field target");
    const result = await changeAttribute(request, {
      getState: store.getState,
      dispatch: store.dispatch,
      runtime,
      flow: "custom",
      configurator: configuratorColors,
    });
    expect(result).toMatchObject({ status: "error", code: "runtime-not-ready" });
    expect(apply).not.toHaveBeenCalled();
    expect(store.getState().rootStateUI.product.productOptions.HandleGrooveColor).not.toBe("Bianco LACM");
  });
});
