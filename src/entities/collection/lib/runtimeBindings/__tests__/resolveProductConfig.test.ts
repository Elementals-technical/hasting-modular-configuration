import { describe, expect, it } from "vitest";

import { resolveProductConfig } from "../resolveProductConfig";

import { makoRuntimeBindings } from "./makoRuntimeBindingsFixture";
import { ushRuntimeBindings } from "./ushRuntimeBindingsFixture";

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
      CabinetColor: "Nebbia 402 MT",
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

  it("sends nothing the collection only records or does not bind", () => {
    expect(
      resolveProductConfig(makoRuntimeBindings, {
        sinkType: "LB440",
        HandleGrooveColor: "White Matt",
        GrainDirection: "Vertical",
        Width: 60,
      }),
    ).toEqual({ Width: 60 });
  });

  it("keeps an Urban handle a Mako cabinet cannot take under its own key, which the Mako scene ignores", () => {
    expect(resolveProductConfig(makoRuntimeBindings, { Handle: "handle_urban_topcut" })).toEqual({
      Handle: "handle_urban_topcut",
    });
  });
});
