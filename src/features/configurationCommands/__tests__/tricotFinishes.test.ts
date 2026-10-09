import { beforeEach, describe, expect, it } from "vitest";
import { store } from "@/app/store";
import {
  tricotConfigurator,
  tricotProfile,
  tricotSkuProfile,
  tricotTestBindings,
  tricotUi,
} from "@/entities/collection/__tests__/tricotFixtures";
import {
  getAttributeValue,
  getCabinetEntries,
  resetConfiguration,
  setActiveCollectionId,
  syncCabinets,
} from "@/entities/configuration";
import {
  reset,
  setActiveProfile,
  setCabinetCatalog,
  setCabinetColorMaterial,
} from "@/entities/product/model/store/slice";
import { buildCabinetCatalogFromProfile } from "@/entities/product/lib/matrixCabinet";
import { flutingRule } from "@/features/configurator-rule-core/options/rules/flutingRule";
import { resolveSectionFields } from "@/features/collectionCustomization/lib/resolveSectionState";
import { createTestRuntimePort } from "@/features/playCanvasAdapter";
import {
  createPlayCanvasRuntimePort,
  type SceneBridge,
} from "@/features/playCanvasAdapter/lib/createPlayCanvasRuntimePort";
import { buildCollectionCabinetSku } from "@/shared/lib/sku/buildCollectionSkus";
import type { ScenePatch } from "@/entities/collection";
import { changeAttribute } from "../lib/changeAttribute";

beforeEach(() => {
  store.dispatch(reset());
  store.dispatch(resetConfiguration());
  store.dispatch(setActiveProfile(tricotProfile));
  store.dispatch(setActiveCollectionId("tricot"));
  store.dispatch(setCabinetCatalog(buildCabinetCatalogFromProfile(tricotProfile, tricotTestBindings)));
  store.dispatch(syncCabinets(["test-tricot-sb-1", "test-tricot-sc-2"]));
});
const first = () => getCabinetEntries(store.getState())[0].stableKey;
const readPattern = () =>
  getAttributeValue(store.getState(), "DrawerPanelFluting", { scope: "cabinet", cabinetId: first() });
const deps = (runtime = createTestRuntimePort().port, flow: "prebuilt" | "custom" = "custom") => ({
  getState: () => store.getState(),
  dispatch: store.dispatch,
  runtime,
  flow,
  configurator: tricotConfigurator,
});

describe("Tricot finishes through fields, commands and runtime", () => {
  it.each(["LACM", "WDV"])("renders and gates each of the five patterns for %s", async (material) => {
    store.dispatch(setCabinetColorMaterial(material));
    const availability = flutingRule({ material }, tricotProfile);
    const allowedValues = availability.options.filter(({ enabled }) => enabled).map(({ value }) => value);
    const fields = resolveSectionFields(
      tricotUi,
      "cabinet-pattern",
      tricotProfile,
      {},
      { "DrawerPanelFluting.available": { ...availability, allowedValues } },
    );
    expect(fields[0].field.options.filter(({ enabled }) => enabled).map(({ value }) => value)).toEqual(
      material === "LACM" ? ["Loden"] : ["Cannette", "Twill", "Gessato", "Satin"],
    );
    for (const option of availability.options) {
      const result = await changeAttribute(
        { attributeId: "DrawerPanelFluting", scope: "cabinet", cabinetId: first(), value: option.value },
        deps(),
      );
      expect(result.status).toBe(option.enabled ? "applied" : "blocked");
    }
  });

  it.each(["prebuilt", "custom"] as const)(
    "resolves an incompatible pattern in %s through the real adapter and preserves compatible choices",
    async (flow) => {
      const patches: ScenePatch[] = [];
      const scene: SceneBridge = {
        isReady: () => true,
        apply: async (_selector, patch) => {
          patches.push(patch);
          return { status: "applied", updatedIds: [] };
        },
      };
      const d = deps(createPlayCanvasRuntimePort({ getBindings: () => tricotTestBindings, scene }), flow);
      expect(
        (await changeAttribute({ attributeId: "CabinetColor", scope: "global", value: "Antracite 400 MT" }, d)).status,
      ).toBe("applied");
      expect(readPattern()).toBe("Loden");
      expect(
        (await changeAttribute({ attributeId: "CabinetColor", scope: "global", value: "Noce Canaletto 933" }, d))
          .status,
      ).toBe("applied");
      expect(readPattern()).toBe("Cannette");
      expect(
        (
          await changeAttribute(
            { attributeId: "DrawerPanelFluting", scope: "cabinet", cabinetId: first(), value: "Twill" },
            d,
          )
        ).status,
      ).toBe("applied");
      const before = patches.length;
      await changeAttribute({ attributeId: "CabinetColor", scope: "global", value: "Rovere Oro 932" }, d);
      expect(readPattern()).toBe("Twill");
      expect(patches.slice(before).some((patch) => "test:DrawerPanelFluting" in patch)).toBe(false);
      expect(patches.some((patch) => patch["test:DrawerPanelFluting"] === "Cannette")).toBe(true);
      expect(
        (await changeAttribute({ attributeId: "HandleGrooveColor", scope: "global", value: "Zafferano 412 MT" }, d))
          .status,
      ).toBe("applied");
      expect(patches.at(-1)).toEqual({ "test:HandleGrooveColor": "Zafferano 412 MT" });
    },
  );

  it("normalizes the source Cannete alias and refuses invalid pattern SKUs before any resolver can supply a price", async () => {
    store.dispatch(setCabinetColorMaterial("WDV"));
    expect(
      (
        await changeAttribute(
          { attributeId: "DrawerPanelFluting", scope: "cabinet", cabinetId: first(), value: "Cannete" },
          deps(),
        )
      ).status,
    ).toBe("applied");
    const result = buildCollectionCabinetSku(tricotSkuProfile, tricotProfile, {
      read: (id) =>
        (
          ({
            CabinetType: "Sink-Base",
            Drawers: "1",
            DrawerPanelFluting: "Loden",
            CabinetColor: "Noce Canaletto 933",
            HandleGrooveColor: "Antracite 400 MT",
          }) as Record<string, string>
        )[id] ?? null,
      widthCm: 60,
      heightCm: 40,
      depthCm: 52,
    });
    expect(result.sku).toBe("");
    expect(result.missing).toContainEqual({ attributeId: "DrawerPanelFluting", cause: "invalid-option" });
  });

  // The palettes are configurator 12's, as Class's are its configurator's: the profile lists no colours.
  it("offers the palettes of configurator 12 with their materials, hex and SKU", () => {
    const cabinetColors = resolveSectionFields(tricotUi, "cabinet-color", tricotProfile, {}, {}, tricotConfigurator)[0]
      .field.options;
    expect(cabinetColors).toHaveLength(23);
    expect(
      resolveSectionFields(tricotUi, "groove-color", tricotProfile, {}, {}, tricotConfigurator)[0].field.options,
    ).toHaveLength(20);
    expect(cabinetColors.find(({ value }) => value === "Nero 433 MT")).toMatchObject({
      desc: "Lacquered MT",
      traits: { sku: "LACM", hex: "#1f1f20" },
    });
    expect(cabinetColors.find(({ value }) => value === "Rovere Oro 932")).toMatchObject({
      desc: "Wood Veneer",
      traits: { sku: "WDV" },
    });
    // Without the configurator there is no palette: the profile no longer repeats it.
    expect(resolveSectionFields(tricotUi, "cabinet-color", tricotProfile, {}, {})[0].field.options).toEqual([]);
  });
});
