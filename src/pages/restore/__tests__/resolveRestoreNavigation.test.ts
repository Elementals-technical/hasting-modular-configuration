import { describe, expect, it } from "vitest";

import { resolveRestoreNavigation } from "../lib/resolveRestoreNavigation";

/**
 * The collection of a session is fixed at startup: CollectionReadinessGate blocks client
 * navigation that adds, removes or changes `collectionId`. A restore link carries only the
 * configuration id, so opening a configuration of another collection has to reload.
 */

describe("resolveRestoreNavigation", () => {
  it.each([
    ["a default session restores a collection of its own", null, "class"],
    ["the session runs another collection", "urban-standard-height", "class"],
  ])("reloads when %s", (_name, sessionCollectionId, savedCollectionId) => {
    expect(resolveRestoreNavigation({ sessionCollectionId, savedCollectionId })).toEqual({ kind: "reload" });
  });

  it.each([
    ["the saved configuration names the session collection", "class", "class"],
    ["the same collection is written with padding", "class", " class "],
    ["the saved configuration names no collection", "class", null],
    ["neither side names a collection", null, ""],
  ])("keeps the session when %s", (_name, sessionCollectionId, savedCollectionId) => {
    expect(resolveRestoreNavigation({ sessionCollectionId, savedCollectionId })).toEqual({ kind: "client" });
  });
});
