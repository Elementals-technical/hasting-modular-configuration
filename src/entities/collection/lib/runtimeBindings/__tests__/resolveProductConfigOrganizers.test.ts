import { describe, expect, it } from "vitest";

import { tricotRuntimeBindings } from "@/entities/collection/__tests__/tricotFixtures";

import { findProductConfigBindingErrors, resolveProductConfig } from "../resolveProductConfig";

/**
 * Tricot is strict: a key without a scene translation stops placement. `DrawerOrganizers` is written by
 * the scene's own commands and comes back with every saved config, so it passes like the divider zones.
 */

const config = {
  Width: 60,
  DrawerOrganizers: { version: 1, Bot: { style: "Metal", columns: [{ slot: 0, positions: [2] }] } },
};

describe("resolveProductConfig: DrawerOrganizers", () => {
  it("lets a strict Tricot config with the key through, and places the product with it", () => {
    expect(tricotRuntimeBindings.strictProductConfig).toBe(true);
    expect(findProductConfigBindingErrors(tricotRuntimeBindings, config)).toEqual([]);
    expect(resolveProductConfig(tricotRuntimeBindings, config)).toMatchObject({
      DrawerOrganizers: config.DrawerOrganizers,
    });
  });
});
