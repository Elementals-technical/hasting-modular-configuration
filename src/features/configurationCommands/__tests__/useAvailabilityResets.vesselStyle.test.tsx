// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { store } from "@/app/store";
import { ReadyCollectionContext } from "@/entities/collection";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";
import configurator13 from "@/entities/collection/__tests__/fixtures/remote/configurator-13.json";
import configurator4 from "@/entities/collection/__tests__/fixtures/remote/configurator-4.json";
import datatable438 from "@/entities/collection/__tests__/fixtures/remote/datatable-438.json";
import datatable595 from "@/entities/collection/__tests__/fixtures/remote/datatable-595.json";
import { parseProductProfile } from "@/entities/collection/lib/parseProductProfile";
import { parseRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/parseRuntimeBindings";
import { configuratorSchema, countertopDatatableSchema } from "@/entities/collection/model/schemas";
import {
  finishRestore,
  getAttributeValue,
  getCabinetEntries,
  resetConfiguration,
  setActiveCollectionId,
  setActiveRuntimeBindings,
  startRestore,
  syncCabinets,
} from "@/entities/configuration";
import { getCountertopStyle, getSinkType } from "@/entities/product/model/store/selectors";
import {
  addProductId,
  reset,
  setActiveBasinStyle,
  setActiveCountertopColor,
  setActiveProfile,
  setCountertopStyle,
  setSelectedDimensions,
} from "@/entities/product/model/store/slice";
import { parseCountertopMatrix } from "@/features/configurator-rule-core/countertop";
import type { CountertopState } from "@/features/configuratorApi";
import { createTestRuntimePort } from "@/features/playCanvasAdapter";
import { setCountertopRuntimeState } from "@/shared/lib/countertopRuntimeState";

import udManifest from "../../../../public/collections/urban-duplex/manifest.json";
import udProfileDocument from "../../../../public/collections/urban-duplex/product-profile.json";
import udBindingsDocument from "../../../../public/collections/urban-duplex/runtime-bindings.json";
import udUi from "../../../../public/collections/urban-duplex/ui.json";
import ushManifest from "../../../../public/collections/urban-standard-height/manifest.json";
import ushProfileDocument from "../../../../public/collections/urban-standard-height/product-profile.json";
import ushBindingsDocument from "../../../../public/collections/urban-standard-height/runtime-bindings.json";
import ushUi from "../../../../public/collections/urban-standard-height/ui.json";
import { useAvailabilityResets } from "../hooks/useAvailabilityResets";

vi.mock("@/shared/hooks/usePlayCanvasReady", () => ({ usePlayCanvasReady: () => true }));

/** The size the scene reads for a placed cabinet; with one not listed it answers as with no scene. */
const sceneSizes = vi.hoisted(() => new Map<string, { Width: number; Depth: number }>());
vi.mock("@/utils/functions/playcanvas/getConfig", () => ({
  getConfig: async (runtimeId: string) => sceneSizes.get(runtimeId) ?? null,
}));

const parsedProfile = parseProductProfile(udProfileDocument);
if (!parsedProfile.ok) throw new Error("Packaged Urban Duplex profile failed validation");
const parsedBindings = parseRuntimeBindings(udBindingsDocument);
if (!parsedBindings.ok) throw new Error("Packaged Urban Duplex runtime bindings failed validation");
const parsedUshProfile = parseProductProfile(ushProfileDocument);
if (!parsedUshProfile.ok) throw new Error("Packaged Urban Standard Height profile failed validation");
const parsedUshBindings = parseRuntimeBindings(ushBindingsDocument);
if (!parsedUshBindings.ok) throw new Error("Packaged Urban Standard Height runtime bindings failed validation");

/** A collection as it loads: its own material configurator and its countertop table, or none. */
const readyCollection = (
  collection: ReturnType<typeof buildReadyCollection>,
  configurator: unknown,
  countertopTable: unknown | null,
) => {
  const groups = configuratorSchema.parse(configurator).availableOptions;
  return {
    ...collection,
    catalog: {
      ...collection.catalog,
      configurator: { groups, groupsByName: Object.fromEntries(groups.map((group) => [group.proxyName, group])) },
      countertops: countertopTable ? parseCountertopMatrix(countertopDatatableSchema.parse(countertopTable)) : [],
    },
  };
};

const udCollection = buildReadyCollection("urban-duplex", udManifest, udUi);
const ushCollection = buildReadyCollection("urban-standard-height", ushManifest, ushUi);

const wrapperFor =
  (collection: ReturnType<typeof readyCollection>) =>
  ({ children }: { children: ReactNode }) => (
    <ReadyCollectionContext.Provider value={collection}>
      <Provider store={store}>
        <MemoryRouter initialEntries={["/custom/cabinet-builder"]}>{children}</MemoryRouter>
      </Provider>
    </ReadyCollectionContext.Provider>
  );

/** Urban Duplex with its material configurator 13 and its countertop table 595, or none. */
const wrapperOf = (countertopTable: unknown | null = datatable595) =>
  wrapperFor(readyCollection(udCollection, configurator13, countertopTable));

const callsOf = (runtime: ReturnType<typeof createTestRuntimePort>, attributeId: string) =>
  runtime.calls.flat().filter((call) => call.attributeId === attributeId);

// What each command sent to the scene, one entry per attribute and value.
const commandsOf = (runtime: ReturnType<typeof createTestRuntimePort>) =>
  runtime.calls.map((batch) => [...new Set(batch.map(({ attributeId, value }) => `${attributeId}=${value}`))]);

type VesselComposition = {
  collectionId: string;
  profile: typeof parsedProfile.profile;
  bindings: typeof parsedBindings.bindings;
  sinkBaseRuntimeId: string;
  countertopColor: string;
  depthCm: number;
};

// One Sink Base of 80 cm, as the scene names it, under a vessel top with the empty cutout.
const startOnVesselTop = ({
  collectionId,
  profile,
  bindings,
  sinkBaseRuntimeId,
  countertopColor,
  depthCm,
}: VesselComposition) => {
  store.dispatch(reset());
  store.dispatch(resetConfiguration());
  store.dispatch(setActiveProfile(profile));
  store.dispatch(setActiveCollectionId(collectionId));
  store.dispatch(setActiveRuntimeBindings(bindings));
  store.dispatch(syncCabinets([sinkBaseRuntimeId]));
  store.dispatch(setActiveCountertopColor(countertopColor));
  store.dispatch(setCountertopStyle("vessel"));
  store.dispatch(setActiveBasinStyle(""));
  store.dispatch(setSelectedDimensions({ width: 80, depth: depthCm }));
};

afterEach(cleanup);
afterEach(() => sceneSizes.clear());

// Table 595 makes a vessel top on a Sink Base of at least min_vsl_cm (80 cm) and an HPL Strip 48 basin from 70 cm.
describe("useAvailabilityResets on a vessel countertop", () => {
  beforeEach(() => {
    // An HPL colour (the collection's default).
    startOnVesselTop({
      collectionId: "urban-duplex",
      profile: parsedProfile.profile,
      bindings: parsedBindings.bindings,
      sinkBaseRuntimeId: "UD-sink-cabinet-a1",
      countertopColor: "Pulpis Chiaro TKH",
      depthCm: 50,
    });
  });

  it("keeps the vessel style on an 80 cm Sink Base", async () => {
    const runtime = createTestRuntimePort();

    renderHook(() => useAvailabilityResets({ runtime: runtime.port }), { wrapper: wrapperOf() });
    await act(async () => Promise.resolve());

    expect(getCountertopStyle(store.getState())).toBe("vessel");
    expect(callsOf(runtime, "CountertopStyle")).toEqual([]);
  });

  it("sets the first allowed style and its first allowed basin once the Sink Base shrinks to 70 cm", async () => {
    const runtime = createTestRuntimePort();

    renderHook(() => useAvailabilityResets({ runtime: runtime.port }), { wrapper: wrapperOf() });
    await act(async () => Promise.resolve());

    act(() => {
      store.dispatch(setSelectedDimensions({ width: 70 }));
    });

    // An integrated top with a basin: no vessel cutout is left to price.
    await waitFor(() => expect(getSinkType(store.getState())).toBe("Top_HPLStrip"));
    expect(getCountertopStyle(store.getState())).toBe("integrated");
    // Two commands: the style, then the basin on the composition and its Sink Base.
    expect(commandsOf(runtime)).toEqual([["CountertopStyle=integrated"], ["sinkType=Top_HPLStrip"]]);
  });

  it("waits for a restore to finish before resetting the style", async () => {
    store.dispatch(startRestore("saved-1"));
    store.dispatch(setSelectedDimensions({ width: 70 }));
    const runtime = createTestRuntimePort();

    renderHook(() => useAvailabilityResets({ runtime: runtime.port }), { wrapper: wrapperOf() });
    await act(async () => Promise.resolve());

    expect(getCountertopStyle(store.getState())).toBe("vessel");
    expect(callsOf(runtime, "CountertopStyle")).toEqual([]);

    act(() => {
      store.dispatch(finishRestore({ status: "restored", reason: null, message: null }));
    });

    await waitFor(() => expect(getCountertopStyle(store.getState())).toBe("integrated"));
  });

  it("keeps the vessel style while no Sink Base is placed", async () => {
    store.dispatch(syncCabinets(["UD-side-cabinet-b2"]));
    store.dispatch(setSelectedDimensions({ width: 70 }));
    const runtime = createTestRuntimePort();

    renderHook(() => useAvailabilityResets({ runtime: runtime.port }), { wrapper: wrapperOf() });
    await act(async () => Promise.resolve());

    expect(getCountertopStyle(store.getState())).toBe("vessel");
    expect(callsOf(runtime, "CountertopStyle")).toEqual([]);
  });

  it("keeps the vessel style of a collection without a countertop matrix, which allows no other style", async () => {
    store.dispatch(setSelectedDimensions({ width: 70 }));
    const runtime = createTestRuntimePort();

    renderHook(() => useAvailabilityResets({ runtime: runtime.port }), { wrapper: wrapperOf(null) });
    await act(async () => Promise.resolve());

    expect(getCountertopStyle(store.getState())).toBe("vessel");
    expect(callsOf(runtime, "CountertopStyle")).toEqual([]);
  });
});

// Urban Standard Height's basin field has no autoSelect: its countertop step picks the basin only while it is open.
// Table 438 makes an HPL Prisma 50 basin from a 60 cm Sink Base and no default basin for an HPL colour, so the
// first HPL basin of the profile is taken.
describe("useAvailabilityResets on an Urban Standard Height vessel countertop", () => {
  beforeEach(() => {
    startOnVesselTop({
      collectionId: "urban-standard-height",
      profile: parsedUshProfile.profile,
      bindings: parsedUshBindings.bindings,
      sinkBaseRuntimeId: "Sink-Base-a1",
      countertopColor: "Ardesia TKF",
      // The table's HPL rows are made at 50.5 cm and 46 cm.
      depthCm: 50.5,
    });
  });

  it("sets an integrated top with an allowed basin once the Sink Base shrinks to 70 cm", async () => {
    const runtime = createTestRuntimePort();

    renderHook(() => useAvailabilityResets({ runtime: runtime.port }), {
      wrapper: wrapperFor(readyCollection(ushCollection, configurator4, datatable438)),
    });
    await act(async () => Promise.resolve());

    expect(getCountertopStyle(store.getState())).toBe("vessel");

    act(() => {
      store.dispatch(setSelectedDimensions({ width: 70 }));
    });

    await waitFor(() => expect(getSinkType(store.getState())).toBe("Top_HPLPrisma"));
    expect(getCountertopStyle(store.getState())).toBe("integrated");
    // Fluting and grain are cleared beside it: this composition has no cabinet type or material that offers them.
    expect(
      commandsOf(runtime).filter((batch) => batch.some((command) => /^(CountertopStyle|sinkType)=/.test(command))),
    ).toEqual([["CountertopStyle=integrated"], ["sinkType=Top_HPLPrisma"]]);
  });
});

/** The scene's top hosting the basin off its Sink Base, as a lift leaves it. */
const HOSTED_SINK: CountertopState = {
  readiness: "ready",
  productId: "top",
  sink: {
    owner: "countertop",
    shiftM: 0,
    landing: { status: "fits", cabinetId: null, fromCabinetId: null, reason: null, snapDxM: 0 },
    pending: null,
    hosted: true,
  },
};

// Table 595 makes the HPL Strip 48 and Cover 50 basins from a 70 cm Sink Base and the other HPL basins from 60 cm;
// the HPL default basin is Strip, so a 60 cm Sink Base takes the first HPL basin the matrix allows.
describe("useAvailabilityResets on an integrated countertop", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(setActiveProfile(parsedProfile.profile));
    store.dispatch(setActiveCollectionId("urban-duplex"));
    store.dispatch(setActiveRuntimeBindings(parsedBindings.bindings));
    store.dispatch(syncCabinets(["UD-sink-cabinet-a1"]));
    store.dispatch(setActiveCountertopColor("Pulpis Chiaro TKH"));
    store.dispatch(setCountertopStyle("integrated"));
    store.dispatch(setActiveBasinStyle("Top_HPLStrip"));
    store.dispatch(setSelectedDimensions({ width: 80, depth: 50 }));
  });
  afterEach(() => setCountertopRuntimeState(null));

  it("keeps an allowed basin on an 80 cm Sink Base", async () => {
    const runtime = createTestRuntimePort();

    renderHook(() => useAvailabilityResets({ runtime: runtime.port }), { wrapper: wrapperOf() });
    await act(async () => Promise.resolve());

    expect(getSinkType(store.getState())).toBe("Top_HPLStrip");
    expect(callsOf(runtime, "sinkType")).toEqual([]);
  });

  it("sets an allowed basin on a Sink Base placed at 60 cm", async () => {
    store.dispatch(setSelectedDimensions({ width: 60 }));
    const runtime = createTestRuntimePort();

    renderHook(() => useAvailabilityResets({ runtime: runtime.port }), { wrapper: wrapperOf() });

    await waitFor(() => expect(getSinkType(store.getState())).toBe("Top_HPLPrisma"));
    expect(getCountertopStyle(store.getState())).toBe("integrated");
    expect(commandsOf(runtime).filter((batch) => batch.some((command) => command.startsWith("sinkType=")))).toEqual([
      ["sinkType=Top_HPLPrisma"],
    ]);
  });

  it("sets an allowed basin once the Sink Base shrinks to 60 cm", async () => {
    const runtime = createTestRuntimePort();

    renderHook(() => useAvailabilityResets({ runtime: runtime.port }), { wrapper: wrapperOf() });
    await act(async () => Promise.resolve());

    act(() => {
      store.dispatch(setSelectedDimensions({ width: 60 }));
    });

    await waitFor(() => expect(getSinkType(store.getState())).toBe("Top_HPLPrisma"));
    expect(commandsOf(runtime).filter((batch) => batch.some((command) => command.startsWith("sinkType=")))).toEqual([
      ["sinkType=Top_HPLPrisma"],
    ]);
  });

  // The selected cabinet stays the 80 cm one, so only the scene's read moves the basin; every Sink Base takes it.
  it("sets an allowed basin once a 60 cm Sink Base joins the 80 cm one", async () => {
    const place = (runtimeId: string, width: number) => {
      sceneSizes.set(runtimeId, { Width: width, Depth: 50 });
      store.dispatch(addProductId(runtimeId));
    };
    place("UD-sink-cabinet-a1", 80);
    const runtime = createTestRuntimePort();

    renderHook(() => useAvailabilityResets({ runtime: runtime.port }), { wrapper: wrapperOf() });
    await act(async () => Promise.resolve());

    expect(getSinkType(store.getState())).toBe("Top_HPLStrip");
    expect(callsOf(runtime, "sinkType")).toEqual([]);

    act(() => {
      place("UD-sink-cabinet-b2", 60);
      store.dispatch(syncCabinets(["UD-sink-cabinet-a1", "UD-sink-cabinet-b2"]));
    });

    await waitFor(() => expect(getSinkType(store.getState())).toBe("Top_HPLPrisma"));
    expect(commandsOf(runtime).filter((batch) => batch.some((command) => command.startsWith("sinkType=")))).toEqual([
      ["sinkType=Top_HPLPrisma"],
    ]);
    expect(
      getCabinetEntries(store.getState()).map(({ stableKey }) =>
        getAttributeValue(store.getState(), "sinkType", { scope: "basin", sinkBaseId: stableKey }),
      ),
    ).toEqual(["Top_HPLPrisma", "Top_HPLPrisma"]);
  });

  it("waits for a restore to finish before resetting the basin", async () => {
    store.dispatch(startRestore("saved-1"));
    store.dispatch(setSelectedDimensions({ width: 60 }));
    const runtime = createTestRuntimePort();

    renderHook(() => useAvailabilityResets({ runtime: runtime.port }), { wrapper: wrapperOf() });
    await act(async () => Promise.resolve());

    expect(getSinkType(store.getState())).toBe("Top_HPLStrip");
    expect(callsOf(runtime, "sinkType")).toEqual([]);

    act(() => {
      store.dispatch(finishRestore({ status: "restored", reason: null, message: null }));
    });

    await waitFor(() => expect(getSinkType(store.getState())).toBe("Top_HPLPrisma"));
  });

  it("keeps the basin while the top hosts it off its Sink Base", async () => {
    setCountertopRuntimeState(HOSTED_SINK);
    store.dispatch(setSelectedDimensions({ width: 60 }));
    const runtime = createTestRuntimePort();

    renderHook(() => useAvailabilityResets({ runtime: runtime.port }), { wrapper: wrapperOf() });
    await act(async () => Promise.resolve());

    expect(getSinkType(store.getState())).toBe("Top_HPLStrip");
    expect(callsOf(runtime, "sinkType")).toEqual([]);
  });

  it("keeps the basin while no Sink Base is placed", async () => {
    store.dispatch(syncCabinets(["UD-side-cabinet-b2"]));
    store.dispatch(setSelectedDimensions({ width: 60 }));
    const runtime = createTestRuntimePort();

    renderHook(() => useAvailabilityResets({ runtime: runtime.port }), { wrapper: wrapperOf() });
    await act(async () => Promise.resolve());

    expect(getSinkType(store.getState())).toBe("Top_HPLStrip");
    expect(callsOf(runtime, "sinkType")).toEqual([]);
  });
});
