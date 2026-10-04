import { beforeEach, describe, expect, it } from "vitest";

import { store } from "@/app/store";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { ushRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/ushRuntimeBindingsFixture";
import { resolveRuntimeBinding } from "@/entities/collection";
import type { ConfiguratorGroupCatalog } from "@/entities/collection/model/types";
import { resetConfiguration, setActiveCollectionId, syncCabinets } from "@/entities/configuration";
import type { ProductDatatable } from "@/entities/product/api";
import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";
import {
  addProductPreset,
  reset,
  setActiveCabinetType,
  setActiveProfile,
  setCabinetCatalog,
  setCabinetColor,
  setCabinetColorMaterial,
  setCabinetColorSku,
  setDrawerPanelFluting,
  setHandleGrooveColor,
  setSelectedProductConfig,
} from "@/entities/product/model/store/slice";
import { createTestRuntimePort } from "@/features/playCanvasAdapter";
import type { TestRuntimePort } from "@/features/playCanvasAdapter";

import { changeAttribute } from "../lib/changeAttribute";
import type { ChangeAttributeDeps } from "../lib/changeAttribute";
import { validateChange } from "../lib/validateChange";
import type { AttributeChange } from "../model/types";
import { configuratorColors } from "./configuratorColorsFixture";

const matrix = {
  rows: [
    {
      cabinet_type: "Sink-Base",
      widths_cm: "60|80",
      depths_cm: "46",
      heights_cm: "50|53|56",
      drawer_configs: "1D|2D",
      handles_allowed: "handle_pto|handle_urban_topcut|handle_urban_botcut",
      supports_height: "50|53|56",
      handle_pto_forced_height_cm: "1D:50|2D:50",
      handle_urban_topcut_forced_height_cm: "1D:53|2D:56",
      handle_urban_botcut_forced_height_cm: "2D:56",
      handle_urban_botcut_requires_drawers: "2D",
    },
  ],
} as unknown as ProductDatatable;

const productOptions = () => store.getState().rootStateUI.product.productOptions;

type RunOptions = {
  configurator?: ConfiguratorGroupCatalog | null;
  runtime?: TestRuntimePort;
};

const runChange = (
  change: AttributeChange,
  { configurator = configuratorColors, runtime = createTestRuntimePort() }: RunOptions = {},
) => {
  const deps: ChangeAttributeDeps = {
    getState: () => store.getState(),
    dispatch: (action) => store.dispatch(action),
    runtime: runtime.port,
    flow: "custom",
    configurator,
  };

  return changeAttribute(change, deps);
};

beforeEach(() => {
  store.dispatch(reset());
  store.dispatch(resetConfiguration());
  store.dispatch(setActiveProfile(ushProfile));
  store.dispatch(setActiveCollectionId("urban-standard-height"));
  store.dispatch(setCabinetCatalog(buildCabinetCatalogFromMatrix(matrix, ushProfile)));
  store.dispatch(setActiveCabinetType("Sink-Base"));
  store.dispatch(setSelectedProductConfig({ Drawers: "1D", Handle: "handle_urban_topcut" }));
  store.dispatch(syncCabinets(["runtime-a", "runtime-b"]));
});

describe("changeAttribute for the cabinet colour", () => {
  it("records the colour with the material and finish the rules read, and leaves the SKU to D", async () => {
    store.dispatch(setCabinetColorSku("SKU-KEPT"));
    const runtime = createTestRuntimePort();

    const result = await runChange({ attributeId: "CabinetColor", value: "Bianco LACM", scope: "global" }, { runtime });

    expect(result.status).toBe("applied");
    expect(runtime.calls[0].map(({ attributeId, value }) => [attributeId, value])).toEqual([
      ["CabinetColor", "Bianco LACM"],
    ]);
    expect(productOptions()).toMatchObject({
      CabinetColor: "Bianco LACM",
      CabinetColorMaterial: "LACM",
      CabinetColorFinish: "",
      CabinetColorSku: "SKU-KEPT",
    });
  });

  it("moves a groove in the cabinet colour along in the same set, the product config and the presets", async () => {
    store.dispatch(setCabinetColor("Rovere Naturale"));
    store.dispatch(setHandleGrooveColor("Rovere Naturale"));
    store.dispatch(
      addProductPreset([{ name: "Sink-Base", CabinetColor: "Rovere Naturale", HandleGrooveColor: "Rovere Naturale" }]),
    );
    const runtime = createTestRuntimePort();

    const result = await runChange(
      { attributeId: "CabinetColor", value: "Cepp Stone TKP", scope: "global" },
      { runtime },
    );

    expect(result.status).toBe("applied");
    // The groove is the dependency of the requested colour, sent after it in the same set.
    expect(result.status === "applied" && result.plan.map(({ attributeId, origin }) => [attributeId, origin])).toEqual([
      ["CabinetColor", "requested"],
      ["HandleGrooveColor", "dependency"],
    ]);
    expect(runtime.calls[0].map(({ attributeId, value }) => [attributeId, value])).toEqual([
      ["CabinetColor", "Cepp Stone TKP"],
      ["HandleGrooveColor", "Cepp Stone TKP"],
    ]);
    expect(productOptions()).toMatchObject({
      HandleGrooveColor: "Cepp Stone TKP",
      CabinetColorMaterial: "HPL",
      CabinetColorFinish: "TKP",
    });
    expect(store.getState().rootStateUI.product.selectedProductConfig?.HandleGrooveColor).toBe("Cepp Stone TKP");
    expect(store.getState().rootStateUI.product.productsPresets).toEqual([
      { name: "Sink-Base", CabinetColor: "Cepp Stone TKP", HandleGrooveColor: "Cepp Stone TKP" },
    ]);
  });

  it("leaves a groove of another colour alone", async () => {
    store.dispatch(setCabinetColor("Rovere Naturale"));
    store.dispatch(setHandleGrooveColor("Bianco LACM"));
    const runtime = createTestRuntimePort();

    await runChange({ attributeId: "CabinetColor", value: "Cepp Stone TKP", scope: "global" }, { runtime });

    expect(runtime.calls[0].map(({ attributeId }) => attributeId)).toEqual(["CabinetColor"]);
    expect(productOptions().HandleGrooveColor).toBe("Bianco LACM");
  });

  it("keeps the recorded material when the colour cannot be read", async () => {
    store.dispatch(setCabinetColorMaterial("Essenze"));

    const result = await runChange(
      { attributeId: "CabinetColor", value: "Bianco LACM", scope: "global" },
      { configurator: null },
    );

    expect(result.status).toBe("applied");
    expect(productOptions()).toMatchObject({ CabinetColor: "Bianco LACM", CabinetColorMaterial: "Essenze" });
  });
});

describe("clearing a value the rules made unavailable", () => {
  it("accepts the declared initial value although the catalog does not list it", () => {
    for (const attributeId of ["DrawerPanelFluting", "GrainDirection"]) {
      expect(validateChange({ attributeId, value: "", scope: "cabinet", cabinetId: "cab-1" }, ushProfile)).toEqual({
        ok: true,
      });
    }

    expect(
      validateChange(
        { attributeId: "GrainDirection", value: "GrainDiagonal", scope: "cabinet", cabinetId: "cab-1" },
        ushProfile,
      ),
    ).toMatchObject({ ok: false, kind: "blocked" });
  });

  it("records a cleared fluting as empty while the scene receives None", async () => {
    store.dispatch(setCabinetColorMaterial("HPL"));
    store.dispatch(setDrawerPanelFluting("FlutingVerticalA"));

    const result = await runChange({
      attributeId: "DrawerPanelFluting",
      value: "",
      scope: "cabinet",
      cabinetId: "cab-1",
    });

    expect(result.status).toBe("applied");
    expect(productOptions().DrawerPanelFluting).toBe("");
    expect(resolveRuntimeBinding(ushRuntimeBindings, "DrawerPanelFluting", "", "custom")).toMatchObject({
      patch: { DrawerPanelFluting: "None" },
    });
    expect(resolveRuntimeBinding(ushRuntimeBindings, "GrainDirection", "", "custom")).toMatchObject({
      patch: { GrainDirection: "" },
    });
  });
});
