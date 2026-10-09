import { beforeEach, describe, expect, it } from "vitest";
import { store } from "@/app/store";
import { normalizeOptionValue, selectOptions } from "@/entities/collection";
import {
  tricotConfigurator,
  tricotProfile,
  tricotMatrixProfile,
  tricotTestBindings,
  tricotUi,
} from "@/entities/collection/__tests__/tricotFixtures";
import {
  getAttributeValue,
  recordSceneState,
  resetConfiguration,
  setActiveCollectionId,
  setActiveRuntimeBindings,
  setAttributeValue,
  syncCabinets,
} from "@/entities/configuration";
import { reset, setActiveProfile, setCabinetCatalog } from "@/entities/product/model/store/slice";
import cabinetTable from "@/entities/collection/__tests__/fixtures/remote/datatable-592.json";
import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";
import { evaluateCountertopChange } from "@/features/configurationCommands/lib/countertopCompatibility";
import { changeAttribute } from "@/features/configurationCommands/lib/changeAttribute";
import { createTestRuntimePort } from "@/features/playCanvasAdapter";
import { createConfiguratorColorReader } from "@/shared/lib/sku/configuratorColors";
import { resolveConfiguratorOptions, resolveSectionFields } from "../lib/resolveSectionState";

beforeEach(() => {
  store.dispatch(reset());
  store.dispatch(resetConfiguration());
  store.dispatch(setActiveProfile(tricotProfile));
  store.dispatch(setActiveCollectionId("tricot"));
  store.dispatch(setActiveRuntimeBindings(tricotTestBindings));
  store.dispatch(syncCabinets([tricotTestBindings.productTypes["Sink-Base"] + "-1"]));
});

describe("Tricot countertop preparation", () => {
  const withMatrix = (width = 60) => {
    store.dispatch(setActiveProfile(tricotMatrixProfile));
    store.dispatch(
      setCabinetCatalog(buildCabinetCatalogFromMatrix(cabinetTable, tricotMatrixProfile, tricotTestBindings)),
    );
    const id = tricotTestBindings.productTypes["Sink-Base"] + "-1";
    store.dispatch(
      recordSceneState({ order: [id], cabinets: [{ runtimeId: id, dimensions: { width, height: 40, depth: 52 } }] }),
    );
    store.dispatch(
      setAttributeValue({ attributeId: "Drawers", target: { scope: "cabinet", cabinetId: "cab-1" }, value: "1" }),
    );
  };

  it("normalizes the cabinet table alias, forced heights and integrated/inner-drawer restriction", () => {
    const catalog = buildCabinetCatalogFromMatrix(cabinetTable, tricotProfile, tricotTestBindings);
    expect(catalog.typeCabinetRules.map((r) => r.code)).toEqual(["Sink-Base", "Side-Cabinet"]);
    expect(catalog.typeCabinetRules[0].forcedHeightByDrawers).toEqual({ "1": 40, "2": 40, "1+inner": 40 });
    expect(catalog.typeCabinetRules[0].unavailableWithIntegrated).toEqual([{ widthCm: 60, drawers: "1+inner" }]);
  });

  it.each(["prebuilt", "custom"] as const)(
    "applies supplied thickness/basin rules in %s, clearing incompatible scoped basins",
    async (flow) => {
      withMatrix(80);
      const runtime = createTestRuntimePort();
      const deps = {
        getState: store.getState,
        dispatch: store.dispatch,
        runtime: runtime.port,
        flow,
        configurator: tricotConfigurator,
      };
      expect(
        (await changeAttribute({ attributeId: "CountertopColor", scope: "countertop", value: "Matte White" }, deps))
          .status,
      ).toBe("applied");
      expect(store.getState().rootStateUI.product.productOptions.Thickness).toBe("0.5");
      expect(
        (await changeAttribute({ attributeId: "Thickness", scope: "countertop", value: "3.125" }, deps)).status,
      ).toBe("applied");
      expect(
        (await changeAttribute({ attributeId: "sinkType", scope: "basin", sinkBaseId: "cab-1", value: "VA023" }, deps))
          .status,
      ).toBe("applied");
      expect(
        (await changeAttribute({ attributeId: "Thickness", scope: "countertop", value: "0.5" }, deps)).status,
      ).toBe("applied");
      expect(getAttributeValue(store.getState(), "sinkType", { scope: "basin", sinkBaseId: "cab-1" })).toBe("");
      expect((await changeAttribute({ attributeId: "sinkType", scope: "basin", value: "VA023" }, deps)).status).toBe(
        "blocked",
      );
      expect((await changeAttribute({ attributeId: "sinkType", scope: "basin", value: "VA024" }, deps)).status).toBe(
        "blocked",
      );
    },
  );

  it("blocks incompatible widths and drawer pairs before any runtime write", () => {
    withMatrix();
    store.dispatch(
      setAttributeValue({ attributeId: "Drawers", target: { scope: "cabinet", cabinetId: "cab-1" }, value: "1+inner" }),
    );
    expect(
      evaluateCountertopChange(
        { attributeId: "CountertopColor", scope: "countertop", value: "Matte White" },
        { scope: "countertop" },
        store.getState(),
        tricotMatrixProfile,
      ).blocked?.reasonCode,
    ).toBe("change.notAvailable");
    withMatrix(240);
    expect(
      evaluateCountertopChange(
        { attributeId: "CountertopColor", scope: "countertop", value: "Matte White" },
        { scope: "countertop" },
        store.getState(),
        tricotMatrixProfile,
      ).blocked?.reasonCode,
    ).toBe("change.notAvailable");
    withMatrix(60);
    expect(
      evaluateCountertopChange(
        { attributeId: "sinkType", scope: "basin", value: "VA023" },
        { scope: "basin" },
        store.getState(),
        tricotMatrixProfile,
      ).blocked?.reasonCode,
    ).toBe("change.notAvailable");
  });

  it("offers precisely the source materials and ten basins, with no assumed thickness defaults", () => {
    const colors = resolveSectionFields(tricotUi, "countertop-color", tricotProfile, {}, {}, tricotConfigurator)[0]
      .field.options;
    expect(colors).toHaveLength(71);
    expect(
      Object.fromEntries(
        colors.reduce(
          (groups, option) => groups.set(option.desc ?? "", (groups.get(option.desc ?? "") ?? 0) + 1),
          new Map<string, number>(),
        ),
      ),
    ).toEqual({ "Solid Surface": 2, HPL: 14, Porcelain: 15, "Glass MT": 20, "Glass GL": 20 });
    expect(selectOptions(tricotProfile, "sinkType").map(({ value }) => value)).toEqual([
      "LB440",
      "LB175",
      "LB575",
      "LB856",
      "VA023",
      "VA024",
      "LV890",
      "LV892",
      "VA002",
      "VA005",
    ]);
    // In inches and in rising order, as the other collections write them; the table's fractions are aliases.
    expect(selectOptions(tricotProfile, "Thickness").map(({ value, label }) => [value, label])).toEqual([
      ["0.5", '0.5"'],
      ["0.75", '0.8"'],
      ["3.125", '3.1"'],
      ["4", '4"'],
      ["4.75", '4.7"'],
    ]);
    expect(normalizeOptionValue(tricotProfile, "Thickness", "4-3/4")).toBe("4.75");
    expect(tricotUi.steps.countertop.sectionIds).toEqual(["countertop-color", "thickness", "basin-style"]);
  });

  // Configurator 12 spells every colour as the matrix and the price list do; the profile lists none of its own.
  it("takes the 71 countertop colours and their materials from configurator 12", () => {
    expect(selectOptions(tricotProfile, "CountertopColor")).toEqual([]);
    const read = createConfiguratorColorReader(tricotProfile, tricotConfigurator);
    const colours = resolveConfiguratorOptions(tricotProfile, "CountertopColor", tricotConfigurator);

    expect(colours).toHaveLength(71);
    expect(colours.filter(({ desc }) => desc?.startsWith("Glass"))).toHaveLength(40);
    expect(read("CountertopColor", "Grigio Argento 403 MT")).toEqual({ sku: "GLSM", material: "Glass MT" });
    expect(read("CountertopColor", "Matte White 8cm")).toEqual({ sku: "SSTMT", material: "Solid Surface" });
    expect(read("CountertopColor", "Foreign 999")).toBeNull();
  });

  it.each(["prebuilt", "custom"] as const)(
    "blocks unapproved compatibility in %s before sending a scene command",
    async (flow) => {
      const runtime = createTestRuntimePort();
      const deps = { getState: () => store.getState(), dispatch: store.dispatch, runtime: runtime.port, flow };
      expect(
        await changeAttribute({ attributeId: "CountertopColor", scope: "countertop", value: "Matte White 8cm" }, deps),
      ).toMatchObject({ status: "blocked", compatibility: "undetermined", reasonCode: "product.missingData" });
      expect(await changeAttribute({ attributeId: "sinkType", scope: "basin", value: "VA023" }, deps)).toMatchObject({
        status: "blocked",
        compatibility: "undetermined",
      });
      expect(
        (await changeAttribute({ attributeId: "Thickness", scope: "countertop", value: "3.125" }, deps)).status,
      ).toBe("blocked");
      expect(runtime.calls).toEqual([]);
    },
  );
});
