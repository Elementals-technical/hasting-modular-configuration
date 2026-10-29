import { describe, expect, it, vi } from "vitest";

import { runInBatchQueue } from "@/utils/functions/playcanvas/setConfigBatch";

import { createConfiguratorBridge, type ConfiguratorBridge } from "../bridge";
import { createConfiguratorClient } from "../client";
import { ConfiguratorError, type ConfiguratorApi } from "../types";

/**
 * `ConfiguratorAPI.organizers` / `organizersOverlay` through the bridge and the client: feature-detected
 * (a build without them answers null), commands queued behind earlier scene batches, errors in one shape.
 */

const bridgeFor = (api: Partial<ConfiguratorApi> | Record<string, unknown> | null) =>
  createConfiguratorBridge({ getApi: () => api as ConfiguratorApi | null });

describe("organizers bridge: calls", () => {
  it("resolves null when the build has no organizers namespace or no such method", async () => {
    expect(await bridgeFor(null).callOrganizers!("list")).toBeNull();
    expect(await bridgeFor({}).callOrganizers!("addColumn", { productId: "rt-1", drawer: "Top", slot: 0 })).toBeNull();
    expect(
      await bridgeFor({ organizers: { list: () => [] } }).callOrganizers!("enterView", {
        productId: "rt-1",
        drawer: "Top",
      }),
    ).toBeNull();
  });

  it("forwards the input as plain JSON data and resolves the raw answer", async () => {
    const receipt = { status: "applied", state: null, corrections: [] };
    const addColumn = vi.fn(async (input: unknown) => ({ ...receipt, echo: input }));
    const exitView = vi.fn(async (...args: unknown[]) => ({ status: "applied", args }));
    const previewColumnLayout = vi.fn(() => true);
    const bridge = bridgeFor({ organizers: { addColumn, exitView, previewColumnLayout } });

    const input = { productId: "rt-1", drawer: "Top", slot: -2, style: "Metal" };
    expect(await bridge.callOrganizers!("addColumn", input)).toEqual({ ...receipt, echo: input });
    expect(addColumn.mock.calls[0][0]).not.toBe(input);

    expect(await bridge.callOrganizers!("exitView")).toEqual({ status: "applied", args: [] });
    expect(await bridge.callOrganizers!("previewColumnLayout", null)).toBe(true);
    expect(previewColumnLayout).toHaveBeenCalledWith(null);
  });

  it("refuses input that is not finite JSON before the scene sees it", async () => {
    const setColumnLayout = vi.fn();
    const bridge = bridgeFor({ organizers: { setColumnLayout } });

    await expect(
      bridge.callOrganizers!("setColumnLayout", { productId: "rt-1", drawer: "Top", slot: 0, positions: [Number.NaN] }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(setColumnLayout).not.toHaveBeenCalled();
  });

  it("turns a thrown runtime error into a ConfiguratorError with its code and the operation", async () => {
    const bridge = bridgeFor({
      organizers: {
        clear: () => {
          throw Object.assign(new Error("writers are busy"), { code: "LEGACY_WRITERS_BUSY" });
        },
      },
    });

    const call = bridge.callOrganizers!("clear", { productId: "rt-1" });
    await expect(call).rejects.toBeInstanceOf(ConfiguratorError);
    await expect(call).rejects.toMatchObject({
      code: "LEGACY_WRITERS_BUSY",
      message: "writers are busy",
      operation: "organizers.clear",
    });
  });

  it("queues the six commands behind earlier scene batches, never the view, the preview or the reads", async () => {
    const calls: string[] = [];
    const record = (name: string) => () => {
      calls.push(name);
      return name === "previewColumnLayout" ? true : { status: "noop" };
    };
    const methods = [
      "addColumn",
      "removeColumn",
      "setColumnLayout",
      "setStyle",
      "clear",
      "setState",
      "enterView",
      "previewColumnLayout",
      "list",
      "getState",
    ] as const;
    const bridge = bridgeFor({ organizers: Object.fromEntries(methods.map((name) => [name, record(name)])) });

    let release!: () => void;
    const batch = runInBatchQueue(() => new Promise<void>((resolve) => (release = resolve)));

    const pending = methods.map((name) => bridge.callOrganizers!(name, { productId: "rt-1" }));
    await vi.waitFor(() => expect(calls).toEqual(["enterView", "previewColumnLayout", "list", "getState"]));

    release();
    await batch;
    await Promise.all(pending);
    expect(calls.slice(4)).toEqual(["addColumn", "removeColumn", "setColumnLayout", "setStyle", "clear", "setState"]);
  });
});

describe("organizers bridge: subscriptions", () => {
  it("resolves null without the namespace", async () => {
    expect(await bridgeFor({}).subscribeOrganizers!("change", vi.fn())).toBeNull();
    expect(await bridgeFor(null).subscribeOrganizersOverlay!("change", vi.fn())).toBeNull();
  });

  it("asks organizers for the current state first", async () => {
    const unsubscribe = vi.fn();
    const on = vi.fn(() => unsubscribe);
    const callback = vi.fn();

    expect(await bridgeFor({ organizers: { on } }).subscribeOrganizers!("view", callback)).toBe(unsubscribe);
    expect(on).toHaveBeenCalledWith("view", callback, { emitCurrent: true });
  });

  it("asks the overlay for the current frame, but subscribes to taps without options", async () => {
    const on = vi.fn(() => vi.fn());
    const bridge = bridgeFor({ organizersOverlay: { on, getState: () => null } });

    await bridge.subscribeOrganizersOverlay!("change", vi.fn());
    await bridge.subscribeOrganizersOverlay!("pointer", vi.fn());

    expect(on.mock.calls.map((args: unknown[]) => (args.length === 2 ? [args[0]] : [args[0], args[2]]))).toEqual([
      ["change", { emitCurrent: true }],
      ["pointer"],
    ]);
  });

  it("reports a refused subscription as a ConfiguratorError", async () => {
    const on = () => {
      throw Object.assign(new Error("bad event"), { code: "ORGANIZERS_INVALID_INPUT" });
    };
    await expect(bridgeFor({ organizers: { on } }).subscribeOrganizers!("change", vi.fn())).rejects.toMatchObject({
      code: "ORGANIZERS_INVALID_INPUT",
      operation: "organizers.on",
    });
  });
});

describe("organizers client subscriptions", () => {
  type FakeBridge = ConfiguratorBridge & { emit(key: string, payload: unknown): void; raw: ReturnType<typeof vi.fn>[] };

  const fakeBridge = (): FakeBridge => {
    const listeners = new Map<string, (payload: unknown) => void>();
    const raw: ReturnType<typeof vi.fn>[] = [];
    const subscribe = (source: string) => async (event: string, callback: (payload: unknown) => void) => {
      listeners.set(`${source}:${event}`, callback);
      const unsubscribe = vi.fn();
      raw.push(unsubscribe);
      return unsubscribe;
    };
    return {
      callNamespace: vi.fn(),
      callLegacy: vi.fn(),
      subscribe: vi.fn(),
      subscribeOrganizers: subscribe("organizers"),
      subscribeOrganizersOverlay: subscribe("overlay"),
      emit: (key: string, payload: unknown) => listeners.get(key)?.(payload),
      raw,
    } as never;
  };

  it("delivers events until unsubscribed and unsubscribes once", async () => {
    const bridge = fakeBridge();
    const client = createConfiguratorClient({ bridge });
    const changes: unknown[] = [];

    const unsubscribe = await client.onOrganizers("change", (payload) => changes.push(payload));
    bridge.emit("organizers:change", { revision: 1 });
    unsubscribe!();
    unsubscribe!();
    bridge.emit("organizers:change", { revision: 2 });

    expect(changes).toEqual([{ revision: 1 }]);
    expect(bridge.raw[0]).toHaveBeenCalledTimes(1);
  });

  it("drops every organizer subscription on dispose, and resolves null for a build without them", async () => {
    const bridge = fakeBridge();
    const client = createConfiguratorClient({ bridge });
    const frames: unknown[] = [];

    await client.onOrganizers("view", vi.fn());
    await client.onOrganizersOverlay("change", (frame) => frames.push(frame));
    client.dispose();
    bridge.emit("overlay:change", { revision: 1 });

    expect(frames).toEqual([]);
    expect(bridge.raw.every((unsubscribe) => unsubscribe.mock.calls.length === 1)).toBe(true);

    const bare = createConfiguratorClient({
      bridge: { callNamespace: vi.fn(), callLegacy: vi.fn(), subscribe: vi.fn() } as never,
    });
    expect(await bare.onOrganizers("change", vi.fn())).toBeNull();
    expect(await bare.onOrganizersOverlay("pointer", vi.fn())).toBeNull();
  });
});
