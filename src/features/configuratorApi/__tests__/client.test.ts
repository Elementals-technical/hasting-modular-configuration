// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { runInBatchQueue } from "@/utils/functions/playcanvas/setConfigBatch";

import { createConfiguratorBridge, createConfiguratorClient, ConfiguratorError } from "..";
import type {
  ConfiguratorApiResult,
  ConfiguratorCapabilities,
  ConfiguratorApi,
  CabinetDraftState,
  ConfiguratorPreset,
  ConfiguratorCompactPreset,
  ConfiguratorReceipt,
} from "..";

type Host = { containerRef?: unknown };
const host = window as unknown as Host;

const readyCapabilities = (apiInstanceId = "api-1", activeCompositionId = "composition-1"): ConfiguratorCapabilities => ({
  readiness: "ready",
  apiInstanceId,
  activeCompositionId,
  collectionId: "test-collection",
  supportedMethods: ["cabinetPlacement.beginAdd", "composition.importPreset"],
});

const ok = <T>(data: T, compositionRevision?: number): ConfiguratorApiResult<T> => ({
  ok: true,
  data,
  ...(compositionRevision === undefined
    ? {}
    : { context: { dependencies: { compositionRevision } } }),
});

const fail = (code: string, retryable = false): ConfiguratorApiResult<never> => ({
  ok: false,
  error: { code, retryable },
});

const compositionState = { status: "ready", activeSessionId: null };

const draft = (overrides: Partial<CabinetDraftState> = {}): CabinetDraftState => ({
  sessionId: "session-1",
  kind: "add",
  lifecycle: "preview",
  baseCompositionRevision: 11,
  candidateRevision: 4,
  canApply: true,
  canCancel: true,
  ...overrides,
});

const receipt: ConfiguratorReceipt = {
  requestId: "request-apply",
  sessionId: "session-1",
  kind: "add",
  compositionRevision: 12,
  addedProductIds: ["cabinet-1"],
  updatedProductIds: [],
  removedProductIds: [],
  selectedCabinetId: "cabinet-1",
};

type ApiOverrides = {
  presetProducts?: (...args: unknown[]) => Promise<unknown>;
  addProduct?: (...args: unknown[]) => Promise<unknown>;
  getCapabilities?: () => Promise<ConfiguratorApiResult<ConfiguratorCapabilities>>;
  getCabinetsState?: (...args: unknown[]) => Promise<unknown>;
  getCompositionState?: (...args: unknown[]) => Promise<unknown>;
  beginAdd?: (...args: unknown[]) => Promise<unknown>;
  beginMove?: (...args: unknown[]) => Promise<unknown>;
  settleInput?: (...args: unknown[]) => Promise<unknown>;
  apply?: (...args: unknown[]) => Promise<unknown>;
  cancel?: (...args: unknown[]) => Promise<unknown>;
  exportPreset?: (...args: unknown[]) => Promise<unknown>;
  importPreset?: (...args: unknown[]) => Promise<unknown>;
  on?: (...args: unknown[]) => unknown;
};

const makeApi = (overrides: ApiOverrides = {}): ConfiguratorApi => {
  const on = overrides.on ?? (() => () => undefined);
  return {
    presetProducts: (overrides.presetProducts ?? vi.fn(async () => [])) as ConfiguratorApi["presetProducts"],
    addProduct: (overrides.addProduct ?? vi.fn(async () => "cabinet-new")) as ConfiguratorApi["addProduct"],
    cabinets: {
      getCapabilities: overrides.getCapabilities ?? vi.fn(async () => ok(readyCapabilities())),
      getCatalog: vi.fn(async () => ok([])),
      getConfigurationOptions: vi.fn(async () => ok([])),
      getPlacementOptions: vi.fn(async () => ok([])),
      getState: (overrides.getCabinetsState ??
        vi.fn(async () => ok({ cabinets: [], connections: [], selectedCabinetId: null }))) as ConfiguratorApi["cabinets"]["getState"],
      select: vi.fn(async (_scope, productId) => ok({ selectedCabinetId: productId })),
      on: on as ConfiguratorApi["cabinets"]["on"],
    },
    cabinetPlacement: {
      beginAdd: (overrides.beginAdd ?? vi.fn(async (input) => ok(draft({ sessionId: String(input.sessionId) })))) as ConfiguratorApi["cabinetPlacement"]["beginAdd"],
      beginMove: (overrides.beginMove ?? vi.fn(async (input) => ok(draft({ sessionId: String(input.sessionId), kind: "move" })))) as ConfiguratorApi["cabinetPlacement"]["beginMove"],
      updateDraft: vi.fn(async (input) => ok(draft({ sessionId: input.sessionId }))),
      getState: vi.fn(async (_scope, sessionId) => ok(draft({ sessionId }))),
      settleInput: (overrides.settleInput ?? vi.fn(async (_scope, sessionId) => ok(draft({ sessionId })))) as ConfiguratorApi["cabinetPlacement"]["settleInput"],
      apply: (overrides.apply ?? vi.fn(async () => ok(receipt))) as ConfiguratorApi["cabinetPlacement"]["apply"],
      cancel: (overrides.cancel ?? vi.fn(async (_scope, sessionId) => ok(draft({ sessionId, lifecycle: "cancelled" })))) as ConfiguratorApi["cabinetPlacement"]["cancel"],
      on: on as ConfiguratorApi["cabinetPlacement"]["on"],
    },
    composition: {
      getState: (overrides.getCompositionState ?? vi.fn(async () => ok(compositionState, 11))) as ConfiguratorApi["composition"]["getState"],
      exportPreset: (overrides.exportPreset ?? vi.fn(async () => ok({ presetSchemaVersion: 2 }))) as ConfiguratorApi["composition"]["exportPreset"],
      importPreset: (overrides.importPreset ?? vi.fn(async () => ok({ ...receipt, keyToProductId: {} }))) as ConfiguratorApi["composition"]["importPreset"],
      getCommandResult: vi.fn(async () => ok({ status: "complete", result: receipt })),
      on: on as ConfiguratorApi["composition"]["on"],
    },
  };
};

afterEach(() => {
  delete host.containerRef;
});

describe("configurator iframe bridge", () => {
  it("resolves ConfiguratorAPI through window.containerRef when the queued call starts", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = () => resolve();
    });
    const blocker = runInBatchQueue(() => gate);
    const oldCapabilities = vi.fn(async () => ok(readyCapabilities("old-api")));
    const newCapabilities = vi.fn(async () => ok(readyCapabilities("new-api")));
    host.containerRef = { current: { contentWindow: { ConfiguratorAPI: makeApi({ getCapabilities: oldCapabilities }) } } };

    const bridge = createConfiguratorBridge();
    const pending = bridge.callNamespace<ConfiguratorApiResult<ConfiguratorCapabilities>>("cabinets", "getCapabilities");
    host.containerRef = { current: { contentWindow: { ConfiguratorAPI: makeApi({ getCapabilities: newCapabilities }) } } };
    release();

    await blocker;
    expect(await pending).toEqual(ok(readyCapabilities("new-api")));
    expect(oldCapabilities).not.toHaveBeenCalled();
    expect(newCapabilities).toHaveBeenCalledOnce();
  });

  it("reports a stable error when the iframe API is unavailable", async () => {
    const bridge = createConfiguratorBridge();
    await expect(bridge.callNamespace("cabinets", "getCapabilities")).rejects.toMatchObject({
      name: "ConfiguratorError",
      code: "API_UNAVAILABLE",
      retryable: true,
      operation: "cabinets.getCapabilities",
    });
  });
});

describe("ConfiguratorClient", () => {
  it("polls initializing capabilities and captures the ready scope", async () => {
    const getCapabilities = vi
      .fn<() => Promise<ConfiguratorApiResult<ConfiguratorCapabilities>>>()
      .mockResolvedValueOnce(ok({ ...readyCapabilities(), readiness: "initializing" }))
      .mockResolvedValueOnce(ok(readyCapabilities("api-ready", "composition-ready")));
    const sleep = vi.fn(async () => undefined);
    let now = 0;
    const client = createConfiguratorClient({
      getApi: () => makeApi({ getCapabilities }),
      sleep: async (milliseconds) => {
        now += milliseconds;
        await sleep();
      },
      now: () => now,
    });

    expect(await client.connect()).toBe(client);
    expect(client.scope).toEqual({ apiInstanceId: "api-ready", compositionId: "composition-ready" });
    expect(getCapabilities).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledOnce();
  });

  it("waits for ConfiguratorAPI to be attached to the iframe", async () => {
    const api = makeApi();
    let reads = 0;
    let now = 0;
    const client = createConfiguratorClient({
      getApi: () => (++reads === 1 ? null : api),
      sleep: async (milliseconds) => {
        now += milliseconds;
      },
      now: () => now,
    });

    await expect(client.connect()).resolves.toBe(client);
    expect(reads).toBe(2);
  });

  it("reads capabilities fresh by default and only uses the cache when refresh is explicitly false", async () => {
    const getCapabilities = vi
      .fn<() => Promise<ConfiguratorApiResult<ConfiguratorCapabilities>>>()
      .mockResolvedValueOnce(ok(readyCapabilities("api-1")))
      .mockResolvedValueOnce(ok(readyCapabilities("api-2")));
    const client = createConfiguratorClient({ getApi: () => makeApi({ getCapabilities }) });

    await expect(client.getCapabilities()).resolves.toMatchObject({ apiInstanceId: "api-1" });
    await expect(client.getCapabilities()).resolves.toMatchObject({ apiInstanceId: "api-2" });
    await expect(client.getCapabilities({ refresh: false })).resolves.toMatchObject({ apiInstanceId: "api-2" });
    expect(getCapabilities).toHaveBeenCalledTimes(2);
  });

  it.each([
    {
      label: "readiness is no longer ready",
      next: { ...readyCapabilities(), readiness: "initializing" as const },
    },
    {
      label: "runtime identity changes",
      next: readyCapabilities("api-reloaded", "composition-reloaded"),
    },
  ])("invalidates the active scope when $label", async ({ next }) => {
    const getCapabilities = vi
      .fn<() => Promise<ConfiguratorApiResult<ConfiguratorCapabilities>>>()
      .mockResolvedValueOnce(ok(readyCapabilities()))
      .mockResolvedValueOnce(ok(next));
    const client = createConfiguratorClient({ getApi: () => makeApi({ getCapabilities }) });

    await client.connect();
    expect(client.scope).toEqual({ apiInstanceId: "api-1", compositionId: "composition-1" });
    await client.getCapabilities();
    expect(client.scope).toBeNull();
  });

  it("distinguishes an unsupported runtime from a readiness timeout", async () => {
    const unsupported = createConfiguratorClient({
      getApi: () => makeApi({ getCapabilities: async () => ok({ ...readyCapabilities(), readiness: "unsupported" }) }),
    });
    await expect(unsupported.connect()).rejects.toMatchObject({ code: "CONFIGURATOR_NOT_READY", retryable: false });

    const timeout = createConfiguratorClient({
      getApi: () => makeApi({ getCapabilities: async () => ok({ ...readyCapabilities(), readiness: "initializing" }) }),
      timeoutMs: 0,
    });
    await expect(timeout.connect()).rejects.toMatchObject({ code: "CONFIGURATOR_READY_TIMEOUT", retryable: true });
  });

  it("refreshes capabilities and retries a scoped read once after SCOPE_MISMATCH", async () => {
    const getCapabilities = vi
      .fn<() => Promise<ConfiguratorApiResult<ConfiguratorCapabilities>>>()
      .mockResolvedValueOnce(ok(readyCapabilities("api-old", "composition-old")))
      .mockResolvedValueOnce(ok(readyCapabilities("api-new", "composition-new")));
    const getState = vi
      .fn<(...args: unknown[]) => Promise<unknown>>()
      .mockResolvedValueOnce(fail("SCOPE_MISMATCH", true))
      .mockResolvedValueOnce(ok({ cabinets: [], connections: [], selectedCabinetId: null }));
    const api = makeApi({ getCapabilities, getCabinetsState: getState });
    const client = createConfiguratorClient({ getApi: () => api });

    await client.connect();
    await expect(client.getCabinetsState()).resolves.toEqual({
      cabinets: [],
      connections: [],
      selectedCabinetId: null,
    });
    expect(getState).toHaveBeenNthCalledWith(1, { apiInstanceId: "api-old", compositionId: "composition-old" });
    expect(getState).toHaveBeenNthCalledWith(2, { apiInstanceId: "api-new", compositionId: "composition-new" });
    expect(client.scope).toEqual({ apiInstanceId: "api-new", compositionId: "composition-new" });
  });

  it("exposes the general top-level presetProducts and addProduct calls", async () => {
    const presetProducts = vi.fn(async () => ["cabinet-a"]);
    const addProduct = vi.fn(async () => "cabinet-b");
    const getCapabilities = vi.fn(async () => {
      throw new Error("legacy writes must not bootstrap namespaced capabilities");
    });
    const client = createConfiguratorClient({
      getApi: () => makeApi({ presetProducts, addProduct, getCapabilities }),
    });

    await expect(
      client.presetProducts([{ name: "test-cabinet", Width: 60 }], { CabinetColor: "white" }),
    ).resolves.toEqual(["cabinet-a"]);
    await expect(client.addProduct("test-cabinet", { Width: 80 })).resolves.toBe("cabinet-b");
    expect(presetProducts).toHaveBeenCalledWith(
      [{ name: "test-cabinet", Width: 60 }],
      { CabinetColor: "white" },
    );
    expect(addProduct).toHaveBeenCalledWith("test-cabinet", { Width: 80 });
    expect(getCapabilities).not.toHaveBeenCalled();
  });

  it("invalidates cached capabilities and scope after a confirmed legacy write without a follow-up read", async () => {
    const getCapabilities = vi
      .fn<() => Promise<ConfiguratorApiResult<ConfiguratorCapabilities>>>()
      .mockResolvedValueOnce(ok(readyCapabilities()))
      .mockRejectedValueOnce(new Error("runtime is rebuilding"));
    const addProduct = vi.fn(async () => "cabinet-added");
    const client = createConfiguratorClient({ getApi: () => makeApi({ getCapabilities, addProduct }) });

    await client.connect();
    await expect(client.addProduct("test-cabinet", { Width: 80 })).resolves.toBe("cabinet-added");
    expect(addProduct).toHaveBeenCalledOnce();
    expect(getCapabilities).toHaveBeenCalledOnce();
    expect(client.scope).toBeNull();

    await expect(client.getCapabilities({ refresh: false })).rejects.toThrow("runtime is rebuilding");
    expect(getCapabilities).toHaveBeenCalledTimes(2);
  });

  it("keeps the current scope when a legacy write is rejected", async () => {
    const addProduct = vi.fn(async () => {
      throw Object.assign(new Error("unsupported cabinet"), { code: "CATALOG_UNSUPPORTED" });
    });
    const client = createConfiguratorClient({ getApi: () => makeApi({ addProduct }) });

    await client.connect();
    await expect(client.addProduct("unsupported-cabinet")).rejects.toMatchObject({
      code: "CATALOG_UNSUPPORTED",
    });
    expect(client.scope).toEqual({ apiInstanceId: "api-1", compositionId: "composition-1" });
  });

  it("adds command metadata from the latest composition revision", async () => {
    const ids = ["session-id", "request-id"];
    const beginAdd = vi.fn(async (...args: unknown[]) => {
      const input = args[0] as Record<string, unknown>;
      return ok(draft({ sessionId: String(input.sessionId) }));
    });
    const api = makeApi({ beginAdd });
    const client = createConfiguratorClient({ getApi: () => api, createId: () => ids.shift() ?? "extra-id" });

    await client.connect();
    const state = await client.beginAdd("test-side-cabinet", { Width: 60 });

    expect(state.sessionId).toBe("session-id");
    expect(beginAdd).toHaveBeenCalledWith({
      apiInstanceId: "api-1",
      compositionId: "composition-1",
      requestId: "request-id",
      expectedCompositionRevision: 11,
      sessionId: "session-id",
      definitionId: "test-side-cabinet",
      selection: { Width: 60 },
    });
  });

  it("settles a draft and applies the exact base and candidate revisions", async () => {
    const settleInput = vi.fn(async () => ok(draft({ baseCompositionRevision: 21, candidateRevision: 8 })));
    const apply = vi.fn(async () => ok(receipt));
    const client = createConfiguratorClient({
      getApi: () => makeApi({ settleInput, apply }),
      createId: () => "request-apply",
    });

    await client.connect();
    await expect(client.apply("session-1")).resolves.toEqual(receipt);
    expect(settleInput).toHaveBeenCalledWith(
      { apiInstanceId: "api-1", compositionId: "composition-1" },
      "session-1",
    );
    expect(apply).toHaveBeenCalledWith({
      apiInstanceId: "api-1",
      compositionId: "composition-1",
      sessionId: "session-1",
      requestId: "request-apply",
      expectedCompositionRevision: 21,
      expectedCandidateRevision: 8,
    });
  });

  it("does not call apply when validation says the draft cannot be committed", async () => {
    const apply = vi.fn(async () => ok(receipt));
    const client = createConfiguratorClient({
      getApi: () => makeApi({
        settleInput: async () => ok(draft({ canApply: false, validation: { status: "invalid", reasons: [] } })),
        apply,
      }),
    });

    await client.connect();
    await expect(client.apply("session-1")).rejects.toMatchObject({
      code: "APPLY_UNAVAILABLE",
      detail: { collision: true },
    });
    expect(apply).not.toHaveBeenCalled();
  });

  it.each(["STALE_COMPOSITION", "STALE_DEPENDENCIES"])(
    "surfaces %s from a revision command without repeating the mutation",
    async (code) => {
      const beginAdd = vi.fn(async () => fail(code, true));
      const getCompositionState = vi.fn(async () => ok(compositionState, 11));
      const client = createConfiguratorClient({
        getApi: () => makeApi({ beginAdd, getCompositionState }),
        createId: vi.fn().mockReturnValueOnce("session-id").mockReturnValueOnce("request-id"),
      });

      await client.connect();
      await expect(client.beginAdd("test-cabinet", { Width: 60 })).rejects.toMatchObject({ code });
      expect(getCompositionState).toHaveBeenCalledOnce();
      expect(beginAdd).toHaveBeenCalledOnce();
    },
  );

  it("surfaces STALE_CANDIDATE without settling or applying a second time", async () => {
    const settleInput = vi.fn(async () => ok(draft({ candidateRevision: 8 })));
    const apply = vi.fn(async () => fail("STALE_CANDIDATE", true));
    const client = createConfiguratorClient({ getApi: () => makeApi({ settleInput, apply }) });

    await client.connect();
    await expect(client.apply("session-1")).rejects.toMatchObject({ code: "STALE_CANDIDATE" });
    expect(settleInput).toHaveBeenCalledOnce();
    expect(apply).toHaveBeenCalledOnce();
  });

  it("does not move a mutation to a refreshed scope after SCOPE_MISMATCH", async () => {
    const getCapabilities = vi.fn(async () => ok(readyCapabilities()));
    const beginMove = vi.fn(async () => fail("SCOPE_MISMATCH", true));
    const client = createConfiguratorClient({ getApi: () => makeApi({ getCapabilities, beginMove }) });

    await client.connect();
    await expect(client.beginMove("cabinet-1")).rejects.toMatchObject({ code: "SCOPE_MISMATCH" });
    expect(getCapabilities).toHaveBeenCalledOnce();
    expect(beginMove).toHaveBeenCalledOnce();
  });

  it("exports with the first cabinet and imports a preset as a revision command", async () => {
    const preset = {
      presetSchemaVersion: 2,
      collection: { id: "test-collection" },
      presetProducts: [],
      presetLayout: {},
    } satisfies ConfiguratorPreset;
    const exportPreset = vi.fn(async () => ok(preset));
    const importPreset = vi.fn(async () => ok({ ...receipt, keyToProductId: { cabinet0: "cabinet-new" } }));
    const api = makeApi({
      getCabinetsState: async () =>
        ok({
          cabinets: [
            { id: "cabinet-anchor", definitionId: "test-side-cabinet", selection: {}, positionM: { x: 0, y: 0, z: 0 } },
          ],
          connections: [],
          selectedCabinetId: null,
        }),
      exportPreset,
      importPreset,
    });
    const client = createConfiguratorClient({ getApi: () => api, createId: () => "request-import" });

    await client.connect();
    await expect(client.exportPreset()).resolves.toEqual(preset);
    expect(exportPreset).toHaveBeenCalledWith({
      apiInstanceId: "api-1",
      compositionId: "composition-1",
      anchorCabinetId: "cabinet-anchor",
    });

    await client.importPreset(preset, { x: 1, y: 2, z: 3 });
    expect(importPreset).toHaveBeenCalledWith({
      apiInstanceId: "api-1",
      compositionId: "composition-1",
      requestId: "request-import",
      expectedCompositionRevision: 11,
      preset,
      anchorPositionM: { x: 1, y: 2, z: 3 },
    });
  });

  it("exports and imports a compact preset", async () => {
    const compact = {
      format: "ulh-compact-v1",
      collection: "ULH",
      rows: [{ products: [{ name: "ULH-sink-cabinet", Width: 60 }] }],
    } satisfies ConfiguratorCompactPreset;
    const exportCompactPreset = vi.fn(async () => ok(compact));
    const importCompactPreset = vi.fn(async () => ok({ ...receipt, keyToProductId: { cabinet0: "cabinet-new" } }));
    const api = makeApi({
      getCabinetsState: async () =>
        ok({
          cabinets: [
            { id: "cabinet-anchor", definitionId: "test-side-cabinet", selection: {}, positionM: { x: 0, y: 0, z: 0 } },
          ],
          connections: [],
          selectedCabinetId: null,
        }),
    });
    api.composition.exportCompactPreset = exportCompactPreset as ConfiguratorApi["composition"]["exportCompactPreset"];
    api.composition.importCompactPreset = importCompactPreset as ConfiguratorApi["composition"]["importCompactPreset"];
    const client = createConfiguratorClient({ getApi: () => api, createId: () => "request-compact" });

    await client.connect();
    await expect(client.exportCompactPreset()).resolves.toEqual(compact);
    expect(exportCompactPreset).toHaveBeenLastCalledWith({
      apiInstanceId: "api-1",
      compositionId: "composition-1",
    });
    await client.exportCompactPreset("cabinet-anchor");
    expect(exportCompactPreset).toHaveBeenLastCalledWith({
      apiInstanceId: "api-1",
      compositionId: "composition-1",
      anchorCabinetId: "cabinet-anchor",
    });

    await client.importCompactPreset(compact);
    expect(importCompactPreset).toHaveBeenCalledWith({
      apiInstanceId: "api-1",
      compositionId: "composition-1",
      requestId: "request-compact",
      expectedCompositionRevision: 11,
      preset: compact,
    });
  });

  it("normalizes namespace failures", async () => {
    const api = makeApi({ getCabinetsState: async () => fail("COMPOSITION_BUSY", true) });
    const client = createConfiguratorClient({ getApi: () => api });

    await client.connect();
    await expect(client.getCabinetsState()).rejects.toEqual(
      expect.objectContaining({
        name: "ConfiguratorError",
        code: "COMPOSITION_BUSY",
        retryable: true,
        operation: "cabinets.getState",
      }),
    );
  });

  it("filters each event subscription by current scope and monotonically increasing sequence", async () => {
    const unsubscribe = vi.fn();
    let eventHandler: ((event: unknown) => void) | undefined;
    const on = vi.fn((_event: unknown, callback: unknown) => {
      eventHandler = callback as (event: unknown) => void;
      return unsubscribe;
    });
    const getCapabilities = vi
      .fn<() => Promise<ConfiguratorApiResult<ConfiguratorCapabilities>>>()
      .mockResolvedValueOnce(ok(readyCapabilities()))
      .mockResolvedValueOnce(ok(readyCapabilities("api-2", "composition-2")));
    const client = createConfiguratorClient({ getApi: () => makeApi({ on, getCapabilities }) });
    const received: Array<CabinetDraftState | null> = [];

    await client.connect();
    await client.on("cabinetPlacement", "change", (event) => received.push(event.data));
    expect(on).toHaveBeenCalledWith("change", expect.any(Function), undefined);

    eventHandler?.({
      apiInstanceId: "wrong-api",
      compositionId: "composition-1",
      eventSequence: 100,
      compositionRevision: 1,
      data: draft(),
    });
    eventHandler?.({
      apiInstanceId: "api-1",
      compositionId: "composition-1",
      eventSequence: 2,
      compositionRevision: 1,
      data: null,
    });
    eventHandler?.({
      apiInstanceId: "api-1",
      compositionId: "composition-1",
      eventSequence: 2,
      compositionRevision: 1,
      data: draft(),
    });
    eventHandler?.({
      apiInstanceId: "api-1",
      compositionId: "composition-1",
      eventSequence: 1,
      compositionRevision: 1,
      data: draft(),
    });
    eventHandler?.({
      apiInstanceId: "api-1",
      compositionId: "composition-1",
      eventSequence: 3,
      compositionRevision: 1,
      data: draft({ candidateRevision: 5 }),
    });
    expect(received).toEqual([null, draft({ candidateRevision: 5 })]);

    await client.refreshScope();
    eventHandler?.({
      apiInstanceId: "api-1",
      compositionId: "composition-1",
      eventSequence: 4,
      compositionRevision: 1,
      data: draft(),
    });
    expect(received).toHaveLength(2);

    client.dispose();
    expect(unsubscribe).toHaveBeenCalledOnce();
    await expect(client.getCabinetsState()).rejects.toBeInstanceOf(ConfiguratorError);
  });

  it("tracks event sequence independently for each subscription", async () => {
    const handlers: Array<(event: unknown) => void> = [];
    const on = vi.fn((_event: unknown, callback: unknown) => {
      handlers.push(callback as (event: unknown) => void);
      return () => undefined;
    });
    const client = createConfiguratorClient({ getApi: () => makeApi({ on }) });
    const first = vi.fn();
    const second = vi.fn();
    const envelope = (eventSequence: number) => ({
      apiInstanceId: "api-1",
      compositionId: "composition-1",
      eventSequence,
      compositionRevision: 1,
      data: compositionState,
    });

    await client.connect();
    await client.on("composition", "change", first);
    await client.on("composition", "change", second);
    handlers[0]?.(envelope(10));
    handlers[1]?.(envelope(1));

    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
  });
});
