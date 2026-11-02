import { describe, expect, it } from "vitest";

import { tricotRuntimeBindings } from "@/entities/collection/__tests__/tricotFixtures";

import ufBindingsDocument from "../../../../../../public/collections/urban-freestanding/runtime-bindings.json";
import { parseRuntimeBindings } from "../parseRuntimeBindings";
import { sceneValueOf, semanticValueOf } from "../resolveRuntimeBinding";
import { classRuntimeBindings } from "./classRuntimeBindingsFixture";
import { makoRuntimeBindings } from "./makoRuntimeBindingsFixture";

const ufResult = parseRuntimeBindings(ufBindingsDocument);
if (!ufResult.ok) throw new Error("Urban Freestanding bindings failed validation");
const ufBindings = ufResult.bindings;

/**
 * A value read back from the scene is the material asset the bindings send a configuration value as.
 * The bindings are the only place that knows those names, so they translate it back.
 */
describe("semanticValueOf", () => {
  it("reads a value map's scene name as the value it is sent for (Tricot)", () => {
    expect(semanticValueOf(tricotRuntimeBindings, "HandleGrooveColor", "Nero 433 Lacquered MT")).toBe("Nero 433 MT");
    expect(semanticValueOf(tricotRuntimeBindings, "CabinetColor", "Zafferano 412 Lacquered MT")).toBe(
      "Zafferano 412 MT",
    );
    expect(semanticValueOf(tricotRuntimeBindings, "DrawerPanelFluting", "Gessatto")).toBe("Gessato");
  });

  it("reads Mako's leg material from a patch that also enables the legs", () => {
    expect(semanticValueOf(makoRuntimeBindings, "LegColor", "Antracite 400 Lacquered MT")).toBe("Antracite 400 MT");
    expect(semanticValueOf(makoRuntimeBindings, "LegColor", "Enable")).toBe("Enable");
    expect(semanticValueOf(makoRuntimeBindings, "LegColor", "Gold")).toBe("Gold");
  });

  it("reads an identity binding's override as the value it replaces (Class)", () => {
    expect(semanticValueOf(classRuntimeBindings, "CabinetColor", "Acqua 419 Lacquered MT")).toBe("Acqua 419 MT");
  });

  it("returns as read a value no binding sends, a pending one and one without bindings", () => {
    expect(semanticValueOf(tricotRuntimeBindings, "CabinetColor", "Antracite Matte OCF")).toBe("Antracite Matte OCF");
    expect(semanticValueOf(tricotRuntimeBindings, "HandleGrooveColor", "Nero 433 MT")).toBe("Nero 433 MT");
    expect(semanticValueOf(null, "HandleGrooveColor", "Nero 433 Lacquered MT")).toBe("Nero 433 Lacquered MT");
  });

  // Callers translate only values the collection does not offer: Bianco Gloss TAL is a Tekorlux colour of
  // its own, and also the scene name the Syntesi Bianco Gloss TAN is sent as.
  it("translates a scene name that is also a colour of its own, which callers must not ask for", () => {
    expect(semanticValueOf(ufBindings, "CountertopColor", "Bianco Gloss TAL")).toBe("Bianco Gloss TAN");
  });
});

// A scene feature that takes an attribute's values under its own call (the Lower countertop's material)
// sends them as the binding does.
describe("sceneValueOf", () => {
  it("sends a value under the name its binding gives it, and reads back as that value", () => {
    expect(sceneValueOf(ufBindings, "CountertopColor", "Matte White")).toBe("Solid Surface Matte White");
    expect(sceneValueOf(ufBindings, "CountertopColor", "Sahara Noir Silky Matte TR8")).toBe("Sahara Noir Silky Matte");
    expect(semanticValueOf(ufBindings, "CountertopColor", "Solid Surface Matte White")).toBe("Matte White");
    expect(sceneValueOf(tricotRuntimeBindings, "CabinetColor", "Zafferano 412 MT")).toBe("Zafferano 412 Lacquered MT");
  });

  it("sends as it is a value the binding does not rename, and any value without bindings", () => {
    expect(sceneValueOf(ufBindings, "CountertopColor", "Bianco Male TFA")).toBe("Bianco Male TFA");
    expect(sceneValueOf(ufBindings, "NotBound", "Matte White")).toBe("Matte White");
    expect(sceneValueOf(null, "CountertopColor", "Matte White")).toBe("Matte White");
  });
});
