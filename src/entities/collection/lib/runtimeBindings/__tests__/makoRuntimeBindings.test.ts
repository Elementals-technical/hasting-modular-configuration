import { describe, expect, it } from "vitest";

import { CORE_ATTRIBUTE_IDS } from "@/entities/configuration/model/ownership";

import { selectOptionValues } from "../../productProfileSelectors";
import { configurationValueOf, isStateOnlyResolution, resolveRuntimeBinding } from "../resolveRuntimeBinding";
import { validateRuntimeBindings } from "../validateRuntimeBindings";

import { makoProfile } from "../../../__tests__/makoProfileFixture";
import { makoRuntimeBindings } from "./makoRuntimeBindingsFixture";

/**
 * The Mako scene products and options, as the scene documents them: Mako-side-cabinet and
 * Mako-sink-cabinet, HandleStyle G57/G50, Height 26/52 (the drawer layout follows it),
 * ShowLegs Enable/Disable and the colours as exact material names.
 */

// Mako has no UI fields yet, so the C01 registry and the dimensions are what needs a decision.
const REQUIRED_ATTRIBUTE_IDS = [...new Set([...CORE_ATTRIBUTE_IDS, "Height", "Width", "Depth"])];

const patchOf = (attributeId: string, value: string | number) => {
  const resolution = resolveRuntimeBinding(makoRuntimeBindings, attributeId, value);
  return resolution.ok && !isStateOnlyResolution(resolution) ? resolution.patch : null;
};

describe("mako runtime bindings", () => {
  it("cover the profile and every required attribute without a finding", () => {
    expect(validateRuntimeBindings(makoProfile, makoRuntimeBindings, REQUIRED_ATTRIBUTE_IDS)).toEqual([]);
  });

  it("place Sink Base and Side Cabinet as the Mako scene products", () => {
    expect(makoRuntimeBindings.productTypes).toEqual({
      "Sink-Base": "Mako-sink-cabinet",
      "Sink-Cabinet": "Mako-side-cabinet",
    });
  });

  it("send the handle as HandleStyle", () => {
    expect(patchOf("Handle", "G57")).toEqual({ HandleStyle: "G57" });
    expect(patchOf("Handle", "G50")).toEqual({ HandleStyle: "G50" });
    expect(resolveRuntimeBinding(makoRuntimeBindings, "Handle", "handle_urban_topcut")).toMatchObject({
      reason: "unknown-value",
    });
  });

  it("send the drawer style as the height the scene lays the drawers out from, without legs", () => {
    expect(patchOf("Drawers", "1")).toEqual({ Drawers: "1D", Height: 26, ShowLegs: "Disable" });
    expect(patchOf("Drawers", "2")).toEqual({ Drawers: "2D", Height: 52, ShowLegs: "Disable" });
    expect(patchOf("Height", 26)).toEqual({ Height: 26 });
    expect(resolveRuntimeBinding(makoRuntimeBindings, "Height", 56)).toMatchObject({ reason: "unknown-value" });
  });

  it("show the legs with a leg colour and hide them without one, after the drawer style", () => {
    // No colour hides the legs and clears their colour, so the scene config says "no legs" too.
    expect(patchOf("LegColor", "")).toEqual({ ShowLegs: "Disable", LegColor: "" });
    expect(patchOf("LegColor", "Gold")).toEqual({ ShowLegs: "Enable", LegColor: "Gold" });
    // The models with legs show them in the cabinet colour.
    expect(patchOf("LegColor", "None")).toEqual({ ShowLegs: "Enable", LegColor: "None" });

    for (const value of selectOptionValues(makoProfile, "LegColor")) {
      expect(patchOf("LegColor", value)).toEqual({ ShowLegs: "Enable", LegColor: value });
    }

    const order = (attributeId: string, value: string) => {
      const resolution = resolveRuntimeBinding(makoRuntimeBindings, attributeId, value);
      return resolution.ok && !isStateOnlyResolution(resolution) ? resolution.order : undefined;
    };
    expect(order("Drawers", "2")).toBeGreaterThan(order("Height", "52") ?? Infinity);
    expect(order("LegColor", "Gold")).toBeGreaterThan(order("Drawers", "2") ?? Infinity);
  });

  it("send the colours as material names", () => {
    expect(patchOf("CabinetColor", "Nebbia 402 MT")).toEqual({ CabinetColor: "Nebbia 402 Lacquered MT" });
    expect(patchOf("CabinetColor", "GNebbia 402 MT")).toEqual({ CabinetColor: "Nebbia 402 Glass MT" });
    expect(patchOf("HandleColor", "Nebbia 402 MT")).toEqual({ HandleColor: "Nebbia 402 Lacquered MT" });
    expect(patchOf("HandleColor", "Silver")).toEqual({ HandleColor: "Silver" });
    expect(patchOf("LegColor", "Nebbia 402 MT")).toEqual({ ShowLegs: "Enable", LegColor: "Nebbia 402 Lacquered MT" });
    expect(patchOf("CountertopColor", "Nero 433 GL")).toEqual({ CountertopColor: "Nero 433 Glass GL" });
  });

  it("read the chosen colour back from the material name the scene holds", () => {
    const read = (sceneValue: string, chosenValue: string) =>
      configurationValueOf(makoRuntimeBindings, "CabinetColor", sceneValue, chosenValue);

    expect(read("Nebbia 402 Lacquered MT", "Nebbia 402 MT")).toBe("Nebbia 402 MT");
    // A scene value the chosen colour is not sent as stays as it was read.
    expect(read("Nebbia 402 Lacquered MT", "Acqua 419 MT")).toBe("Nebbia 402 Lacquered MT");
    expect(configurationValueOf(null, "CabinetColor", "Nebbia 402 Lacquered MT", "Nebbia 402 MT")).toBe(
      "Nebbia 402 Lacquered MT",
    );
  });

  it("record the basin and the groove colour without a scene call", () => {
    for (const attributeId of ["sinkType", "VesselColor", "HandleGrooveColor"]) {
      expect(isStateOnlyResolution(resolveRuntimeBinding(makoRuntimeBindings, attributeId, "x"))).toBe(true);
    }
  });
});
