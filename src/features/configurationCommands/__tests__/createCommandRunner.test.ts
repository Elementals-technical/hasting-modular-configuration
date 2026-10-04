// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import { store } from "@/app/store";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { ushRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/ushRuntimeBindingsFixture";
import { resetConfiguration, setActiveCollectionId, setActiveRuntimeBindings } from "@/entities/configuration";
import { getLedOption } from "@/entities/product/model/store/selectors";
import { reset, setActiveProfile } from "@/entities/product/model/store/slice";
import { createTestRuntimePort } from "@/features/playCanvasAdapter/lib/testRuntimePort";

import { createCommandRunner } from "../lib/createCommandRunner";

/** A runner built from the store alone, as listeners, restore and undo build it. */
const createStoreRunner = () =>
  createCommandRunner({
    getState: () => store.getState(),
    dispatch: (action) => store.dispatch(action),
    getFlow: () => "custom",
  });

describe("createCommandRunner", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(setActiveRuntimeBindings(null));
    store.dispatch(setActiveProfile(ushProfile));
    store.dispatch(setActiveCollectionId("urban-standard-height"));
  });

  it("reads the scene bindings the collection published to the store", async () => {
    const runner = createStoreRunner();
    const led = { attributeId: "LedOption", value: "Auto Fill", scope: "global" } as const;

    // No bindings yet and no scene: nothing is recorded.
    expect(await runner.change(led)).toMatchObject({ status: "error" });
    expect(getLedOption(store.getState())).not.toBe("Auto Fill");

    store.dispatch(setActiveRuntimeBindings(ushRuntimeBindings));

    expect(await runner.change(led)).toMatchObject({ status: "applied" });
    expect(getLedOption(store.getState())).toBe("Auto Fill");
  });

  it("keeps the bindings across a configuration reset, as they belong to the collection", () => {
    store.dispatch(setActiveRuntimeBindings(ushRuntimeBindings));
    store.dispatch(resetConfiguration());

    expect(store.getState().rootStateUI.configuration.runtimeBindings).toBe(ushRuntimeBindings);
  });

  it("hands each change the flow of the moment it is made", async () => {
    const test = createTestRuntimePort();
    let flow: "prebuilt" | "custom" = "prebuilt";
    const runner = createCommandRunner({
      getState: () => store.getState(),
      dispatch: (action) => store.dispatch(action),
      getFlow: () => flow,
      runtime: test.port,
    });

    await runner.change({ attributeId: "LedOption", value: "None", scope: "global" });
    flow = "custom";
    await runner.change({ attributeId: "LedOption", value: "Auto Fill", scope: "global" });

    expect(test.contexts.map((context) => context.flow)).toEqual(["prebuilt", "custom"]);
  });
});
