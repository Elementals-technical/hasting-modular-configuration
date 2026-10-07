import { beforeEach, describe, expect, it } from "vitest";
import { store } from "@/app/store";
import {
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
import {
  resolveSectionFields,
  resolveConfiguratorOptions,
} from "@/features/collectionCustomization/lib/resolveSectionState";
import { createTestRuntimePort } from "@/features/playCanvasAdapter";
import {
  createPlayCanvasRuntimePort,
  type SceneBridge,
} from "@/features/playCanvasAdapter/lib/createPlayCanvasRuntimePort";
import { buildCollectionCabinetSku } from "@/shared/lib/sku/buildCollectionSkus";
import type { ScenePatch } from "@/entities/collection";
import type { ConfiguratorGroupCatalog } from "@/entities/collection/model/types";
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
        (
          await changeAttribute(
            { attributeId: "HandleGrooveColor", scope: "cabinet", cabinetId: first(), value: "Zafferano 412 MT" },
            d,
          )
        ).status,
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

  it("offers closed source palettes and restricts broader external catalogs without discarding metadata", () => {
    expect(resolveSectionFields(tricotUi, "cabinet-color", tricotProfile, {}, {})[0].field.options).toHaveLength(23);
    expect(resolveSectionFields(tricotUi, "groove-color", tricotProfile, {}, {})[0].field.options).toHaveLength(20);
    const profile = {
      ...tricotProfile,
      attributes: tricotProfile.attributes.map((attribute) =>
        attribute.attributeId === "CabinetColor"
          ? { ...attribute, optionsSource: "configurator:test-palettes" }
          : attribute,
      ),
    };
    const group: ConfiguratorGroupCatalog["groups"][number] = {
      id: 1,
      proxyName: "test-palettes",
      proxyType: "material",
      enabled: true,
      metadata: {},
      options: [
        {
          id: 2,
          name: "palette",
          resource: null,
          paramString: null,
          playcanvasString: null,
          variants: ["Noce Canaletto 933", "Foreign 999"].map((name, index) => ({
            id: index + 3,
            name,
            image: null,
            enabled: true,
            description: "",
            metadata: { sku: "WDV", Material: "Wood Veneer", hex: "#aabbcc", image: "texture.jpg" },
          })),
        },
      ],
    };
    const options = resolveConfiguratorOptions(profile, "CabinetColor", {
      groups: [group],
      groupsByName: { "test-palettes": group },
    });
    expect(options.map(({ value }) => value)).toEqual(["Noce Canaletto 933"]);
    expect(options[0]).toMatchObject({
      image: "texture.jpg",
      traits: { sku: "WDV", materials: ["Wood Veneer"], hex: "#aabbcc" },
    });
  });
});
