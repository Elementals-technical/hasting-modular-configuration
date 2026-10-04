import { beforeEach, describe, expect, it } from "vitest";

import { store } from "@/app/store";
import { getRuntimeSyncState, resetConfiguration } from "@/entities/configuration";
import { replacePlacedDividersForCabinet, reset } from "@/entities/product/model/store/slice";
import { createTestDividerPort } from "@/features/playCanvasAdapter";

import { clearDividers } from "../lib/clearDividers";

/**
 * C06: the dividers of the composition have one path to the scene and one writer of their
 * state. `DividersOption` is not this command's value — the step that picked it records it.
 */

const placedDividers = () => store.getState().rootStateUI.product.placedDividers;

const placeOne = () =>
  store.dispatch(
    replacePlacedDividersForCabinet({
      cabinetId: "rt-1",
      dividers: [{ key: "rt-1:Top:main", cabinetId: "rt-1", drawerType: "Top", zone: "main", type: "A" }],
    }),
  );

describe("clearDividers", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    placeOne();
  });

  it("clears the placed dividers of the products it names", async () => {
    const divider = createTestDividerPort();

    const result = await clearDividers(
      { runtimeIds: ["rt-1", "rt-2"] },
      { dispatch: (action) => store.dispatch(action), port: divider.port },
    );

    expect(result).toEqual({ status: "applied" });
    expect(divider.calls).toEqual([["rt-1", "rt-2"]]);
    expect(placedDividers()).toEqual([]);
  });

  it("records nothing when the scene is not ready", async () => {
    const divider = createTestDividerPort();
    divider.answerNext({ status: "not-ready" });

    const result = await clearDividers(
      { runtimeIds: ["rt-1"] },
      { dispatch: (action) => store.dispatch(action), port: divider.port },
    );

    expect(result).toMatchObject({ status: "error", code: "runtime-not-ready" });
    expect(placedDividers()).toHaveLength(1);
  });

  it("does not turn a refusal of the scene into a success", async () => {
    const divider = createTestDividerPort();
    divider.answerNext({ status: "failed", message: "no divider api" });

    const result = await clearDividers(
      { runtimeIds: ["rt-1"] },
      { dispatch: (action) => store.dispatch(action), port: divider.port },
    );

    expect(result).toMatchObject({ status: "error", code: "runtime-failed", message: "no divider api" });
    expect(placedDividers()).toHaveLength(1);
  });

  it("asks for a sync when the scene cleared only some of them", async () => {
    const divider = createTestDividerPort();
    divider.answerNext({ status: "partial", cleared: 1, message: "The scene cleared 1 of 2 dividers." });

    const result = await clearDividers(
      { runtimeIds: ["rt-1"] },
      { dispatch: (action) => store.dispatch(action), port: divider.port },
    );

    expect(result).toMatchObject({ status: "partial", needsSync: true });
    expect(placedDividers()).toEqual([]);
    expect(getRuntimeSyncState(store.getState())).toMatchObject({ needsSync: true });
  });
});
