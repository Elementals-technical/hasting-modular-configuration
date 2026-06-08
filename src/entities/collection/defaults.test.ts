import { describe, expect, it } from "vitest";

import { productReducer } from "@/entities/product/model/store/slice";

import {
  CONFIGURATOR_ID,
  DEFAULT_CABINET_COLOR,
  DEFAULT_COUNTERTOP_COLOR,
  DEFAULT_SINK_TYPE,
  MATRIX_CABINET_DATATABLE_ID,
} from "./defaults";

describe("collection defaults", () => {
  it("pins the exact default values", () => {
    expect(CONFIGURATOR_ID).toBe(4);
    expect(MATRIX_CABINET_DATATABLE_ID).toBe(439);
    expect(DEFAULT_CABINET_COLOR).toBe("Pulpis Chiaro TKH");
    expect(DEFAULT_COUNTERTOP_COLOR).toBe("Cacao Orinoco FF MT");
    expect(DEFAULT_SINK_TYPE).toBe("Top_Tekorlux_Rectangular");
  });

  it("stays in sync with the product slice initial defaults (coupling guard)", () => {
    const initial = productReducer(undefined, { type: "@@redux/INIT" });
    expect(initial.productOptions.CabinetColor).toBe(DEFAULT_CABINET_COLOR);
    expect(initial.productOptions.CountertopColor).toBe(DEFAULT_COUNTERTOP_COLOR);
    expect(initial.productOptions.sinkType).toBe(DEFAULT_SINK_TYPE);
  });
});
