import { describe, expect, it, vi } from "vitest";

import { ConfiguratorError, createCommandPlacementId, isCommandPlacementSession } from "@/features/configuratorApi";

import { placeInSceneSlot, type SceneSlotClient, type SceneSlotRequest } from "../lib/sceneSlotPlacement";

const request: SceneSlotRequest = {
  sceneType: "UD-side-cabinet",
  config: { Width: 70, Height: 28, HandleStyle: "Duplex" },
  anchorRuntimeId: "UD-sink-cabinet-1",
  slot: "bottom",
};

const options = [
  { id: "option-right", kind: "right", anchorCabinetId: "UD-sink-cabinet-1", availability: "available", reasons: [] },
  { id: "option-bottom", kind: "bottom", anchorCabinetId: "UD-sink-cabinet-1", availability: "available", reasons: [] },
];

const fakeClient = (overrides: Partial<Record<keyof SceneSlotClient, unknown>> = {}) => {
  const client = Object.assign(
    {
      connect: vi.fn(async () => undefined),
      getPlacementOptions: vi.fn(async (): Promise<unknown[]> => options),
      beginAdd: vi.fn<
        (
          definitionId: string,
          selection: Record<string, unknown>,
          placement?: unknown,
        ) => Promise<{ sessionId: string; lifecycle: string }>
      >(async () => ({ sessionId: "command-placement-1", lifecycle: "preview" })),
      apply: vi.fn(async () => ({
        requestId: "command-placement-2",
        kind: "add",
        addedProductIds: ["UD-side-cabinet-new"],
      })),
      cancel: vi.fn(async () => ({ sessionId: "command-placement-1", lifecycle: "cancelled" })),
      dispose: vi.fn(),
    },
    overrides,
  );
  // A stand-in for the client: only what the placement calls, with the shapes the scene answers.
  return { client, createClient: () => client as unknown as SceneSlotClient };
};

describe("placeInSceneSlot", () => {
  it("places at the scene's option of that kind by the anchor, one selection for the option and the draft", async () => {
    const { client, createClient } = fakeClient();

    const result = await placeInSceneSlot(request, { createClient });

    expect(result).toEqual({ status: "applied", runtimeId: "UD-side-cabinet-new" });
    expect(client.getPlacementOptions).toHaveBeenCalledWith({
      definitionId: "UD-side-cabinet",
      selection: request.config,
      operation: "add",
      anchorCabinetId: "UD-sink-cabinet-1",
    });
    // The very object the option was offered for.
    expect(client.beginAdd).toHaveBeenCalledWith("UD-side-cabinet", request.config, {
      kind: "option",
      optionId: "option-bottom",
    });
    expect(client.beginAdd.mock.calls[0]?.[1]).toBe(request.config);
    expect(client.apply).toHaveBeenCalledWith("command-placement-1");
    expect(client.dispose).toHaveBeenCalledOnce();
  });

  it("places at a row end through the option of that side", async () => {
    const { client, createClient } = fakeClient();

    await placeInSceneSlot({ ...request, slot: "right" }, { createClient });

    expect(client.beginAdd).toHaveBeenCalledWith("UD-side-cabinet", request.config, {
      kind: "option",
      optionId: "option-right",
    });
  });

  it("refuses a place the cabinet does not fit, with the scene's reason, and opens no draft", async () => {
    const { client, createClient } = fakeClient({
      getPlacementOptions: vi.fn(async () => [
        { ...options[1], availability: "unavailable", reasons: [{ code: "DOES_NOT_FIT" }] },
      ]),
    });

    const result = await placeInSceneSlot(request, { createClient });

    expect(result).toEqual({
      status: "rejected",
      issues: [{ code: "placement-unavailable", message: "DOES_NOT_FIT" }],
    });
    expect(client.beginAdd).not.toHaveBeenCalled();
    expect(client.dispose).toHaveBeenCalledOnce();
  });

  it("refuses a place the scene does not offer there", async () => {
    const { createClient } = fakeClient({ getPlacementOptions: vi.fn(async () => [options[0]]) });

    const result = await placeInSceneSlot(request, { createClient });

    expect(result).toMatchObject({ status: "rejected", issues: [{ code: "placement-unavailable" }] });
  });

  it("puts away a draft the scene will not apply and reports the rule's text", async () => {
    const rule = { code: "NOTHING_ON_SINK_BASE", message: "A SC cannot be placed on or above a SB." };
    const { client, createClient } = fakeClient({
      apply: vi.fn(async () => {
        throw new ConfiguratorError("APPLY_UNAVAILABLE", "The cabinet draft cannot be applied.", {
          detail: { status: "invalid", reasons: [rule] },
        });
      }),
    });

    const result = await placeInSceneSlot(request, { createClient });

    expect(result).toEqual({ status: "rejected", issues: [{ code: "placement-unavailable", message: rule.message }] });
    expect(client.cancel).toHaveBeenCalledWith("command-placement-1");
    expect(client.dispose).toHaveBeenCalledOnce();
  });

  it("answers not-ready while the scene is busy, without a draft", async () => {
    const { client, createClient } = fakeClient({
      getPlacementOptions: vi.fn(async () => {
        throw Object.assign(new Error("busy"), { code: "COMPOSITION_BUSY" });
      }),
    });

    const result = await placeInSceneSlot(request, { createClient });

    expect(result).toEqual({ status: "not-ready" });
    expect(client.beginAdd).not.toHaveBeenCalled();
    expect(client.dispose).toHaveBeenCalledOnce();
  });

  it("names its sessions so the Drag & Drop controls leave them alone", () => {
    expect(isCommandPlacementSession(createCommandPlacementId())).toBe(true);
    expect(isCommandPlacementSession("draft-1")).toBe(false);
    expect(isCommandPlacementSession(null)).toBe(false);
  });
});
