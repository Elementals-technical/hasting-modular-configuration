import { describe, expect, it, vi } from "vitest";

import registry from "../../../../public/collections/registry.json";
import manifest from "../../../../public/collections/tricot/manifest.json";
import catalog from "../../../../public/collections/tricot/source-catalog.json";
import presets from "../../../../public/collections/tricot/presets.json";
import ui from "../../../../public/collections/tricot/ui.json";
import profile from "../../../../public/collections/tricot/product-profile.json";
import skuProfile from "../../../../public/collections/tricot/sku-profile.json";
import runtimeBindings from "../../../../public/collections/tricot/runtime-bindings.json";
import masterText from "../../../../public/collections/tricot/sources/master.tsv?raw";
import configuratorFixture from "./fixtures/remote/configurator-4.json";
import configurator12Fixture from "./fixtures/remote/configurator-12.json";
import cabinetFixture from "./fixtures/remote/datatable-592.json";
import countertopFixture from "./fixtures/remote/datatable-593.json";
import compositionCsv from "../../../../public/collections/tricot/sources/preset-compositions.csv?raw";
import images from "../../../../public/collections/tricot/sources/model-images.json";
import { importPresetCompositionCsv } from "../lib/importPresetCompositionCsv";
import { tricotProfile } from "./tricotFixtures";
import { buildPendingPresets, importMasterCatalog, parseMasterTable } from "../lib/importMasterCatalog";
import { loadResolvedCollection } from "../lib/loadCollection";
import { resolveCollection } from "../lib/resolveCollection";
import { validatePresetHandoff } from "../lib/validatePresetHandoff";
import { presetsSchema, sourceCatalogSchema } from "../model/schemas";
import { isReadyCollectionData, type CollectionRuntimeDependencies, type RemoteCollectionLoader } from "../model/types";

const root = "https://app.test/collections/";
const masters = presetsSchema.parse(presets);
/** Models left out of the catalog until their PNG is delivered: their public thumbnail returns HTTP 404. */
const hiddenModels = images.missing.map(({ sourceModel }) => sourceModel);
const isShown = ({ sourceModel }: { sourceModel?: string }) => !hiddenModels.includes(sourceModel ?? "");
const modules = [
  {
    name: "Sink-Base",
    widths: [60, 80, 100, 120],
    heights: [40],
    depths: [52],
    drawers: ["1", "2", "1+inner"],
    hasSink: true,
  },
];
const handoff = () =>
  masters.map((preset) => ({
    sourceModel: preset.sourceModel,
    img: "images/approved.jpg",
    basinPositions: [{ cabinetIndex: 0 }],
    presetProducts: [
      { name: "Sink-Base", Width: 60, Height: 40, Depth: 52, Drawers: preset.style.includes("2_drawer") ? "2" : "1" },
    ],
  }));

describe("Tricot source preparation", () => {
  it("reproduces the packaged catalog and pending presets from the archived master", () => {
    const parsed = importMasterCatalog(masterText, "tricot", "TRICOT", catalog.source);
    expect(parsed).toEqual(sourceCatalogSchema.parse(catalog));
    const identity = ({
      id,
      sourceModel,
      title,
      style,
      size,
    }: {
      id: number;
      sourceModel?: string;
      title: string;
      style: string[];
      size: string;
    }) => ({ id, sourceModel, title, style, size });
    expect(buildPendingPresets(parsed).filter(isShown).map(identity)).toEqual(presets.map(identity));
    expect(parsed.rowCount).toBe(185);
    expect(Object.fromEntries(Object.entries(parsed.attributes).map(([key, values]) => [key, values.length]))).toEqual({
      Model: 42,
      Style: 5,
      Conceptsize: 7,
      "Cabinet Color": 23,
      "Cabinet Pattern": 5,
      "Handle Color": 20,
      "Side Panels": 2,
      "Countertop Color": 71,
      "Basin Style": 10,
    });
  });

  it("preserves distinct numbered layouts and stable IDs after model reordering", () => {
    expect(new Set(masters.map(({ id }) => id)).size).toBe(41);
    const reversed = buildPendingPresets({
      ...sourceCatalogSchema.parse(catalog),
      attributes: { ...catalog.attributes, Model: [...catalog.attributes.Model].reverse() },
    });
    expect(
      reversed
        .filter(isShown)
        .map(({ id }) => id)
        .reverse(),
    ).toEqual(masters.map(({ id }) => id));
    const pair = masters.filter(({ sourceModel }) =>
      ["Tricot 40 1DW_40", "Tricot 40 1DW 1_40"].includes(sourceModel ?? ""),
    );
    expect(pair).toHaveLength(2);
    expect(pair[0].style).toEqual(pair[1].style);
    expect(pair[0].id).not.toBe(pair[1].id);
    expect(masters.filter((p) => p.img && !p.availability)).toHaveLength(41);
    expect(hiddenModels).toEqual(["Tricot 79 2DW 1_70"]);
    expect(masters.filter((p) => !isShown(p))).toEqual([]);
  });

  it("parses quotes, embedded separators, CRLF and BOM and rejects malformed quoting", () => {
    expect(parseMasterTable('\uFEFF"A"\t"B"\r\n"a"\t"two\twords\n""quoted"""\r\n')).toEqual([
      ["A", "B"],
      ["a", 'two\twords\n"quoted"'],
    ]);
    expect(() => parseMasterTable('"bad')).toThrow("Unterminated");
    expect(() => parseMasterTable('"closed"extra')).toThrow("Malformed");
    expect(() => importMasterCatalog("bad\theader", "tricot", "TRICOT", "test")).toThrow("headers");
  });

  it("imports all 42 explicit recipes and 88 modules with basin positions and stable image mappings", () => {
    // Every source recipe imports, the hidden model's too; the catalog shows the others.
    const sourcePresets = presetsSchema.parse(buildPendingPresets(sourceCatalogSchema.parse(catalog)));
    const entries = importPresetCompositionCsv(compositionCsv, sourcePresets, tricotProfile);
    expect(entries).toHaveLength(42);
    expect(entries.reduce((sum, e) => sum + e.presetProducts.length, 0)).toBe(88);
    const shownEntries = entries.filter(isShown);
    for (const entry of shownEntries) {
      const preset = masters.find((p) => p.sourceModel === entry.sourceModel);
      expect(preset?.presetProducts).toEqual(entry.presetProducts);
      expect(entry.basinPositions).toEqual(
        entry.presetProducts.flatMap((p, cabinetIndex) => (p.name === "Sink-Base" ? [{ cabinetIndex }] : [])),
      );
    }
    expect(images.models).toHaveLength(41);
    expect(images.missing).toHaveLength(1);
    for (const model of images.models) {
      expect(masters.find((p) => p.sourceModel === model.sourceModel)?.img).toBe(model.path);
    }
    const modules =
      tricotProfile.ruleData.cabinetModules?.map((m) => ({
        name: m.cabinetType,
        widths: m.widthsCm,
        heights: m.heightsCm,
        depths: m.depthsCm,
        drawers: m.drawerValues,
        hasSink: m.hasSink,
      })) ?? [];
    expect(validatePresetHandoff(masters, shownEntries, modules)).toEqual([]);
  });

  it("rejects missing recipes, repeated positions, unsupported choices and mixed drawer groups", () => {
    const first = masters[0];
    const rows = parseMasterTable(compositionCsv, ",");
    const headers = rows[0];
    const quote = (row: string[]) => row.map((c) => `"${c.replaceAll('"', '""')}"`).join(",");
    const row = rows.find((c) => c[headers.indexOf("model")] === first.sourceModel);
    if (!row) throw new Error("Missing fixture row");
    const csv = (body: string[][]) => [headers, ...body].map(quote).join("\n");
    expect(() => importPresetCompositionCsv(csv([]), [first], tricotProfile)).toThrow("Missing source model");
    expect(() => importPresetCompositionCsv(csv([row, row]), [first], tricotProfile)).toThrow("position");
    const set = (key: string, value: string) => row.map((c, i) => (i === headers.indexOf(key) ? value : c));
    expect(() => importPresetCompositionCsv(csv([set("Width", "56")]), [first], tricotProfile)).toThrow(
      "Unsupported module",
    );
    expect(() => importPresetCompositionCsv(csv([set("CabinetPattern", "Loden")]), [first], tricotProfile)).toThrow(
      "Incompatible cabinet pattern",
    );
    const second = set("Drawers", "2D");
    second[headers.indexOf("position")] = "2";
    expect(() => importPresetCompositionCsv(csv([row, second]), [first], tricotProfile)).toThrow("Mixed drawer groups");
  });

  it("loads the approved partial scene bindings and 592/593 matrices, and opens with its own configurator 12", async () => {
    const documents: Record<string, unknown> = {
      "manifest.json": manifest,
      "presets.json": presets,
      "source-catalog.json": catalog,
      "ui.json": ui,
      "product-profile.json": profile,
      "sku-profile.json": skuProfile,
      "runtime-bindings.json": runtimeBindings,
    };
    const remote = {
      loadConfigurator: vi.fn<RemoteCollectionLoader["loadConfigurator"]>(async (reference) => {
        if (reference?.id === 12) return configurator12Fixture;
        throw new Error(`Unexpected configurator: ${reference?.id}`);
      }),
      loadCabinetTable: vi.fn(async () => cabinetFixture),
      loadCountertopTable: vi.fn(async () => countertopFixture),
    };
    const dependencies: CollectionRuntimeDependencies = {
      registryUrl: root + "registry.json",
      collectionsRootUrl: root,
      registry,
      fetchJson: async (url) => documents[url.replace(root + "tricot/", "")],
      remote,
    };
    const resolution = resolveCollection({ registry, urlCollectionId: "tricot" });
    if (!resolution.ok) throw new Error("Tricot must resolve");
    const data = await loadResolvedCollection(resolution, dependencies, new AbortController().signal);
    expect(data.id).toBe("tricot");
    expect(data.catalog.presets).toHaveLength(41);
    expect(data.catalog.sourceCatalog).toEqual(catalog);
    expect(data.catalog.runtimeBindings?.productTypes).toEqual({
      "Sink-Base": "Tricot-sink-cabinet",
      "Side-Cabinet": "Tricot-side-cabinet",
    });
    expect(data.catalog.runtimeBindings?.strictProductConfig).toBe(true);
    expect(data.catalog.navigation?.prebuilt.map(({ id }) => id)).toEqual([
      "model",
      "color",
      "side-panels",
      "countertop",
      "summary",
    ]);
    expect(data.catalog.navigation?.custom.map(({ id }) => id)).toEqual([
      "cabinet-builder",
      "color",
      "side-panels",
      "countertop",
      "summary",
    ]);
    // Not staged, and its own configurator 12 lets the collection open; the profile keeps its colour lists.
    expect(data.manifest.availability).toBeUndefined();
    expect(isReadyCollectionData(data)).toBe(true);
    expect(remote.loadConfigurator).toHaveBeenCalledWith(expect.objectContaining({ id: 12 }), expect.any(AbortSignal));
    expect(remote.loadCabinetTable).toHaveBeenCalledWith(592, expect.any(AbortSignal));
    expect(remote.loadCountertopTable).toHaveBeenCalledWith(593, expect.any(AbortSignal));
    expect(data.catalog.productProfile?.countertopRules).toHaveLength(12);
    expect(data.catalog.cabinets?.typeCabinetRules.map((rule) => rule.code)).toEqual(["Sink-Base", "Side-Cabinet"]);
    expect(registry.defaultCollectionId).toBe("urban-standard-height");
  });

  it("requires exact handoff coverage and rejects empty recipes, bad dimensions, styles and basin positions", () => {
    const entries = handoff();
    expect(validatePresetHandoff(masters, entries.slice(1), modules)).toContain(
      `Missing source model: ${entries[0].sourceModel}`,
    );
    expect(validatePresetHandoff(masters, [...entries, entries[0]], modules)).toContain(
      `Duplicate source model: ${entries[0].sourceModel}`,
    );
    expect(validatePresetHandoff(masters, [{ ...entries[0], sourceModel: "unknown" }], modules)).toContain(
      "Unknown source model: unknown",
    );
    expect(validatePresetHandoff(masters.slice(0, 1), [entries[0]], modules)).toEqual([]);
    expect(
      validatePresetHandoff(masters.slice(0, 1), [{ ...entries[0], presetProducts: [] }], modules).length,
    ).toBeGreaterThan(0);
    const invalid = {
      ...entries[0],
      presetProducts: [{ ...entries[0].presetProducts[0], Height: 56, Drawers: "3" }],
      basinPositions: [{ cabinetIndex: 1 }],
    };
    expect(validatePresetHandoff(masters.slice(0, 1), [invalid], modules)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Unsupported module"),
        expect.stringContaining("Drawer filter mismatch"),
        expect.stringContaining("Invalid basin position"),
      ]),
    );
  });

  it("rejects a pending model without staging and a configurator its profile does not name", async () => {
    const resolution = resolveCollection({ registry, urlCollectionId: "tricot" });
    if (!resolution.ok) throw new Error("Tricot must resolve");
    const documents: Record<string, unknown> = {
      "source-catalog.json": catalog,
      "ui.json": ui,
      "product-profile.json": profile,
      "sku-profile.json": skuProfile,
      "runtime-bindings.json": runtimeBindings,
    };
    const check = (changedManifest: unknown, changedPresets: unknown = presets) =>
      loadResolvedCollection(
        resolution,
        {
          registryUrl: root + "registry.json",
          collectionsRootUrl: root,
          registry,
          fetchJson: async (url) =>
            url.endsWith("manifest.json")
              ? changedManifest
              : url.endsWith("presets.json")
                ? changedPresets
                : documents[url.replace(root + "tricot/", "")],
          remote: {
            loadConfigurator: async () => configuratorFixture,
            loadCabinetTable: vi.fn(async () => cabinetFixture),
            loadCountertopTable: vi.fn(async () => countertopFixture),
          },
        },
        new AbortController().signal,
      );
    // A model still waiting for its picture needs a staged collection.
    const pendingImage = [
      { ...presets[0], img: "", availability: { status: "pending-image", reason: "The thumbnail returned HTTP 404." } },
      ...presets.slice(1),
    ];
    await expect(check(manifest, pendingImage)).rejects.toThrow("Pending presets require");
    await expect(check({ ...manifest, remote: { configurator: { id: 4 } } })).rejects.toThrow(
      "source identities disagree",
    );
  });
});

/** Every file of the collection's image folder, keyed by its path from the collection folder. */
const shippedImages = new Set(
  Object.keys(import.meta.glob("/public/collections/tricot/images/**/*", { query: "?url" })).map((path) =>
    path.replace("/public/collections/tricot/", ""),
  ),
);

describe("Tricot basin pictures", () => {
  it("shows the Class basin pictures, which have none for VA023, and ships each", () => {
    const pictures: Record<string, string> = ui.optionImages.sinkType;
    const basins = tricotProfile.attributes.find(({ attributeId }) => attributeId === "sinkType")?.options ?? [];

    expect(basins.filter(({ value }) => !pictures[value]).map(({ value }) => value)).toEqual(["VA023"]);
    for (const picture of Object.values(pictures)) expect(shippedImages.has(picture), picture).toBe(true);
  });
});
