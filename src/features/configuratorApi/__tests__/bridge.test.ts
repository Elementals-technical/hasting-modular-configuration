// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { createConfiguratorBridge } from "../bridge";
import { runInBatchQueue } from "@/utils/functions/playcanvas/setConfigBatch";
import type { ConfiguratorApi } from "../types";

// Vitest runs this in Node; keep Node-only types out of the app's DOM tsconfig.
const { runInNewContext } = await vi.importActual<{
  runInNewContext(code: string): { JSON: JSON; Object: ObjectConstructor; ConfiguratorAPI: ConfiguratorApi };
}>("node:vm");

const host = window as unknown as { containerRef?: { current: { contentWindow: unknown } } };

// A genuinely separate realm, reproducing PlayCanvas's strict plain-object boundary.
const runtime = () => runInNewContext(`(() => {
  function check(value) {
    if (value === null || ['string', 'boolean', 'number'].includes(typeof value)) return;
    if (Array.isArray(value)) { value.forEach(check); return; }
    if (typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
      throw new TypeError('Expected finite JSON data');
    }
    Object.values(value).forEach(check);
  }
  const accept = (...args) => { args.forEach(check); return { ok: true, data: args }; };
  return { JSON, Object, ConfiguratorAPI: {
    composition: { getState: accept },
    cabinetPlacement: { beginAdd: accept },
    presetProducts: accept,
    cabinets: {
      on(event, callback, options = {}) {
        check(options);
        callback({ event });
        return () => callback({ event: 'unsubscribed' });
      },
      getCatalog() { throw new TypeError('Runtime failure detail'); }
    }
  }};
})()`);

afterEach(() => { delete host.containerRef; });

describe("cross-window ConfiguratorAPI arguments", () => {
  it("converts scopes and nested commands into the current iframe realm", async () => {
    const frame = runtime();
    host.containerRef = { current: { contentWindow: frame } };
    const scope = { apiInstanceId: "api", compositionId: "cabinets" };
    expect(() => frame.ConfiguratorAPI.composition.getState(scope)).toThrow("Expected finite JSON data");

    const bridge = createConfiguratorBridge();
    const response = await bridge.callNamespace<{ ok: boolean; data: unknown[] }>("composition", "getState", scope);
    expect(response.ok).toBe(true);
    expect(Object.getPrototypeOf(response.data[0])).toBe(frame.Object.prototype);
    expect(response.data[0]).not.toBe(scope);

    const command = { ...scope, selection: { Width: 60, materials: [{ color: "white" }] }, initialPlacement: { kind: "free", positionM: { x: 0, y: 0, z: 0 } } };
    await expect(bridge.callNamespace("cabinetPlacement", "beginAdd", command)).resolves.toMatchObject({ ok: true });
    await expect(bridge.callLegacy("presetProducts", [{ name: "ULH-side-cabinet", ...command.selection }])).resolves.toMatchObject({ ok: true });
  });

  it("preserves callbacks and converts explicit subscription options", async () => {
    host.containerRef = { current: { contentWindow: runtime() } };
    const callback = vi.fn();
    const unsubscribe = await createConfiguratorBridge().subscribe("cabinets", "change", callback, { emitCurrent: true });
    expect(callback).toHaveBeenCalledWith({ event: "change" });
    unsubscribe();
    expect(callback).toHaveBeenLastCalledWith({ event: "unsubscribed" });
    await expect(createConfiguratorBridge().subscribe("cabinets", "change", callback)).resolves.toBeTypeOf("function");
  });

  it("resolves both the API and JSON realm after an iframe reload while queued", async () => {
    let release!: () => void;
    const blocker = runInBatchQueue(() => new Promise<void>((resolve) => { release = resolve; }));
    // Allow the queue's blocker to acquire its release callback.
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    host.containerRef = { current: { contentWindow: runtime() } };
    const pending = createConfiguratorBridge().callNamespace<{ data: unknown[] }>("composition", "getState", { compositionId: "cabinets" });
    const replacement = runtime();
    host.containerRef.current.contentWindow = replacement;
    release();
    await blocker;
    expect(Object.getPrototypeOf((await pending).data[0])).toBe(replacement.Object.prototype);
  });

  it("preserves error messages thrown by the iframe", async () => {
    host.containerRef = { current: { contentWindow: runtime() } };
    await expect(createConfiguratorBridge().callNamespace("cabinets", "getCatalog")).rejects.toMatchObject({
      message: "Runtime failure detail", operation: "cabinets.getCatalog",
    });
  });

  it("rejects non-JSON input instead of silently changing its meaning", async () => {
    host.containerRef = { current: { contentWindow: runtime() } };
    const cycle: Record<string, unknown> = {}; cycle.self = cycle;
    for (const invalid of [{ Width: NaN }, { Width: undefined }, { date: new Date() }, cycle]) {
      await expect(createConfiguratorBridge().callNamespace("cabinetPlacement", "beginAdd", invalid)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    }
  });
});
