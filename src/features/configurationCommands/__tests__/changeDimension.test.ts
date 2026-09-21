import { beforeEach, describe, expect, it } from "vitest";

import { store } from "@/app/store";
import {
  getCabinetEntries,
  resetConfiguration,
  setActiveCollectionId,
  syncCabinets,
} from "@/entities/configuration";
import { reset } from "@/entities/product/model/store/slice";
import { createTestRuntimePort } from "@/features/playCanvasAdapter";

import { changeDimension } from "../lib/changeDimension";

const setUp = () => {
  store.dispatch(reset());
  store.dispatch(resetConfiguration());
  store.dispatch(setActiveCollectionId("urban-standard-height"));
  store.dispatch(syncCabinets(["runtime-a", "runtime-b"]));
};

const run = (change: Parameters<typeof changeDimension>[0], runtime = createTestRuntimePort()) =>
  changeDimension(change, {
    getState: store.getState,
    dispatch: store.dispatch,
    runtime: runtime.port,
    flow: "custom",
  });

describe("changeDimension", () => {
  beforeEach(setUp);

  it("sends Width to exactly the cabinet addressed by its stable key", async () => {
    const runtime = createTestRuntimePort();
    const result = await run({ attributeId: "Width", value: 80, scope: "cabinet", cabinetId: "cab-2" }, runtime);

    expect(result.status).toBe("applied");
    expect(runtime.calls).toEqual([[expect.objectContaining({ attributeId: "Width", value: 80, target: { scope: "cabinet", cabinetId: "cab-2" } })]]);
    expect(runtime.resolvedIds[0]).toEqual(["runtime-b"]);
  });

  it("broadcasts Depth as a composition command", async () => {
    const runtime = createTestRuntimePort();
    const result = await run({ attributeId: "Depth", value: 46, scope: "global" }, runtime);

    expect(result.status).toBe("applied");
    expect(runtime.calls[0][0]).toMatchObject({ attributeId: "Depth", target: { scope: "global" }, value: 46 });
    expect(runtime.contexts[0]?.cabinetRuntimeIds).toEqual(getCabinetEntries(store.getState()).map(({ runtimeId }) => runtimeId));
  });

  it("rejects an unknown target and non-finite values before touching the runtime", async () => {
    const runtime = createTestRuntimePort();
    await expect(run({ attributeId: "Width", value: 80, scope: "cabinet", cabinetId: "cab-99" }, runtime)).resolves.toMatchObject({
      status: "error",
      code: "unknown-target",
    });
    await expect(run({ attributeId: "Depth", value: Number.NaN, scope: "global" }, runtime)).resolves.toMatchObject({
      status: "error",
      code: "runtime-failed",
    });
    expect(runtime.calls).toEqual([]);
  });
});
