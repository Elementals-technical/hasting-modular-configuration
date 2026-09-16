// @vitest-environment jsdom

import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  ActiveCollectionContext,
  parseRuntimeBindings,
  type ActiveCollectionState,
  type RuntimeBindingSet,
} from "@/entities/collection";

import ushRuntimeBindingsDocument from "../../../../public/collections/urban-standard-height/runtime-bindings.json";

import {
  getLoadedRuntimeBindings,
  resetRuntimeBindingsCache,
} from "../lib/runtimeBindingsCache";
import { RuntimeBindingsBridge } from "../ui/RuntimeBindingsBridge";

const readyState = (id: string, runtimeBindings?: RuntimeBindingSet): ActiveCollectionState => ({
  status: "ready",
  collectionId: id,
  data: {
    id,
    manifest: { id, label: id, defaults: {} },
    diagnostics: [],
    sources: { local: {}, remote: {} },
    catalog: { runtimeBindings },
  },
});

describe("RuntimeBindingsBridge", () => {
  afterEach(() => {
    resetRuntimeBindingsCache();
  });

  it("publishes declared bindings and clears them for a ready collection without bindings", async () => {
    const parsed = parseRuntimeBindings(ushRuntimeBindingsDocument);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const { rerender, unmount } = render(
      <ActiveCollectionContext.Provider value={readyState("urban-standard-height", parsed.bindings)}>
        <RuntimeBindingsBridge />
      </ActiveCollectionContext.Provider>,
    );

    await waitFor(() => expect(getLoadedRuntimeBindings("urban-standard-height")).toBe(parsed.bindings));

    rerender(
      <ActiveCollectionContext.Provider value={readyState("class")}>
        <RuntimeBindingsBridge />
      </ActiveCollectionContext.Provider>,
    );

    await waitFor(() => expect(getLoadedRuntimeBindings("urban-standard-height")).toBeNull());
    expect(getLoadedRuntimeBindings("class")).toBeNull();

    unmount();
    expect(getLoadedRuntimeBindings("class")).toBeNull();
  });
});
