import { beforeEach, describe, expect, it } from "vitest";

import { parseRuntimeBindings } from "@/entities/collection";

import ushRuntimeBindingsDocument from "../../../../public/collections/urban-standard-height/runtime-bindings.json";

import {
  getLoadedRuntimeBindings,
  replaceLoadedRuntimeBindings,
  resetRuntimeBindingsCache,
} from "../lib/runtimeBindingsCache";

describe("runtimeBindingsCache", () => {
  beforeEach(() => {
    resetRuntimeBindingsCache();
  });

  it("publishes the validated table supplied by the active collection", () => {
    const parsed = parseRuntimeBindings(ushRuntimeBindingsDocument);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    replaceLoadedRuntimeBindings("urban-standard-height", parsed.bindings);

    expect(getLoadedRuntimeBindings("urban-standard-height")).toBe(parsed.bindings);
    expect(getLoadedRuntimeBindings("class")).toBeNull();
  });

  it("clears the previous table when the next collection declares no bindings", () => {
    const parsed = parseRuntimeBindings(ushRuntimeBindingsDocument);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    replaceLoadedRuntimeBindings("urban-standard-height", parsed.bindings);
    replaceLoadedRuntimeBindings("class", null);

    expect(getLoadedRuntimeBindings("urban-standard-height")).toBeNull();
    expect(getLoadedRuntimeBindings("class")).toBeNull();
  });
});
