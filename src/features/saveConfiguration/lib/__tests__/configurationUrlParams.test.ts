// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { buildPublicConfigurationShareUrl } from "../configurationUrlParams";

describe("configurationUrlParams", () => {
  it("builds a parent-site configuration URL from hostUrl", () => {
    expect(buildPublicConfigurationShareUrl("/prebuilt/model", "13507")).toBe(
      "http://localhost:3000/prebuilt/model?configId=13507",
    );
  });

  it("replaces an existing configId in the parent URL", () => {
    expect(buildPublicConfigurationShareUrl("/prebuilt/model?configId=old", "13507")).toBe(
      "http://localhost:3000/prebuilt/model?configId=13507",
    );
  });

  it("does not build a parent-site URL without hostUrl", () => {
    expect(buildPublicConfigurationShareUrl(null, "13507")).toBeNull();
  });
});
