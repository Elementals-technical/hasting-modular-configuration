import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getCountertopRuntimeSize,
  setCountertopRuntimeSize,
  subscribeCountertopRuntimeSize,
} from "../countertopRuntimeSize";

afterEach(() => setCountertopRuntimeSize(null));

describe("countertopRuntimeSize", () => {
  it("publishes immutable committed sizes and resets explicitly", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeCountertopRuntimeSize(listener);
    const next = { productId: "top-1", compositionId: "composition-1", lengthCm: 137.5 };

    setCountertopRuntimeSize(next);
    expect(getCountertopRuntimeSize()).toEqual(next);
    expect(getCountertopRuntimeSize()).not.toBe(next);
    expect(Object.isFrozen(getCountertopRuntimeSize())).toBe(true);

    setCountertopRuntimeSize(null);
    expect(getCountertopRuntimeSize()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("ignores invalid and unchanged lengths so a preview cannot erase the committed snapshot", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeCountertopRuntimeSize(listener);
    const committed = { productId: "top-1", compositionId: "composition-1", lengthCm: 120 };

    setCountertopRuntimeSize(committed);
    setCountertopRuntimeSize({ ...committed });
    setCountertopRuntimeSize({ ...committed, lengthCm: Number.NaN });
    setCountertopRuntimeSize({ ...committed, lengthCm: 0 });

    expect(getCountertopRuntimeSize()).toEqual(committed);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
