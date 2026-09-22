import { describe, expect, it } from "vitest";

import { buildAddedCabinetRequest } from "../buildAddedCabinetRequest";

const config = { Width: 60, Height: 52, Depth: 52, Drawers: "2D", Handle: "G57", CabinetColor: "Antracite Matte OCF" };

describe("buildAddedCabinetRequest", () => {
  it("places the cabinet beside the clicked one with the builder's config and the width that fits", () => {
    const request = buildAddedCabinetRequest({
      cabinetType: "Sink-Cabinet",
      config,
      width: 40,
      sinkType: "Top_Tekorlux_Rectangular",
      countertopStyle: "Top",
      vesselColor: "Bianco",
      anchorRuntimeId: "cab-a",
      side: "right",
    });

    // The scene product is the port's to name; a side cabinet takes no basin.
    expect(request).toEqual({
      product: { productType: "Sink-Cabinet", config: { ...config, Width: 40 } },
      placement: { kind: "beside", anchorRuntimeId: "cab-a", side: "right" },
      afterPlacement: undefined,
    });
  });

  it("keeps the config's width when no width is given", () => {
    const request = buildAddedCabinetRequest({
      cabinetType: "Sink-Cabinet",
      config,
      width: null,
      anchorRuntimeId: "cab-a",
      side: "left",
    });

    expect(request.product.config.Width).toBe(60);
    expect(request.placement).toEqual({ kind: "beside", anchorRuntimeId: "cab-a", side: "left" });
  });

  it("gives a sink base the basin and countertop style of the configuration", () => {
    const request = buildAddedCabinetRequest({
      cabinetType: "Sink-Base",
      config,
      width: 60,
      sinkType: "Top_Tekorlux_Rectangular",
      countertopStyle: "Top",
      vesselColor: "Bianco",
      anchorRuntimeId: "cab-a",
      side: "right",
    });

    expect(request.product.config).toMatchObject({ sinkType: "Top_Tekorlux_Rectangular", CountertopStyle: "Top" });
    expect(request.afterPlacement).toBeUndefined();
  });

  it("gives a sink base on a vessel countertop the vessel placeholder and colours its basin once placed", () => {
    const request = buildAddedCabinetRequest({
      cabinetType: "Sink-Base",
      config,
      width: 60,
      sinkType: null,
      countertopStyle: "Vessel",
      vesselColor: "Bianco",
      anchorRuntimeId: "cab-a",
      side: "right",
    });

    expect(request.product.config).toMatchObject({ sinkType: "Vessel", CountertopStyle: "Vessel" });
    expect(request.afterPlacement).toEqual({ VesselColor: "Bianco" });
  });

  it("builds a config from the width alone before the builder's size is known", () => {
    const request = buildAddedCabinetRequest({
      cabinetType: "Sink-Cabinet",
      config: null,
      width: 80,
      anchorRuntimeId: "cab-a",
      side: "right",
    });

    expect(request.product).toEqual({ productType: "Sink-Cabinet", config: { Width: 80 } });
  });
});
