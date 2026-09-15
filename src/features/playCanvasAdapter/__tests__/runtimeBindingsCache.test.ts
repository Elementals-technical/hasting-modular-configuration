import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ushRuntimeBindingsDocument from "../../../../public/collections/urban-standard-height/runtime-bindings.json";

import { getLoadedRuntimeBindings, loadRuntimeBindings, resetRuntimeBindingsCache } from "../lib/runtimeBindingsCache";

const ORIGIN = "https://app.test";

describe("runtimeBindingsCache (temporary, until A07)", () => {
  beforeEach(() => {
    resetRuntimeBindingsCache();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the collection's table from its folder once", async () => {
    const fetchJson = vi.fn(async () => ushRuntimeBindingsDocument);

    const first = await loadRuntimeBindings("urban-standard-height", fetchJson, ORIGIN);
    await loadRuntimeBindings("urban-standard-height", fetchJson, ORIGIN);

    expect(first?.collectionId).toBe("urban-standard-height");
    expect(getLoadedRuntimeBindings("urban-standard-height")).toBe(first);
    expect(fetchJson).toHaveBeenCalledTimes(1);
    expect(fetchJson).toHaveBeenCalledWith(
      `${ORIGIN}/collections/urban-standard-height/runtime-bindings.json`,
      expect.any(AbortSignal),
    );
  });

  it("gives no table for a broken document or one of another collection, and retries later", async () => {
    const broken = vi.fn(async () => ({ collectionId: "urban-standard-height" }));
    expect(await loadRuntimeBindings("urban-standard-height", broken, ORIGIN)).toBeNull();

    const foreign = vi.fn(async () => ({ ...ushRuntimeBindingsDocument, collectionId: "mako" }));
    expect(await loadRuntimeBindings("urban-standard-height", foreign, ORIGIN)).toBeNull();

    expect(getLoadedRuntimeBindings("urban-standard-height")).toBeNull();
    expect(foreign).toHaveBeenCalledTimes(1);
  });
});
