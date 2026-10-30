import { describe, expect, it } from "vitest";

import type { SceneLayout, StableCabinetKey } from "@/entities/configuration";

import { NO_DIFFERENCE, planHistoryMove } from "../lib/planHistoryMove";
import type { SceneSnapshot } from "../model/store/slice";

/**
 * Two snapshots of a Mako composition, `current` (what the scene shows now) and `target` (where undo/redo goes).
 * Every test starts from equal snapshots and changes only the parts it is about.
 */

type TestProduct = { stableKey: StableCabinetKey; runtimeId: string };

const SINK: TestProduct = { stableKey: "cab-1", runtimeId: "Mako-sink-cabinet-aaa111" };
const SIDE: TestProduct = { stableKey: "cab-2", runtimeId: "Mako-side-cabinet-bbb222" };
// The same products after a full rebuild: new runtime ids, the same stable keys.
const SINK_REBUILT: TestProduct = { stableKey: "cab-1", runtimeId: "Mako-sink-cabinet-ccc333" };
const SIDE_REBUILT: TestProduct = { stableKey: "cab-2", runtimeId: "Mako-side-cabinet-ddd444" };

const METAL_ORGANIZERS = { version: 1, Bot: { style: "Metal", columns: [{ slot: 0, positions: [2] }] } };
const OAK_ORGANIZERS = {
  version: 1,
  Top: { style: "Oak", columns: [{ slot: -1, positions: [1, 3] }] },
  Bot: { style: "Oak", columns: [{ slot: 1, positions: [4] }] },
};

const PRODUCT_OPTIONS: SceneSnapshot["productOptions"] = {
  CabinetColor: "Rovere Naturale",
  CabinetColorSku: "RN",
  CabinetColorMaterial: "Wood",
  CabinetColorFinish: "Matte",
  sinkType: "Undermount",
  CountertopColor: "Bianco",
  CountertopColorSku: "BI",
  VesselColor: "",
  HandleGrooveColor: "",
  HandleGrooveColorSku: "",
  Handle: "Push",
  Thickness: "12",
  DrawerPanelFluting: "",
  GrainDirection: "Horizontal",
  BookMatching: "",
  CountertopStyle: "Solid",
  SidePanels: "None",
  SidePanelLeft: "none",
  SidePanelRight: "none",
  LedOption: "None",
  DividersOption: "Yes",
  DividersStyle: "Metal",
  TowelBarOption: "None",
  TowelBarColor: "",
  FaucetHolesAmount: "1",
  FaucetHolesSpacing: "",
};

/** A product config as the scene reports it; `fields` adds or replaces fields (DrawerOrganizers, Width…). */
const productConfig = (product: TestProduct, fields: Record<string, unknown> = {}): Record<string, unknown> => ({
  entityName: product.runtimeId,
  Width: 60,
  Drawers: "2D",
  positionX: 0.3,
  positionY: 0,
  positionZ: -0.25,
  ...fields,
});

/** Where the products stood: the scene's document names them by runtime id in places. */
const layoutOf = (products: TestProduct[]): SceneLayout => ({
  version: 1,
  document: {
    presetSchemaVersion: 2,
    collection: { id: "Mako" },
    presetProducts: products.map((_product, index) => ({ key: `cabinet${index}`, definitionId: "Mako-cabinet" })),
    presetLayout: {
      layoutMode: "exact",
      rows: [{ cabinets: products.map((product) => product.runtimeId) }],
      countertop: { hostId: products[0].runtimeId, lengthM: 1.2 },
    },
  },
  cabinetIds: Object.fromEntries(products.map((product, index) => [`cabinet${index}`, product.runtimeId])),
});

type SnapshotOptions = Partial<SceneSnapshot> & {
  products?: TestProduct[];
  /** Extra config fields of a product, by stable key. */
  configs?: Record<StableCabinetKey, Record<string, unknown>>;
};

/** A snapshot of `products` (one sink by default); any other field of the snapshot can be replaced. */
function makeSnapshot({ products = [SINK], configs = {}, ...fields }: SnapshotOptions = {}): SceneSnapshot {
  return {
    productIds: products.map((product) => product.runtimeId),
    productConfigs: Object.fromEntries(
      products.map((product) => [product.runtimeId, productConfig(product, configs[product.stableKey])]),
    ),
    cabinetKeys: Object.fromEntries(products.map((product) => [product.runtimeId, product.stableKey])),
    configuration: {
      collectionId: "Mako",
      version: 2,
      cabinets: products.map((product, index) => ({ ...product, index })),
      values: {
        HandleFinish: [{ target: { scope: "global" }, value: "Matte" }],
        SidePanels: [{ target: { scope: "global" }, value: "None" }],
        DividersOption: [{ target: { scope: "global" }, value: "Yes" }],
      },
    },
    productsPresets: [{ name: "Mako Sink Base", Width: 60 }],
    productOptions: { ...PRODUCT_OPTIONS },
    activeCabinetType: "sink",
    selectedDimensions: { width: 60, height: 50, depth: 46 },
    placedDividers: [],
    selectedProductConfig: null,
    placedCabinetStyles: Object.fromEntries(products.map((product) => [product.runtimeId, "1"])),
    ...fields,
  };
}

/** The values of a snapshot with one attribute replaced. */
const withValue = (snapshot: SceneSnapshot, attributeId: string, value: string) => ({
  ...snapshot.configuration!,
  values: { ...snapshot.configuration!.values, [attributeId]: [{ target: { scope: "global" as const }, value }] },
});

describe("planHistoryMove: organizers-only moves", () => {
  it("replays a product whose organizers changed with the target's value", () => {
    const current = makeSnapshot({ configs: { "cab-1": { DrawerOrganizers: METAL_ORGANIZERS } } });
    const target = makeSnapshot({ configs: { "cab-1": { DrawerOrganizers: OAK_ORGANIZERS } } });

    expect(planHistoryMove(current, target)).toEqual({
      kind: "organizers",
      writes: [{ stableKey: "cab-1", runtimeId: SINK.runtimeId, state: OAK_ORGANIZERS, drawers: ["Top", "Bot"] }],
      values: null,
      productOptions: null,
    });
  });

  it("clears the organizers when the target has no key, and writes them when only the target has one", () => {
    const withOrganizers = makeSnapshot({ configs: { "cab-1": { DrawerOrganizers: METAL_ORGANIZERS } } });
    const withoutKey = makeSnapshot();

    expect(planHistoryMove(withOrganizers, withoutKey)).toMatchObject({
      kind: "organizers",
      writes: [{ stableKey: "cab-1", runtimeId: SINK.runtimeId, state: null }],
    });
    expect(planHistoryMove(withoutKey, withOrganizers)).toMatchObject({
      kind: "organizers",
      writes: [{ stableKey: "cab-1", runtimeId: SINK.runtimeId, state: METAL_ORGANIZERS }],
    });
  });

  it("matches products by stable key after a rebuild gave them new runtime ids", () => {
    const snapshotOf = (sink: TestProduct, side: TestProduct, organizers: unknown) =>
      makeSnapshot({
        products: [sink, side],
        configs: { "cab-1": { DrawerOrganizers: organizers } },
        sceneLayout: layoutOf([sink, side]),
        placedDividers: [
          { key: "candidate:Bot:main", cabinetId: side.runtimeId, drawerType: "Bot", zone: "main", type: "A" },
        ],
        selectedProductConfig: productConfig(sink, { DrawerOrganizers: organizers }),
      });
    const current = snapshotOf(SINK_REBUILT, SIDE_REBUILT, METAL_ORGANIZERS);
    const target = snapshotOf(SINK, SIDE, OAK_ORGANIZERS);

    expect(planHistoryMove(current, target)).toEqual({
      kind: "organizers",
      writes: [
        { stableKey: "cab-1", runtimeId: SINK_REBUILT.runtimeId, state: OAK_ORGANIZERS, drawers: ["Top", "Bot"] },
      ],
      values: null,
      productOptions: null,
    });
  });

  it("writes only the product whose columns changed", () => {
    const current = makeSnapshot({
      products: [SINK, SIDE],
      configs: { "cab-1": { DrawerOrganizers: METAL_ORGANIZERS }, "cab-2": { DrawerOrganizers: METAL_ORGANIZERS } },
    });
    const target = makeSnapshot({
      products: [SINK, SIDE],
      configs: { "cab-1": { DrawerOrganizers: METAL_ORGANIZERS }, "cab-2": { DrawerOrganizers: OAK_ORGANIZERS } },
    });

    expect(planHistoryMove(current, target)).toMatchObject({
      kind: "organizers",
      writes: [{ stableKey: "cab-2", runtimeId: SIDE.runtimeId, state: OAK_ORGANIZERS }],
    });
  });

  it("names the drawers whose set changed, so the view can follow the change", () => {
    const topOnly = { version: 1, Top: { style: "Metal", columns: [{ slot: 0, positions: [] }] } };
    const both = { ...topOnly, Bot: { style: "Metal", columns: [{ slot: 1, positions: [] }] } };
    const planOf = (from: unknown, to: unknown) =>
      planHistoryMove(
        makeSnapshot({ configs: { "cab-1": { DrawerOrganizers: from } } }),
        makeSnapshot({ configs: { "cab-1": { DrawerOrganizers: to } } }),
      );

    expect(planOf(topOnly, both)).toMatchObject({ writes: [{ drawers: ["Bot"] }] });
    expect(planOf(both, topOnly)).toMatchObject({ writes: [{ drawers: ["Bot"] }] });
    expect(planOf(undefined, both)).toMatchObject({ writes: [{ drawers: ["Top", "Bot"] }] });
    expect(planOf(topOnly, { ...topOnly, Top: { ...topOnly.Top, style: "Oak" } })).toMatchObject({
      writes: [{ drawers: ["Top"] }],
    });
  });

  it("carries the organizer product options and configuration values the move changes", () => {
    const current = makeSnapshot({ configs: { "cab-1": { DrawerOrganizers: METAL_ORGANIZERS } } });
    const noneStep = makeSnapshot({ productOptions: { ...PRODUCT_OPTIONS, DividersOption: "None" } });
    const target = { ...noneStep, configuration: withValue(noneStep, "DividersOption", "None") };

    expect(planHistoryMove(current, target)).toEqual({
      kind: "organizers",
      writes: [{ stableKey: "cab-1", runtimeId: SINK.runtimeId, state: null, drawers: ["Bot"] }],
      values: target.configuration.values,
      productOptions: { DividersOption: "None" },
    });
  });

  it("takes the fast path when only an organizer product option changes", () => {
    const current = makeSnapshot();
    const target = makeSnapshot({ productOptions: { ...PRODUCT_OPTIONS, DividersOption: "None" } });

    expect(planHistoryMove(current, target)).toEqual({
      kind: "organizers",
      writes: [],
      values: null,
      productOptions: { DividersOption: "None" },
    });
  });

  it("ignores a position moved within the tolerance and rebuilds for one moved farther", () => {
    const current = makeSnapshot({ configs: { "cab-1": { DrawerOrganizers: METAL_ORGANIZERS } } });
    const nearby = makeSnapshot({ configs: { "cab-1": { DrawerOrganizers: OAK_ORGANIZERS, positionX: 0.3 + 5e-5 } } });
    const farther = makeSnapshot({ configs: { "cab-1": { DrawerOrganizers: OAK_ORGANIZERS, positionX: 0.3 + 1e-3 } } });

    expect(planHistoryMove(current, nearby).kind).toBe("organizers");
    expect(planHistoryMove(current, farther)).toEqual({ kind: "full", reason: "config:positionX" });
  });

  it("reads a numeric option a rebuild gave back as a string as the same value", () => {
    // After a rebuild the replay leaves `Thickness: "0.5"` where a placed product holds `0.5`.
    const current = makeSnapshot({ configs: { "cab-1": { DrawerOrganizers: METAL_ORGANIZERS, Thickness: "0.5" } } });
    const target = makeSnapshot({ configs: { "cab-1": { DrawerOrganizers: OAK_ORGANIZERS, Thickness: 0.5 } } });
    const other = makeSnapshot({ configs: { "cab-1": { DrawerOrganizers: OAK_ORGANIZERS, Thickness: "0.75" } } });
    const text = makeSnapshot({ configs: { "cab-1": { DrawerOrganizers: OAK_ORGANIZERS, Thickness: "thin" } } });

    expect(planHistoryMove(current, target).kind).toBe("organizers");
    expect(planHistoryMove(current, other)).toEqual({ kind: "full", reason: "config:Thickness" });
    expect(planHistoryMove(current, text)).toEqual({ kind: "full", reason: "config:Thickness" });
  });

  it("does not let the selected product's organizers block the fast path", () => {
    const snapshotWith = (organizers: unknown) =>
      makeSnapshot({
        configs: { "cab-1": { DrawerOrganizers: organizers } },
        selectedProductConfig: productConfig(SINK, { DrawerOrganizers: organizers }),
      });

    expect(planHistoryMove(snapshotWith(METAL_ORGANIZERS), snapshotWith(OAK_ORGANIZERS)).kind).toBe("organizers");
  });

  it("treats two snapshots without a configuration as equal in it", () => {
    const current = makeSnapshot({
      configuration: undefined,
      configs: { "cab-1": { DrawerOrganizers: METAL_ORGANIZERS } },
    });
    const target = makeSnapshot({ configuration: undefined });

    expect(planHistoryMove(current, target)).toMatchObject({ kind: "organizers", values: null });
  });
});

describe("planHistoryMove: moves that rebuild the scene", () => {
  const organizersChange = { "cab-1": { DrawerOrganizers: OAK_ORGANIZERS } };

  it("rebuilds for a changed product config field", () => {
    const current = makeSnapshot();
    const target = makeSnapshot({ configs: { "cab-1": { ...organizersChange["cab-1"], Width: 80 } } });

    const plan = planHistoryMove(current, target);

    expect(plan.kind).toBe("full");
    expect(plan).toMatchObject({ reason: expect.stringContaining("Width") });
  });

  it("rebuilds for any product option other than the organizer ones", () => {
    const current = makeSnapshot();
    const target = makeSnapshot({
      configs: organizersChange,
      productOptions: { ...PRODUCT_OPTIONS, CabinetColor: "Noce Scuro" },
    });

    expect(planHistoryMove(current, target)).toEqual({ kind: "full", reason: "productOptions:CabinetColor" });
  });

  it("rebuilds for a changed configuration value other than the organizer ones", () => {
    const current = makeSnapshot();
    const changedOrganizerValue = { ...current, configuration: withValue(current, "DividersOption", "None") };
    const changedSidePanels = { ...current, configuration: withValue(current, "SidePanels", "Left") };

    expect(planHistoryMove(current, changedOrganizerValue)).toEqual({
      kind: "organizers",
      writes: [],
      values: changedOrganizerValue.configuration.values,
      productOptions: null,
    });
    expect(planHistoryMove(current, changedSidePanels)).toEqual({ kind: "full", reason: "values:SidePanels" });
  });

  it("rebuilds when a snapshot cannot name its products by stable key", () => {
    const current = makeSnapshot();
    const withoutKeys = makeSnapshot({ configs: organizersChange, cabinetKeys: undefined });
    const withoutOneKey = makeSnapshot({ configs: organizersChange, cabinetKeys: {} });

    expect(planHistoryMove(current, withoutKeys)).toEqual({ kind: "full", reason: "no-cabinet-keys" });
    expect(planHistoryMove(withoutKeys, current)).toEqual({ kind: "full", reason: "no-cabinet-keys" });
    expect(planHistoryMove(current, withoutOneKey)).toEqual({ kind: "full", reason: "no-cabinet-keys" });
  });

  it("rebuilds when the products differ in number or order", () => {
    const current = makeSnapshot({ products: [SINK, SIDE] });
    const fewer = makeSnapshot({ products: [SINK], configs: organizersChange });
    const reordered = makeSnapshot({ products: [SIDE, SINK], configs: organizersChange });

    expect(planHistoryMove(current, fewer)).toEqual({ kind: "full", reason: "products-differ" });
    expect(planHistoryMove(current, reordered)).toEqual({ kind: "full", reason: "products-differ" });
  });

  it("rebuilds when the layout differs or only one snapshot has one", () => {
    const current = makeSnapshot({ products: [SINK, SIDE], sceneLayout: layoutOf([SINK, SIDE]) });
    const otherLayout = layoutOf([SINK, SIDE]);
    otherLayout.document.presetLayout = { layoutMode: "rows" };
    const moved = makeSnapshot({ products: [SINK, SIDE], configs: organizersChange, sceneLayout: otherLayout });
    const withoutLayout = makeSnapshot({ products: [SINK, SIDE], configs: organizersChange });

    expect(planHistoryMove(current, moved)).toEqual({ kind: "full", reason: "sceneLayout" });
    expect(planHistoryMove(current, withoutLayout)).toEqual({ kind: "full", reason: "sceneLayout" });
  });

  it("reads only whole strings of the layout document as runtime ids", () => {
    const layoutWithCaption = (sink: TestProduct) => {
      const layout = layoutOf([sink]);
      layout.document.caption = `${sink.runtimeId} (left wall)`;
      return layout;
    };
    const current = makeSnapshot({ products: [SINK_REBUILT], sceneLayout: layoutWithCaption(SINK_REBUILT) });
    const target = makeSnapshot({ configs: organizersChange, sceneLayout: layoutWithCaption(SINK) });

    expect(planHistoryMove(current, target)).toEqual({ kind: "full", reason: "sceneLayout" });
  });

  it("leaves the selected product's config out: the builder's selection, replaced whole by any rebuild", () => {
    const current = makeSnapshot({ selectedProductConfig: productConfig(SINK) });
    const target = makeSnapshot({
      configs: organizersChange,
      selectedProductConfig: { Drawers: "2D", Handle: "G57" },
    });

    expect(planHistoryMove(current, target).kind).toBe("organizers");
  });

  it("rebuilds when only one snapshot has a configuration", () => {
    const current = makeSnapshot();
    const target = makeSnapshot({ configs: organizersChange, configuration: undefined });

    expect(planHistoryMove(current, target)).toEqual({ kind: "full", reason: "configuration" });
  });

  it("answers no-difference for a move that changes nothing", () => {
    const snapshot = makeSnapshot({ configs: { "cab-1": { DrawerOrganizers: METAL_ORGANIZERS } } });

    expect(planHistoryMove(snapshot, structuredClone(snapshot))).toEqual({ kind: "full", reason: NO_DIFFERENCE });
  });

  it.each([
    ["a malformed set", { version: 1, Top: "x" }],
    ["another data version", { version: 2, Top: { style: "Metal", columns: [{ slot: 0, positions: [1] }] } }],
  ])("rebuilds when the target holds organizers this build cannot read (%s)", (_name, organizers) => {
    const current = makeSnapshot({ configs: { "cab-1": { DrawerOrganizers: METAL_ORGANIZERS } } });
    const target = makeSnapshot({ configs: { "cab-1": { DrawerOrganizers: organizers } } });

    expect(planHistoryMove(current, target)).toEqual({ kind: "full", reason: "organizers-unreadable" });
  });

  it("rebuilds instead of throwing on a snapshot it cannot read", () => {
    const current = makeSnapshot();
    const broken = makeSnapshot({ productConfigs: { [SINK.runtimeId]: null as unknown as Record<string, unknown> } });

    expect(planHistoryMove(current, broken)).toMatchObject({
      kind: "full",
      reason: expect.stringMatching(/^normalize-failed: /),
    });
  });
});

describe("planHistoryMove: inputs", () => {
  it("leaves both snapshots as they were", () => {
    const current = makeSnapshot({
      products: [SINK_REBUILT, SIDE_REBUILT],
      configs: { "cab-1": { DrawerOrganizers: METAL_ORGANIZERS } },
      sceneLayout: layoutOf([SINK_REBUILT, SIDE_REBUILT]),
      selectedProductConfig: productConfig(SINK_REBUILT, { DrawerOrganizers: METAL_ORGANIZERS }),
    });
    const target = makeSnapshot({
      products: [SINK, SIDE],
      configs: { "cab-1": { DrawerOrganizers: OAK_ORGANIZERS } },
      sceneLayout: layoutOf([SINK, SIDE]),
      selectedProductConfig: productConfig(SINK, { DrawerOrganizers: OAK_ORGANIZERS }),
      productOptions: { ...PRODUCT_OPTIONS, DividersStyle: "Oak" },
    });
    const currentBefore = structuredClone(current);
    const targetBefore = structuredClone(target);

    const plan = planHistoryMove(current, target);

    expect(plan.kind).toBe("organizers");
    expect(current).toEqual(currentBefore);
    expect(target).toEqual(targetBefore);
  });
});
