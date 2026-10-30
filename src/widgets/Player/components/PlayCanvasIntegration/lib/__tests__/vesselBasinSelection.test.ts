import { beforeEach, describe, expect, it } from "vitest";

import classProfileDocument from "../../../../../../../public/collections/class/product-profile.json";
import classRuntimeDocument from "../../../../../../../public/collections/class/runtime-bindings.json";
import { store } from "@/app/store";
import cabinetTable from "@/entities/collection/__tests__/fixtures/remote/datatable-592.json";
import {
  tricotConfigurator,
  tricotMatrixProfile,
  tricotProfile,
  tricotRuntimeBindings,
} from "@/entities/collection/__tests__/tricotFixtures";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { parseProductProfile } from "@/entities/collection/lib/parseProductProfile";
import { parseRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/parseRuntimeBindings";
import { ushRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/ushRuntimeBindingsFixture";
import { normalizeOptionValue } from "@/entities/collection";
import type { ProductProfile, RuntimeBindingSet, ScenePatch } from "@/entities/collection";
import {
  getAttributeValue,
  recordSceneState,
  resetConfiguration,
  setActiveCollectionId,
  setActiveRuntimeBindings,
  setAttributeValue,
  syncCabinets,
} from "@/entities/configuration";
import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";
import { reset, setActiveProfile, setCabinetCatalog } from "@/entities/product/model/store/slice";
import { recordValues, replayValues } from "@/features/configurationCommands";
import { createPlayCanvasRuntimePort } from "@/features/playCanvasAdapter/lib/createPlayCanvasRuntimePort";
import type { SceneBridge } from "@/features/playCanvasAdapter/lib/createPlayCanvasRuntimePort";
import type { SceneSelector } from "@/utils/functions/playcanvas/sceneBridge";

import { resolveVesselBasinActionValues } from "../vesselBasinSelection";

/**
 * The scene's Delete action for a vessel sends its placeholder sink type "Vessel". Each collection
 * names "no vessel" with its own sinkType noneValue; the action has to reach the scene as that value.
 */

const parsedClass = parseProductProfile(classProfileDocument);
if (!parsedClass.ok) throw new Error(JSON.stringify(parsedClass.diagnostics));
const classProfile = parsedClass.profile;
const parsedClassBindings = parseRuntimeBindings(classRuntimeDocument);
if (!parsedClassBindings.ok) throw new Error(JSON.stringify(parsedClassBindings.diagnostics));
const classRuntimeBindings = parsedClassBindings.bindings;

/** The descriptor `_buildSinkBasinSelectionInfo` builds for a vessel basin in the PlayCanvas export. */
const DELETE_CONFIG = { sinkType: "Vessel", VesselColor: "" };

describe("resolveVesselBasinActionValues", () => {
  it.each([
    ["Urban Standard Height", ushProfile, "Vessel"],
    ["Tricot", tricotProfile, "None"],
    ["Class", classProfile, "None"],
  ])("reads the Delete placeholder as %s's noneValue", (_, profile, noneValue) => {
    expect(resolveVesselBasinActionValues(DELETE_CONFIG, profile)).toEqual({
      send: { sinkType: noneValue, VesselColor: "" },
      recordOnly: { CountertopStyle: "Vessel" },
    });
  });

  it("keeps the placeholder when no profile is loaded", () => {
    expect(resolveVesselBasinActionValues(DELETE_CONFIG, null).send.sinkType).toBe("Vessel");
  });

  it("passes other values through and records nothing extra", () => {
    expect(
      resolveVesselBasinActionValues({ VesselColor: "Latte 417 Lacquered MT", productId: 3 }, tricotProfile),
    ).toEqual({
      send: { VesselColor: "Latte 417 Lacquered MT" },
      recordOnly: {},
    });
  });
});

describe("vessel Delete through the PlayCanvas adapter", () => {
  const CABINETS = ["Sink-Base-a"];

  const createRecordedScene = () => {
    const calls: { selector: SceneSelector; patch: ScenePatch }[] = [];
    const scene: SceneBridge = {
      isReady: () => true,
      async apply(selector, patch) {
        calls.push({ selector, patch });
        return { status: "applied", updatedIds: selector.productIds ?? CABINETS };
      },
    };
    return { scene, calls };
  };

  const load = (collectionId: string, profile: ProductProfile, bindings: RuntimeBindingSet, cabinets = CABINETS) => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(setActiveProfile(profile));
    store.dispatch(setActiveCollectionId(collectionId));
    store.dispatch(setActiveRuntimeBindings(bindings));
    store.dispatch(syncCabinets(cabinets));
  };

  const deps = (bindings: RuntimeBindingSet, scene: SceneBridge) => ({
    getState: () => store.getState(),
    dispatch: (action: Parameters<typeof store.dispatch>[0]) => store.dispatch(action),
    runtime: createPlayCanvasRuntimePort({ getBindings: () => bindings, scene }),
    flow: "prebuilt" as const,
    configurator: tricotConfigurator,
  });

  const replay = (send: Record<string, string>, recordOnly: Record<string, string>, bindings: RuntimeBindingSet) => {
    const { scene, calls } = createRecordedScene();
    const result = replayValues({ send, recordOnly, record: true }, deps(bindings, scene));
    return { result, calls };
  };

  const sentSinkTypes = (calls: { patch: ScenePatch }[]) =>
    calls.flatMap(({ patch }) => (typeof patch.sinkType === "string" ? [patch.sinkType] : []));

  /**
   * Tricot as the loader leaves it when its vessel menu opens: the hydrated countertop matrix, one
   * 60 cm sink base and an Iris vessel on a vessel countertop, held by the composition and by the sink
   * base as the basin fields record it. Tricot checks replayed values against that product data, so
   * the Delete has to pass those checks too.
   */
  const loadTricotWithVessel = () => {
    const sinkBase = tricotRuntimeBindings.productTypes["Sink-Base"] + "-1";
    load("tricot", tricotMatrixProfile, tricotRuntimeBindings, [sinkBase]);
    store.dispatch(
      setCabinetCatalog(buildCabinetCatalogFromMatrix(cabinetTable, tricotMatrixProfile, tricotRuntimeBindings)),
    );
    store.dispatch(
      recordSceneState({
        order: [sinkBase],
        cabinets: [{ runtimeId: sinkBase, dimensions: { width: 60, height: 40, depth: 52 } }],
      }),
    );
    store.dispatch(
      setAttributeValue({ attributeId: "Drawers", target: { scope: "cabinet", cabinetId: "cab-1" }, value: "1" }),
    );
    const { scene } = createRecordedScene();
    recordValues(
      { CountertopStyle: "vessel", sinkType: "Iris", VesselColor: "Salvia 415 Lacquered MT" },
      deps(tricotRuntimeBindings, scene),
    );
    for (const [attributeId, value] of [
      ["sinkType", "Iris"],
      ["VesselColor", "Salvia 415 Lacquered MT"],
    ]) {
      store.dispatch(setAttributeValue({ attributeId, target: { scope: "basin", sinkBaseId: "cab-1" }, value }));
    }
  };

  beforeEach(loadTricotWithVessel);

  it("documents the defect: the scene's own spelling has no Tricot translation", async () => {
    const { result, calls } = replay(DELETE_CONFIG, {}, tricotRuntimeBindings);

    expect(await result).toMatchObject({
      skipped: [{ attributeId: "sinkType", value: "Vessel", reason: "no-translation" }],
    });
    expect(sentSinkTypes(calls)).toEqual([]);
  });

  it("tricot: Delete reaches the scene as the placeholder and keeps a vessel countertop without a vessel", async () => {
    const { send, recordOnly } = resolveVesselBasinActionValues(DELETE_CONFIG, tricotMatrixProfile);
    const { result, calls } = replay(send, recordOnly, tricotRuntimeBindings);

    expect(await result).toMatchObject({ status: "applied", skipped: [] });
    expect(sentSinkTypes(calls)).toEqual(["Vessel"]);
    expect(getAttributeValue(store.getState(), "sinkType", { scope: "basin" })).toBe("None");
    // The sink base's own basin goes too: the price reads it before the composition's.
    expect(getAttributeValue(store.getState(), "sinkType", { scope: "basin", sinkBaseId: "cab-1" })).toBe("None");
    expect(getAttributeValue(store.getState(), "VesselColor", { scope: "basin", sinkBaseId: "cab-1" })).toBe("");
    const style = getAttributeValue(store.getState(), "CountertopStyle", { scope: "countertop" });
    expect(normalizeOptionValue(tricotMatrixProfile, "CountertopStyle", String(style))).toBe("vessel");
  });

  it.each([
    ["class", classProfile, classRuntimeBindings],
    ["urban-standard-height", ushProfile, ushRuntimeBindings],
  ])("%s: Delete reaches the scene as the placeholder", async (id, profile, bindings) => {
    load(id, profile, bindings);
    const { send, recordOnly } = resolveVesselBasinActionValues(DELETE_CONFIG, profile);
    const { result, calls } = replay(send, recordOnly, bindings);

    expect(await result).toMatchObject({ status: "applied", skipped: [] });
    expect(sentSinkTypes(calls)).toEqual(["Vessel"]);
  });
});
