import { useEffect } from "react";

import { createConfiguratorBridge } from "@/features/configuratorApi";

type RoomBridge = { setRoomCollection?(collectionId: string | null): Promise<boolean> };

/**
 * Tells the PlayCanvas scene which collection is open, so the scene places the room for it
 * (ULH lowers the room ~80 cm under its wall-hung cabinets) without waiting for the first cabinet.
 * Re-sent whenever the scene becomes ready (a reloaded iframe starts without it) or the collection
 * changes. Builds without `ConfiguratorAPI.room` ignore it; the room is decoration, so failures are quiet.
 */
export function useSceneRoomCollection(
  collectionId: string | null | undefined,
  ready: boolean,
  createBridge: () => RoomBridge = createConfiguratorBridge,
) {
  useEffect(() => {
    if (!ready) return;
    void Promise.resolve()
      .then(() => createBridge().setRoomCollection?.(collectionId ?? null))
      .catch(() => undefined);
  }, [collectionId, createBridge, ready]);
}
