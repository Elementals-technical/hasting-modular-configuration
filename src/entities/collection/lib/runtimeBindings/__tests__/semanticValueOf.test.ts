import { describe, expect, it } from "vitest";

import { tricotRuntimeBindings } from "@/entities/collection/__tests__/tricotFixtures";

import ufBindingsDocument from "../../../../../../public/collections/urban-freestanding/runtime-bindings.json";
import { parseRuntimeBindings } from "../parseRuntimeBindings";
import { semanticValueOf } from "../resolveRuntimeBinding";
import { classRuntimeBindings } from "./classRuntimeBindingsFixture";

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
