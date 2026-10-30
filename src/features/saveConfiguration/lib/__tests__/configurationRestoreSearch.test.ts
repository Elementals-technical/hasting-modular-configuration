import { describe, expect, it } from "vitest";

import { buildConfigurationRestoreSearch } from "../configurationUrlParams";

describe("buildConfigurationRestoreSearch", () => {
  it("carries the saved collection so the page loads it", () => {
    const search = new URLSearchParams(
      buildConfigurationRestoreSearch({ configId: "13507", hostUrl: "/prebuilt/model", collectionId: "mako" }),
    );

    expect(Object.fromEntries(search)).toEqual({ configId: "13507", collectionId: "mako", hostUrl: "/prebuilt/model" });
  });

  it("names no collection for a legacy payload", () => {
    expect(buildConfigurationRestoreSearch({ configId: "13507", hostUrl: null, collectionId: null })).toBe(
      "?configId=13507",
    );
  });
});
