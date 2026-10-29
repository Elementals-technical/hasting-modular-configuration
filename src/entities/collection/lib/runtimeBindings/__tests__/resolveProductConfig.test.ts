import { describe, expect, it } from "vitest";

import { resolveProductConfig } from "../resolveProductConfig";

import type { RuntimeBindingSet } from "../../../model/runtimeBindings";

import { makoRuntimeBindings } from "./makoRuntimeBindingsFixture";
import { ushRuntimeBindings } from "./ushRuntimeBindingsFixture";

/** A value that goes to two more places: every product under another key, and one product type. */
const alsoBindings: RuntimeBindingSet = {
  schemaVersion: 1,
  collectionId: "test",
  productTypes: {},
  bindings: [
    {
      attributeId: "Body",
      status: "bound",
      target: { kind: "all" },
      values: { kind: "identity", sceneKey: "CabinetColor" },
      order: 50,
    },
    {
      attributeId: "Trim",
      status: "bound",
      target: { kind: "all" },
      values: { kind: "identity", sceneKey: "TrimColor" },
      also: [
        { target: { kind: "all" }, sceneKey: "GrooveColor" },
        { target: { kind: "productType", productType: "shelf-side" }, sceneKey: "CabinetColor" },
      ],
      order: 55,
    },
  ],
};

describe("resolveProductConfig", () => {
  it("places an Urban cabinet with the config it carries", () => {
    const config = {
      Width: 60,
      Height: 53,
      Depth: 50.5,
      Handle: "handle_urban_topcut",
      Drawers: "2",
      CabinetColor: "Pulpis Chiaro TKH",
      sinkType: "Top_Tekorlux_Rectangular",
      TopDrawerDividers: { zones: {} },
    };

    expect(resolveProductConfig(ushRuntimeBindings, config)).toEqual({
      ...config,
      // The canonical style reaches the scene in its legacy spelling.
      Drawers: "2D",
    });
  });

  it("keeps a value its binding cannot translate as the product carries it", () => {
    // A legacy scene spelling, and a target that differs by flow when none is given.
    expect(resolveProductConfig(ushRuntimeBindings, { Drawers: "1DWID", GrainDirection: "Vertical" })).toEqual({
      Drawers: "1DWID",
      GrainDirection: "Vertical",
    });
  });

  it("translates a value the scene knows under another name", () => {
    expect(resolveProductConfig(ushRuntimeBindings, { CountertopColor: "Bianco Gloss TAN" })).toEqual({
      CountertopColor: "Bianco Gloss TAL",
    });
  });

  it("places a Mako cabinet with the keys and values of the Mako scene", () => {
    expect(
      resolveProductConfig(makoRuntimeBindings, {
        Width: 80,
        Height: 56,
        Depth: 52,
        Handle: "G50",
        Drawers: "1",
        CabinetColor: "Nebbia 402 MT",
      }),
    ).toEqual({
      Width: 80,
      // The style decides the height and hides the legs of a one-drawer cabinet.
      Height: 26,
      Depth: 52,
      HandleStyle: "G50",
      Drawers: "1D",
      ShowLegs: "Disable",
      CabinetColor: "Nebbia 402 Lacquered MT",
    });
  });

  it("shows the legs of a Mako cabinet placed with a leg colour", () => {
    expect(resolveProductConfig(makoRuntimeBindings, { LegColor: "None", Drawers: "2" })).toEqual({
      Drawers: "2D",
      Height: 52,
      ShowLegs: "Enable",
      LegColor: "None",
    });
  });

  it("keeps a Mako cabinet copied from a scene config without legs once its legs were removed", () => {
    // The config the scene holds after the legs were removed: a copy of the cabinet takes it as it is.
    expect(resolveProductConfig(makoRuntimeBindings, { Drawers: "2", ShowLegs: "Disable", LegColor: "" })).toEqual({
      Drawers: "2D",
      Height: 52,
      ShowLegs: "Disable",
      LegColor: "",
    });
  });

  it("sends the mapped Mako basin but not values the collection only records or does not bind", () => {
    expect(
      resolveProductConfig(makoRuntimeBindings, {
        sinkType: "LB440",
        HandleGrooveColor: "White Matt",
        GrainDirection: "Vertical",
        Width: 60,
      }),
    ).toEqual({ sinkType: "Top_LB440", Width: 60 });
  });

  it("keeps an Urban handle a Mako cabinet cannot take under its own key, which the Mako scene ignores", () => {
    expect(resolveProductConfig(makoRuntimeBindings, { Handle: "handle_urban_topcut" })).toEqual({
      Handle: "handle_urban_topcut",
    });
  });

  it("sends a value under the other keys its binding names", () => {
    expect(resolveProductConfig(alsoBindings, { Body: "white", Trim: "bronze" }, undefined, "cabinet")).toEqual({
      CabinetColor: "white",
      TrimColor: "bronze",
      GrooveColor: "bronze",
    });
  });

  it("gives a delivery for one product type to a product of that type alone, after the earlier phase", () => {
    expect(resolveProductConfig(alsoBindings, { Body: "white", Trim: "bronze" }, undefined, "shelf-side")).toEqual({
      // The trim colour is this product's cabinet colour, and it wins over the body colour.
      CabinetColor: "bronze",
      TrimColor: "bronze",
      GrooveColor: "bronze",
    });
    // Without the type of the product nothing addressed to a type is taken.
    expect(resolveProductConfig(alsoBindings, { Body: "white", Trim: "bronze" }).CabinetColor).toBe("white");
  });
});
