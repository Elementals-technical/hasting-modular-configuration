import { beforeEach, describe, expect, it } from "vitest";

import { store } from "@/app/store";
import {
  recordOrganizers,
  resetConfiguration,
  setAttributeValue,
  syncCabinets,
  type OrganizerApplyResult,
  type ScopedValue,
} from "@/entities/configuration";
import type { DrawerDerived, DrawerName, DrawerOrganizersV1 } from "@/entities/configuration/model/drawerOrganizers";
import { addProductId, reset, resetProducts } from "@/entities/product/model/store/slice";
import { setView } from "@/features/drawerOrganizers/model/store/slice";
import {
  createTestOrganizerPort,
  type TestOrganizerAnswer,
  type TestOrganizerCall,
} from "@/features/playCanvasAdapter";

import type { OrganizersMovePlan } from "../lib/planHistoryMove";
import { restoreOrganizersOnly, viewToFollow, type OrganizerHistoryPort } from "../lib/restoreOrganizersOnly";

/** Placed products; the store gives them the keys cab-1, cab-2, cab-3 in this order. */
const RUNTIME_IDS = ["rt-1", "rt-2", "rt-3"];

const ONE_COLUMN: DrawerOrganizersV1 = {
  version: 1,
  Top: { style: "Metal", columns: [{ slot: 0, positions: [1, 3] }] },
};
const TWO_COLUMNS: DrawerOrganizersV1 = {
  version: 1,
  Bot: {
    style: "Oak",
    columns: [
      { slot: -1, positions: [2] },
      { slot: 1, positions: [2] },
    ],
  },
};

/** What 3D derives for a drawer that offers organizers and holds `count` columns. */
const derivedWith = (count: number): DrawerDerived => ({
  exists: true,
  offered: true,
  role: "single",
  profile: null,
  maxSlot: 2,
  capacity: 5,
  count,
  lock: null,
  candidates: [],
  unavailable: null,
});
const DRAWERS: Record<DrawerName, DrawerDerived> = { Top: derivedWith(1), Bot: derivedWith(0) };

/** The receipt of a `setState` the scene took as sent: it now holds `state` (null: no key). */
const takenAs = (
  runtimeId: string,
  state: DrawerOrganizersV1 | null,
  drawers?: Record<DrawerName, DrawerDerived>,
): OrganizerApplyResult => ({
  status: "applied",
  products: [
    {
      runtimeId,
      entry: state ? { status: "ok", value: state } : { status: "absent" },
      ...(drawers ? { drawers } : {}),
    },
  ],
  corrections: [],
});

/** A row of the fake port's table: a `setState` on this product answers `result`. */
const onSetState = (runtimeId: string, result: OrganizerApplyResult): TestOrganizerAnswer => ({
  match: { kind: "setState", runtimeId },
  result,
});

const organizersPlan = (fields: Partial<OrganizersMovePlan> = {}): OrganizersMovePlan => ({
  kind: "organizers",
  writes: [],
  values: null,
  productOptions: null,
  ...fields,
});

const restoreWith = (plan: OrganizersMovePlan, port: OrganizerHistoryPort) =>
  restoreOrganizersOnly(plan, { dispatch: store.dispatch, getState: store.getState, port });

const configuration = () => store.getState().rootStateUI.configuration;
const organizersUi = () => store.getState().rootStateUI.drawerOrganizersUi;
const product = () => store.getState().rootStateUI.product;
/** The products `setState` was sent to, in order. */
const setStateTargets = (calls: readonly TestOrganizerCall[]) =>
  calls.flatMap((call) => (call.kind === "setState" ? [call.runtimeId] : []));

describe("restoreOrganizersOnly", () => {
  beforeEach(() => {
    store.dispatch(reset());
    // Also drops the view and the derived state the organizers UI kept from the previous test.
    store.dispatch(resetProducts());
    store.dispatch(resetConfiguration());
    for (const runtimeId of RUNTIME_IDS) store.dispatch(addProductId(runtimeId));
    store.dispatch(syncCabinets(RUNTIME_IDS));
  });

  it("waits for the scene, clears the preview, then puts back each product's state in the plan's order", async () => {
    const test = createTestOrganizerPort();
    const plan = organizersPlan({
      writes: [
        { stableKey: "cab-1", runtimeId: "rt-1", state: ONE_COLUMN, drawers: ["Bot"] },
        { stableKey: "cab-3", runtimeId: "rt-3", state: null, drawers: ["Bot"] },
      ],
    });

    const result = await restoreWith(plan, test.port);

    expect(result).toEqual({ status: "applied" });
    expect(test.calls).toEqual([
      { kind: "whenSettled" },
      { kind: "preview", preview: null },
      { kind: "setState", runtimeId: "rt-1", state: ONE_COLUMN },
      { kind: "setState", runtimeId: "rt-3", state: null },
    ]);
  });

  it("records the scene's receipt of each product: its entry and what 3D derived for its drawers", async () => {
    store.dispatch(recordOrganizers({ stableKey: "cab-2", entry: { status: "ok", value: ONE_COLUMN } }));
    const test = createTestOrganizerPort({
      answers: [onSetState("rt-1", takenAs("rt-1", TWO_COLUMNS, DRAWERS)), onSetState("rt-2", takenAs("rt-2", null))],
    });
    const plan = organizersPlan({
      writes: [
        { stableKey: "cab-1", runtimeId: "rt-1", state: TWO_COLUMNS, drawers: ["Bot"] },
        { stableKey: "cab-2", runtimeId: "rt-2", state: null, drawers: ["Bot"] },
      ],
    });

    expect(await restoreWith(plan, test.port)).toEqual({ status: "applied" });

    expect(configuration().organizersByCabinet["cab-1"]).toEqual({ status: "ok", value: TWO_COLUMNS });
    expect(organizersUi().derived["cab-1:Top"]).toEqual(derivedWith(1));
    expect(organizersUi().derived["cab-1:Bot"]).toEqual(derivedWith(0));
    // The target has no key for cab-2: the scene answered `absent`, so its entry is gone.
    expect(configuration().organizersByCabinet).not.toHaveProperty("cab-2");
  });

  it("puts back the panel's options and their values, and keeps the cabinets the store holds now", async () => {
    // A snapshot taken before the last rebuild knew these products as other runtime ids; the store's are current.
    const cabinetsNow = configuration().cabinets;
    store.dispatch(
      setAttributeValue({ attributeId: "DividersOption", target: { scope: "global" }, value: "Customize" }),
    );
    const targetValues: Record<string, ScopedValue[]> = {
      DividersOption: [{ target: { scope: "global" }, value: "None" }],
      DividersStyle: [{ target: { scope: "global" }, value: "Oak" }],
    };
    const plan = organizersPlan({
      values: targetValues,
      productOptions: { DividersOption: "None", DividersStyle: "Oak" },
    });

    expect(await restoreWith(plan, createTestOrganizerPort().port)).toEqual({ status: "applied" });

    expect(product().productOptions.DividersOption).toBe("None");
    expect(product().productOptions.DividersStyle).toBe("Oak");
    expect(configuration().valuesByAttributeId).toEqual(targetValues);
    expect(configuration().cabinets).toEqual(cabinetsNow);
    expect(configuration().cabinets.map(({ runtimeId }) => runtimeId)).toEqual(RUNTIME_IDS);
  });

  it("changes only the option the plan names", async () => {
    const plan = organizersPlan({ productOptions: { DividersStyle: "Oak" } });
    const optionBefore = product().productOptions.DividersOption;

    await restoreWith(plan, createTestOrganizerPort().port);

    expect(product().productOptions.DividersStyle).toBe("Oak");
    expect(product().productOptions.DividersOption).toBe(optionBefore);
  });

  it("keeps the drawer in view and the products: it resets nothing the full path resets", async () => {
    store.dispatch(setView({ cabinetKey: "cab-1", drawer: "Top" }));
    const plan = organizersPlan({
      writes: [{ stableKey: "cab-1", runtimeId: "rt-1", state: ONE_COLUMN, drawers: ["Bot"] }],
      productOptions: { DividersOption: "Customize" },
    });

    await restoreWith(plan, createTestOrganizerPort().port);

    expect(organizersUi().view).toEqual({ cabinetKey: "cab-1", drawer: "Top" });
    expect(product().productIds).toEqual(RUNTIME_IDS);
  });

  it("stops at the first product the scene refuses, without undoing the products before it", async () => {
    const test = createTestOrganizerPort({
      answers: [
        onSetState("rt-1", takenAs("rt-1", ONE_COLUMN)),
        onSetState("rt-2", { status: "rejected", code: "ORGANIZERS_SLOT_LOCKED", message: "slot is locked" }),
      ],
    });
    const plan = organizersPlan({
      writes: [
        { stableKey: "cab-1", runtimeId: "rt-1", state: ONE_COLUMN, drawers: ["Bot"] },
        { stableKey: "cab-2", runtimeId: "rt-2", state: ONE_COLUMN, drawers: ["Bot"] },
        { stableKey: "cab-3", runtimeId: "rt-3", state: ONE_COLUMN, drawers: ["Bot"] },
      ],
      productOptions: { DividersOption: "Customize" },
    });

    const result = await restoreWith(plan, test.port);

    expect(result).toEqual({
      status: "fallback",
      reason: "setState rejected: ORGANIZERS_SLOT_LOCKED: slot is locked",
    });
    expect(setStateTargets(test.calls)).toEqual(["rt-1", "rt-2"]);
    expect(configuration().organizersByCabinet["cab-1"]).toEqual({ status: "ok", value: ONE_COLUMN });
    // The options come after the products: a stopped move leaves them to the full path.
    expect(product().productOptions.DividersOption).not.toBe("Customize");
  });

  it("falls back when the scene took the state only with a correction", async () => {
    const corrected: OrganizerApplyResult = {
      status: "partial",
      products: [{ runtimeId: "rt-1", entry: { status: "absent" } }],
      corrections: [{ code: "ORGANIZERS_COLUMN_DROPPED", severity: "dropped", drawer: "Top", slot: 0 }],
    };
    const test = createTestOrganizerPort({ answers: [onSetState("rt-1", corrected)] });
    const plan = organizersPlan({
      writes: [{ stableKey: "cab-1", runtimeId: "rt-1", state: ONE_COLUMN, drawers: ["Bot"] }],
    });

    expect(await restoreWith(plan, test.port)).toEqual({
      status: "fallback",
      reason: "setState partial: ORGANIZERS_COLUMN_DROPPED",
    });
  });

  it("falls back without a call when the scene is not ready", async () => {
    const test = createTestOrganizerPort();
    test.setReady(false);
    const plan = organizersPlan({
      writes: [{ stableKey: "cab-1", runtimeId: "rt-1", state: ONE_COLUMN, drawers: ["Bot"] }],
    });

    expect(await restoreWith(plan, test.port)).toEqual({ status: "fallback", reason: "not-ready" });
    expect(test.calls).toEqual([]);
  });

  it("falls back, and does not throw, when the port throws", async () => {
    const test = createTestOrganizerPort();
    const throwingPort: OrganizerHistoryPort = {
      ...test.port,
      apply: async () => {
        throw new Error("bridge gone");
      },
    };
    const plan = organizersPlan({
      writes: [{ stableKey: "cab-1", runtimeId: "rt-1", state: ONE_COLUMN, drawers: ["Bot"] }],
    });

    expect(await restoreWith(plan, throwingPort)).toEqual({ status: "fallback", reason: "error: bridge gone" });
  });

  it("moves the view to the one drawer the move changed when the drawer in view did not change", async () => {
    store.dispatch(setView({ cabinetKey: "cab-1", drawer: "Bot" }));
    const test = createTestOrganizerPort();
    const plan = organizersPlan({
      writes: [{ stableKey: "cab-1", runtimeId: "rt-1", state: ONE_COLUMN, drawers: ["Top"] }],
    });

    await restoreWith(plan, test.port);

    const enterViews = test.calls.filter((call) => call.kind === "enterView");
    expect(enterViews).toEqual([{ kind: "enterView", address: { runtimeId: "rt-1", drawer: "Top" } }]);
    // The last call: the state is put back first, the view follows it.
    expect(test.calls.at(-1)?.kind).toBe("enterView");
  });

  it("leaves the view alone when the drawer in view changed, when no drawer is in view, or on a fallback", async () => {
    const write = { stableKey: "cab-1", runtimeId: "rt-1", state: ONE_COLUMN, drawers: ["Top" as const] };
    const enterViewsOf = (calls: readonly TestOrganizerCall[]) => calls.filter((call) => call.kind === "enterView");

    store.dispatch(setView({ cabinetKey: "cab-1", drawer: "Top" }));
    const inView = createTestOrganizerPort();
    await restoreWith(organizersPlan({ writes: [write] }), inView.port);
    expect(enterViewsOf(inView.calls)).toEqual([]);

    store.dispatch(resetProducts());
    for (const runtimeId of RUNTIME_IDS) store.dispatch(addProductId(runtimeId));
    store.dispatch(syncCabinets(RUNTIME_IDS));
    const closed = createTestOrganizerPort();
    await restoreWith(organizersPlan({ writes: [write] }), closed.port);
    expect(enterViewsOf(closed.calls)).toEqual([]);

    store.dispatch(setView({ cabinetKey: "cab-1", drawer: "Bot" }));
    const refused = createTestOrganizerPort({
      answers: [onSetState("rt-1", { status: "rejected", code: "ORGANIZERS_NOT_READY", message: "no" })],
    });
    expect(await restoreWith(organizersPlan({ writes: [write] }), refused.port)).toMatchObject({ status: "fallback" });
    expect(enterViewsOf(refused.calls)).toEqual([]);
  });
});

describe("viewToFollow", () => {
  const write = (stableKey: string, runtimeId: string, drawers: DrawerName[]) => ({
    stableKey,
    runtimeId,
    state: null,
    drawers,
  });
  const view = { cabinetKey: "cab-1", drawer: "Bot" as const };

  it("follows the one changed drawer of the cabinet in view", () => {
    expect(viewToFollow(view, [write("cab-1", "rt-1", ["Top"])])).toEqual({ runtimeId: "rt-1", drawer: "Top" });
  });

  it("stays when the drawer in view changed, also when the other one did too", () => {
    expect(viewToFollow(view, [write("cab-1", "rt-1", ["Bot"])])).toBeNull();
    expect(viewToFollow(view, [write("cab-1", "rt-1", ["Top", "Bot"])])).toBeNull();
  });

  it("follows the one changed drawer of another cabinet, and prefers the cabinet in view", () => {
    expect(viewToFollow(view, [write("cab-2", "rt-2", ["Top"])])).toEqual({ runtimeId: "rt-2", drawer: "Top" });
    expect(viewToFollow(view, [write("cab-1", "rt-1", ["Top"]), write("cab-2", "rt-2", ["Bot"])])).toEqual({
      runtimeId: "rt-1",
      drawer: "Top",
    });
  });

  it("stays when the change is spread over several drawers elsewhere, when nothing changed, or with no view", () => {
    expect(viewToFollow(view, [write("cab-2", "rt-2", ["Top", "Bot"])])).toBeNull();
    expect(viewToFollow(view, [write("cab-2", "rt-2", ["Top"]), write("cab-3", "rt-3", ["Top"])])).toBeNull();
    expect(viewToFollow(view, [])).toBeNull();
    expect(viewToFollow(null, [write("cab-1", "rt-1", ["Top"])])).toBeNull();
  });
});
