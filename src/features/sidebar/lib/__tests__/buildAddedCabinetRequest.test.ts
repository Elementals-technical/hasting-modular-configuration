import { describe, expect, it } from "vitest";

import { tricotProfile } from "@/entities/collection/__tests__/tricotFixtures";

import { buildAddedCabinet, buildAddedCabinetRequest } from "../buildAddedCabinetRequest";

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

  it("places the cabinet where a '+' of a row with columns stands: the free place of a column, a row end", () => {
    const bottom = buildAddedCabinetRequest({
      cabinetType: "Sink-Cabinet",
      config,
      width: 70,
      anchorRuntimeId: "UD-sink-cabinet-1",
      side: "bottom",
    });
    const hangingEnd = buildAddedCabinetRequest({
      cabinetType: "Sink-Cabinet",
      config,
      width: 70,
      anchorRuntimeId: "UD-side-cabinet-1",
      side: "left-top",
    });

    expect(bottom.placement).toEqual({ kind: "slot", anchorRuntimeId: "UD-sink-cabinet-1", slot: "bottom" });
    expect(hangingEnd.placement).toEqual({ kind: "slot", anchorRuntimeId: "UD-side-cabinet-1", slot: "left" });
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

  // Tricot names its vessels itself (Iris → Vessel_Iris in the scene), as Class does.
  it("colours a vessel the collection names itself once placed, as an Urban vessel", () => {
    const request = buildAddedCabinetRequest({
      cabinetType: "Sink-Base",
      config,
      width: 60,
      sinkType: "Iris",
      countertopStyle: "vessel",
      vesselColor: "Salvia 415 MT",
      profile: tricotProfile,
      anchorRuntimeId: "cab-a",
      side: "right",
    });

    expect(request.product.config).toMatchObject({ sinkType: "Iris", CountertopStyle: "vessel" });
    expect(request.afterPlacement).toEqual({ VesselColor: "Salvia 415 MT" });
  });

  it("gives an integrated basin of such a collection no vessel colour", () => {
    const request = buildAddedCabinetRequest({
      cabinetType: "Sink-Base",
      config,
      width: 60,
      sinkType: "LB440",
      countertopStyle: "integrated",
      vesselColor: "Salvia 415 MT",
      profile: tricotProfile,
      anchorRuntimeId: "cab-a",
      side: "right",
    });

    expect(request.afterPlacement).toBeUndefined();
  });

  it("adds the cabinet a Drag & Drop Add places as its + does: the basin, the countertop style, a vessel's colour", () => {
    const sinkBase = {
      cabinetType: "Sink-Base",
      config,
      width: null,
      sinkType: "Top_HPL/Fenix_Prisma_Gres",
      countertopStyle: "Top",
    };
    const vessel = { ...sinkBase, sinkType: null, countertopStyle: "Vessel", vesselColor: "Bianco" };

    expect(buildAddedCabinet(sinkBase)).toEqual({
      product: {
        productType: "Sink-Base",
        config: { ...config, sinkType: "Top_HPL/Fenix_Prisma_Gres", CountertopStyle: "Top" },
      },
      afterPlacement: undefined,
    });
    expect(buildAddedCabinet(vessel).afterPlacement).toEqual({ VesselColor: "Bianco" });
    for (const cabinet of [sinkBase, vessel]) {
      const request = buildAddedCabinetRequest({ ...cabinet, anchorRuntimeId: "cab-a", side: "right" });
      expect(buildAddedCabinet(cabinet)).toEqual({ product: request.product, afterPlacement: request.afterPlacement });
    }
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
