import { describe, expect, it, vi } from "vitest";

import contractFixture from "@/features/drawerOrganizers/__tests__/fixtures/contract/contract.v1.json";
import type { SceneProductsRead } from "@/utils/functions/playcanvas/sceneBridge";

import { createSceneReader } from "../lib/createSceneReader";

/** The scene reader carries a Ph2 product's `DrawerOrganizers` key to C (concept §6.2, read-model C). */

// Vitest runs this in Node; keep Node-only types out of the app's DOM tsconfig (as bridge.test.ts does).
const vm = await vi.importActual<{ runInNewContext(code: string): Record<string, unknown> }>("node:vm");

const readerOf = (configs: Record<string, Record<string, unknown>>) =>
  createSceneReader({
    scene: {
      read: async (): Promise<SceneProductsRead> => ({ status: "ready", order: Object.keys(configs), configs }),
    },
  });

const SIZE = { Width: 120, Height: 50, Depth: 46 };
const DIMENSIONS = { width: 120, height: 50, depth: 46 };
const stored = contractFixture.cases.find(({ name }) => name === "sc120-example1")!.expected.state;

describe("createSceneReader: DrawerOrganizers", () => {
  it("reports the stored key of an organizer product", async () => {
    const result = await readerOf({ "rt-a": { ...SIZE, DrawerOrganizers: stored } }).read(["rt-a"]);

    expect(result).toEqual({
      status: "ready",
      order: ["rt-a"],
      cabinets: [{ runtimeId: "rt-a", dimensions: DIMENSIONS, organizers: { status: "ok", value: stored } }],
    });
  });

  it("reports a key without sets as absent, and a newer build's data as unsupported", async () => {
    const result = await readerOf({
      "rt-a": { ...SIZE, DrawerOrganizers: null },
      "rt-b": { ...SIZE, DrawerOrganizers: { version: 2, Top: {} } },
    }).read(["rt-a", "rt-b"]);

    expect(result.status === "ready" && result.cabinets.map(({ organizers }) => organizers)).toEqual([
      { status: "absent" },
      { status: "unsupported-version", version: 2 },
    ]);
  });

  it("keeps the old shape for a product without the key (USH and every other collection)", async () => {
    const result = await readerOf({ "rt-a": { ...SIZE, TopDrawerDividers: { zones: {} } } }).read(["rt-a"]);

    expect(result.status === "ready" && result.cabinets[0]).toEqual({ runtimeId: "rt-a", dimensions: DIMENSIONS });
    expect(result.status === "ready" && Object.keys(result.cabinets[0])).toEqual(["runtimeId", "dimensions"]);
  });

  it("copies the key out of the scene's realm", async () => {
    const foreign = vm.runInNewContext(`(${JSON.stringify({ ...SIZE, DrawerOrganizers: stored })})`);

    const result = await readerOf({ "rt-a": { ...foreign } }).read(["rt-a"]);
    const entry = result.status === "ready" ? result.cabinets[0].organizers : undefined;

    expect(entry).toEqual({ status: "ok", value: stored });
    expect(entry?.status === "ok" && Object.getPrototypeOf(entry.value.Top!.columns)).toBe(Array.prototype);
  });
});
