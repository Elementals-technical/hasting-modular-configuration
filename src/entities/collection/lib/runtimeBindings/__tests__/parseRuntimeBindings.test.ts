import { describe, expect, it } from "vitest";

import ushRuntimeBindingsDocument from "../../../../../../public/collections/urban-standard-height/runtime-bindings.json";

import { parseRuntimeBindings } from "../parseRuntimeBindings";

const withBinding = (binding: unknown) => ({
  schemaVersion: 1,
  collectionId: "test",
  productTypes: {},
  bindings: [binding],
});

const codesOf = (input: unknown) => {
  const result = parseRuntimeBindings(input);
  return result.ok ? [] : result.diagnostics.map(({ code, dataPath }) => [code, dataPath]);
};

describe("parseRuntimeBindings", () => {
  it("accepts the USH document and keeps its entries in order", () => {
    const result = parseRuntimeBindings(ushRuntimeBindingsDocument);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.bindings.collectionId).toBe("urban-standard-height");
    expect(result.bindings.productTypes["Side-Cabinet"]).toBe("Sink-Cabinet");
    expect(result.bindings.bindings[0]?.attributeId).toBe("Handle");
    expect(result.bindings.bindings.find(({ attributeId }) => attributeId === "Drawers")).toMatchObject({
      status: "bound",
      values: { kind: "map", patches: { "2": { Drawers: "2D" } } },
    });
  });

  it("rejects a document that is not a bindings table", () => {
    expect(codesOf(null)).toEqual([["bindings.invalid_root", ""]]);
    expect(codesOf({ schemaVersion: 1, collectionId: "test", productTypes: {} })).toEqual([
      ["bindings.missing_field", "/bindings"],
    ]);
    expect(codesOf({ collectionId: "", productTypes: {}, bindings: [] })).toEqual([
      ["bindings.missing_field", "/schemaVersion"],
      ["bindings.missing_field", "/collectionId"],
    ]);
  });

  it("requires a runtime product type for every listed cabinet type", () => {
    expect(codesOf({ schemaVersion: 1, collectionId: "test", bindings: [] })).toEqual([
      ["bindings.missing_field", "/productTypes"],
    ]);
    expect(
      codesOf({ schemaVersion: 1, collectionId: "test", productTypes: { "Side-Cabinet": "" }, bindings: [] }),
    ).toEqual([["bindings.invalid_field_type", "/productTypes/Side-Cabinet"]]);
  });

  it("requires a reason for an unbound entry", () => {
    expect(codesOf(withBinding({ attributeId: "LedOption", status: "unbound" }))).toEqual([
      ["bindings.missing_field", "/bindings/0/reason"],
    ]);
  });

  it("rejects an unknown status, target or values kind", () => {
    expect(codesOf(withBinding({ attributeId: "A", status: "maybe" }))).toEqual([
      ["binding.invalid_status", "/bindings/0/status"],
    ]);
    expect(
      codesOf(withBinding({ attributeId: "A", status: "bound", target: { kind: "scene" }, values: { kind: "copy" } })),
    ).toEqual([
      ["binding.invalid_target", "/bindings/0/target/kind"],
      ["binding.invalid_values", "/bindings/0/values/kind"],
    ]);
    expect(
      codesOf(
        withBinding({
          attributeId: "A",
          status: "bound",
          target: { kind: "productType" },
          values: { kind: "identity", sceneKey: "A" },
        }),
      ),
    ).toEqual([["binding.invalid_target", "/bindings/0/target/productType"]]);
  });

  it("reads a target that differs by flow and reports each broken flow", () => {
    const byFlow = (target: unknown) =>
      withBinding({
        attributeId: "GrainDirection",
        status: "bound",
        target,
        values: { kind: "identity", sceneKey: "GrainDirection" },
      });

    const result = parseRuntimeBindings(
      byFlow({ kind: "byFlow", prebuilt: { kind: "all" }, custom: { kind: "cabinets" } }),
    );
    expect(result.ok && result.bindings.bindings[0]).toMatchObject({
      target: { kind: "byFlow", prebuilt: { kind: "all" }, custom: { kind: "cabinets" } },
    });

    expect(codesOf(byFlow({ kind: "byFlow", prebuilt: { kind: "everywhere" } }))).toEqual([
      ["binding.invalid_target", "/bindings/0/target/prebuilt/kind"],
      ["binding.invalid_target", "/bindings/0/target/custom"],
    ]);
  });

  it("points at a renamed value the scene cannot receive", () => {
    expect(
      codesOf(
        withBinding({
          attributeId: "CountertopColor",
          status: "bound",
          target: { kind: "all" },
          values: { kind: "identity", sceneKey: "CountertopColor", overrides: { "Bianco Gloss TAN": ["TAL"] } },
        }),
      ),
    ).toEqual([["binding.invalid_values", "/bindings/0/values/overrides/Bianco Gloss TAN"]]);
  });

  it("reads the phase and the step sent before the value", () => {
    const towelBar = {
      attributeId: "TowelBarOption",
      status: "bound",
      target: { kind: "all" },
      values: { kind: "map", patches: { Left: { TowelBar: "TowelBar40_R", TowelBarSide: "left" } } },
      order: 70,
      resetBefore: { TowelBar: "None", TowelBarSide: "both" },
    };

    const result = parseRuntimeBindings(withBinding(towelBar));
    expect(result.ok && result.bindings.bindings[0]).toMatchObject({
      order: 70,
      resetBefore: { TowelBar: "None", TowelBarSide: "both" },
    });

    expect(codesOf(withBinding({ ...towelBar, order: "first", resetBefore: { TowelBar: null } }))).toEqual([
      ["bindings.invalid_field_type", "/bindings/0/order"],
      ["binding.invalid_values", "/bindings/0/resetBefore/TowelBar"],
    ]);
  });

  it("points at the exact scene value that cannot be sent", () => {
    expect(
      codesOf(
        withBinding({
          attributeId: "Drawers",
          status: "bound",
          target: { kind: "product" },
          values: { kind: "map", patches: { "1": { Drawers: "1D" }, "2": { Drawers: { nested: true } } } },
        }),
      ),
    ).toEqual([["binding.invalid_values", "/bindings/0/values/patches/2/Drawers"]]);

    expect(
      codesOf(
        withBinding({
          attributeId: "Drawers",
          status: "bound",
          target: { kind: "product" },
          values: { kind: "map", patches: {} },
        }),
      ),
    ).toEqual([["binding.invalid_values", "/bindings/0/values/patches"]]);
  });
});
