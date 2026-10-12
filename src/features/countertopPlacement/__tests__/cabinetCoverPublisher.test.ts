import { afterEach, describe, expect, it, vi } from "vitest";

import type { CabinetCoverSegment, CountertopState } from "@/features/configuratorApi";
import {
  getCabinetCoverRuntime,
  setCabinetCoverRuntime,
  subscribeCabinetCoverRuntime,
  type CabinetCoverRuntime,
} from "@/shared/lib/cabinetCoverRuntime";

import { createCabinetCoverPublisher } from "../lib/cabinetCoverPublisher";

const top = (offsetY: number, compositionId = "cabinets"): CountertopState => ({
  readiness: "ready",
  productId: "Top_Solid-1",
  compositionId,
  offset: { x: 0, y: offsetY },
});
const slab = (widthM: number): CabinetCoverSegment => ({
  productId: "Cabinet_Cover-1",
  widthM,
  depthM: 0.4397,
  cabinetIds: ["ULH-sink-cabinet-1"],
  materialId: "Colortech Bianco 10B",
});
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("cabinet cover publisher", () => {
  afterEach(() => setCabinetCoverRuntime(null));

  it("publishes actual covers with their material, even for a zero-offset Upper", async () => {
    const published: (CabinetCoverRuntime | null)[] = [];
    const readCovers = vi.fn(async () => [slab(0.6)]);
    const publish = createCabinetCoverPublisher({ readCovers, publish: (next) => published.push(next) });

    publish(top(0.12));
    await flush();
    expect(published.at(-1)).toEqual({
      compositionId: "cabinets",
      covers: [{ widthCm: 60, cabinetIds: ["ULH-sink-cabinet-1"], materialId: "Colortech Bianco 10B" }],
    });

    publish(top(0));
    await flush();
    expect(published.at(-1)?.covers[0].materialId).toBe("Colortech Bianco 10B");
    expect(readCovers).toHaveBeenCalledTimes(2);

    publish({ ...top(0), readiness: "not-ready" });
    await flush();
    expect(published.at(-1)).toBeNull();
  });

  it("reads once at a time and then only the newest pose", async () => {
    let release: () => void = () => undefined;
    const readCovers = vi
      .fn<() => Promise<CabinetCoverSegment[] | null>>()
      .mockImplementationOnce(() => new Promise((resolve) => (release = () => resolve([slab(0.6)]))))
      .mockResolvedValue([slab(1.2)]);
    const published: (CabinetCoverRuntime | null)[] = [];
    const publish = createCabinetCoverPublisher({ readCovers, publish: (next) => published.push(next) });

    publish(top(0.12));
    publish(top(0.13));
    publish(top(0.14));
    release();
    await flush();
    await flush();

    expect(readCovers).toHaveBeenCalledTimes(2);
    expect(published.map((next) => next?.covers[0].widthCm)).toEqual([120]);
  });

  it("does not republish an outstanding read after player cleanup", async () => {
    let release: (segments: CabinetCoverSegment[] | null) => void = () => undefined;
    const published = vi.fn();
    const publish = createCabinetCoverPublisher({
      readCovers: () =>
        new Promise((resolve) => {
          release = resolve;
        }),
      publish: published,
    });
    publish(top(0));
    publish.reset();
    release([slab(0.6)]);
    await flush();
    expect(published).not.toHaveBeenCalled();
  });

  it("publishes none when the build has no covers or the read fails", async () => {
    const onError = vi.fn();
    const published: (CabinetCoverRuntime | null)[] = [];
    const withoutCovers = createCabinetCoverPublisher({
      readCovers: async () => null,
      publish: (n) => published.push(n),
    });
    const failing = createCabinetCoverPublisher({
      readCovers: async () => Promise.reject(new Error("scene gone")),
      publish: (n) => published.push(n),
      onError,
    });

    withoutCovers(top(0.12));
    failing(top(0.12));
    await flush();

    expect(published).toEqual([null, null]);
    expect(onError).toHaveBeenCalledOnce();
  });
});

describe("cabinet cover runtime", () => {
  afterEach(() => setCabinetCoverRuntime(null));

  it("notifies only when the covers change", () => {
    const listener = vi.fn();
    const stop = subscribeCabinetCoverRuntime(listener);

    setCabinetCoverRuntime({
      compositionId: "cabinets",
      covers: [{ widthCm: 60, cabinetIds: ["ULH-sink-cabinet-1"], materialId: "Colortech Bianco 10B" }],
    });
    setCabinetCoverRuntime({
      compositionId: "cabinets",
      covers: [{ widthCm: 60, cabinetIds: ["ULH-sink-cabinet-1"], materialId: "Colortech Bianco 10B" }],
    });
    expect(listener).toHaveBeenCalledOnce();
    expect(getCabinetCoverRuntime()?.covers).toEqual([
      { widthCm: 60, cabinetIds: ["ULH-sink-cabinet-1"], materialId: "Colortech Bianco 10B" },
    ]);

    setCabinetCoverRuntime({
      compositionId: "cabinets",
      covers: [{ widthCm: 60, cabinetIds: ["ULH-sink-cabinet-1"], materialId: "Blu Pavone A6 GL" }],
    });
    expect(listener).toHaveBeenCalledTimes(2);

    setCabinetCoverRuntime(null);
    expect(listener).toHaveBeenCalledTimes(3);
    stop();
  });
});
