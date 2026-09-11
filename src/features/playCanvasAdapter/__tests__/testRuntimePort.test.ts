import { describe, expect, it } from "vitest";

import type { RuntimeChange, RuntimeContext } from "@/entities/configuration";

import { createTestRuntimePort } from "../lib/testRuntimePort";

const context: RuntimeContext = {
  collectionId: "urban-standard-height",
  flow: "custom",
  resolveRuntimeId: (cabinetId) => (cabinetId === "cab-1" ? "rt-1" : null),
  cabinetRuntimeIds: ["rt-1"],
};

const handle: RuntimeChange = { attributeId: "Handle", target: { scope: "cabinet", cabinetId: "cab-1" }, value: "x" };
const height: RuntimeChange = { attributeId: "Height", target: { scope: "global" }, value: 56 };

describe("createTestRuntimePort", () => {
  it("records every set with its context and resolved ids", async () => {
    const runtime = createTestRuntimePort();

    expect(await runtime.port.apply([handle, height], context)).toEqual({
      status: "applied",
      applied: [handle, height],
    });
    expect(runtime.calls).toEqual([[handle, height]]);
    expect(runtime.contexts[0]?.flow).toBe("custom");
    expect(runtime.resolvedIds).toEqual([["rt-1", null]]);
  });

  it("answers each status the real port can return", async () => {
    const runtime = createTestRuntimePort();

    runtime.setReady(false);
    expect(runtime.port.isReady()).toBe(false);
    expect(await runtime.port.apply([handle], context)).toEqual({ status: "not-ready" });
    runtime.setReady(true);

    runtime.rejectNext((change) => change.attributeId === "Height");
    expect(await runtime.port.apply([handle, height], context)).toMatchObject({
      status: "unsupported",
      unsupported: [{ change: height }],
    });

    runtime.failNext((change) => change.attributeId === "Height");
    expect(await runtime.port.apply([handle, height], context)).toMatchObject({
      status: "partial",
      applied: [handle],
      failed: [{ change: height, code: "scene-rejected" }],
    });

    runtime.failNext(() => true, "down", "scene-error");
    expect(await runtime.port.apply([handle], context)).toMatchObject({
      status: "failed",
      failed: [{ change: handle, code: "scene-error", message: "down" }],
    });

    expect(await runtime.port.apply([handle], context)).toEqual({ status: "applied", applied: [handle] });
  });
});
