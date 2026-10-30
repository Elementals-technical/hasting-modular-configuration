// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useSceneRoomCollection } from "../lib/useSceneRoomCollection";

describe("useSceneRoomCollection", () => {
  it("sends the open collection once the scene is ready and again when it changes", async () => {
    const setRoomCollection = vi.fn(async () => true);
    const createBridge = () => ({ setRoomCollection });
    const { rerender } = renderHook(({ id, ready }) => useSceneRoomCollection(id, ready, createBridge), {
      initialProps: { id: "urban-low-height" as string | null, ready: false },
    });
    expect(setRoomCollection).not.toHaveBeenCalled();
    rerender({ id: "urban-low-height", ready: true });
    await waitFor(() => expect(setRoomCollection).toHaveBeenLastCalledWith("urban-low-height"));
    rerender({ id: "class", ready: true });
    await waitFor(() => expect(setRoomCollection).toHaveBeenLastCalledWith("class"));
    expect(setRoomCollection).toHaveBeenCalledTimes(2);
  });

  it("stays quiet when the build has no room API or the call fails", async () => {
    const failing = vi.fn(async () => { throw new Error("boom"); });
    renderHook(() => useSceneRoomCollection("urban-low-height", true, () => ({ setRoomCollection: failing })));
    await waitFor(() => expect(failing).toHaveBeenCalled());
    renderHook(() => useSceneRoomCollection("urban-low-height", true, () => ({})));
  });
});
