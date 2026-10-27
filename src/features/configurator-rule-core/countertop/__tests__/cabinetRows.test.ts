import { describe, expect, it } from "vitest";

import type { SceneSupportGroups } from "@/utils/functions/playcanvas/sceneBridge";

import {
  checkPlusRow,
  fitsCabinetRow,
  maxCabinetRowWidth,
  ONE_CABINET_ROW,
  pickRowEnd,
  plusRowOf,
  REASON_ROW_LENGTH_REACHED,
  REASON_SINK_BASE_IN_COUNTERTOP_ROW,
  resolveCabinetRows,
  type CabinetRowLimits,
} from "../cabinetRows";
import { REASON_COMPOSITION_LENGTH_REACHED, resolveMaxAddableCabinetWidthCm } from "../lengthLimits";

/**
 * The client's ULH Multi-Level composition (22.10): the countertop row is 265 cm (two sinks), the lower
 * row 165 cm, the countertop's maximum 270 cm. A cabinet in the lower row does not lengthen the countertop.
 */
const cabinet = (id: string, supportGroupId: string, widthCm: number | null) => ({ id, supportGroupId, widthCm });

const clientRead = (overrides: Partial<SceneSupportGroups> = {}): SceneSupportGroups => ({
  layout: "rows",
  countertopGroupId: "group-1",
  cabinets: [
    cabinet("lower-a", "layout-1", 25),
    cabinet("lower-b", "layout-1", 70),
    cabinet("lower-c", "layout-1", 70),
    cabinet("sink-a", "group-1", 120),
    cabinet("side-a", "group-1", 25),
    cabinet("sink-b", "group-1", 60),
    cabinet("side-b", "group-1", 25),
    cabinet("side-c", "group-1", 35),
  ],
  sidePanelsByGroup: {},
  ...overrides,
});

const SIDE_PANEL_CM = 1;
const clientRows = resolveCabinetRows(clientRead(), SIDE_PANEL_CM);
const clientLimits: CabinetRowLimits = { rows: clientRows, maxCm: 270, countertopRemainingCm: 5 };
const ULH_SIDE_CABINET_WIDTHS = [25, 35, 50, 60, 70, 80, 90, 105, 120];

describe("resolveCabinetRows", () => {
  it("measures every row the countertop does not rest on by its cabinets and its side panels", () => {
    expect(clientRows.otherRows).toEqual([{ groupId: "layout-1", lengthCm: 165 }]);
    expect(clientRows.groupOfCabinet).toMatchObject({ "lower-a": "layout-1", "sink-a": "group-1" });

    const withPanels = resolveCabinetRows(clientRead({ sidePanelsByGroup: { "layout-1": 2, "group-1": 1 } }), 1);
    expect(withPanels.otherRows).toEqual([{ groupId: "layout-1", lengthCm: 167 }]);
  });

  it("judges the composition as one row unless the scene lays out rows it can tell apart", () => {
    expect(resolveCabinetRows(null, SIDE_PANEL_CM)).toBe(ONE_CABINET_ROW);
    expect(resolveCabinetRows(clientRead({ layout: "single" }), SIDE_PANEL_CM)).toBe(ONE_CABINET_ROW);
    // Urban Duplex columns keep the countertop's rule for every "+".
    expect(resolveCabinetRows(clientRead({ layout: "columns" }), SIDE_PANEL_CM)).toBe(ONE_CABINET_ROW);
    expect(resolveCabinetRows(clientRead({ countertopGroupId: "group-9" }), SIDE_PANEL_CM)).toBe(ONE_CABINET_ROW);
    expect(
      resolveCabinetRows(clientRead({ cabinets: [cabinet("sink", "group-1", 120), cabinet("low", "row-2", null)] }), 1),
    ).toBe(ONE_CABINET_ROW);
  });
});

describe("fitsCabinetRow and maxCabinetRowWidth", () => {
  it("lets a cabinet the countertop row has no room for go in the lower row, up to the same maximum", () => {
    const fitting = ULH_SIDE_CABINET_WIDTHS.filter((width) => fitsCabinetRow(clientLimits, "Side-Cabinet", width));

    expect(fitting).toEqual([25, 35, 50, 60, 70, 80, 90, 105]);
    expect(fitsCabinetRow(clientLimits, "Open-Shelf", 70)).toBe(true);
    expect(fitsCabinetRow(clientLimits, null, 105)).toBe(true);
    expect(maxCabinetRowWidth(clientLimits, "Side-Cabinet")).toBe(105);
  });

  it("keeps a Sink Base in the countertop row", () => {
    expect(fitsCabinetRow(clientLimits, "Sink-Base", 60)).toBe(false);
    expect(maxCabinetRowWidth(clientLimits, "Sink-Base")).toBe(5);
  });

  it("refuses every type once both rows are full", () => {
    const full = resolveCabinetRows(
      clientRead({ cabinets: [...clientRead().cabinets, cabinet("lower-d", "layout-1", 90)] }),
      SIDE_PANEL_CM,
    );
    const limits = { ...clientLimits, rows: full };

    // The lower row is 255 cm now: 15 cm left, less than the narrowest cabinet.
    expect(ULH_SIDE_CABINET_WIDTHS.some((width) => fitsCabinetRow(limits, "Side-Cabinet", width))).toBe(false);
    expect(maxCabinetRowWidth(limits, "Side-Cabinet")).toBe(15);
  });

  it("answers as the countertop guard did for one row", () => {
    for (const [maxCm, currentCm] of [
      [270, 265],
      [270, 150],
      [270, 280],
    ]) {
      const limits: CabinetRowLimits = { rows: ONE_CABINET_ROW, maxCm, countertopRemainingCm: maxCm - currentCm };
      for (const width of ULH_SIDE_CABINET_WIDTHS) {
        expect(fitsCabinetRow(limits, "Side-Cabinet", width)).toBe(currentCm + width <= maxCm + 0.01);
      }
      expect(maxCabinetRowWidth(limits, "Side-Cabinet")).toBe(
        resolveMaxAddableCabinetWidthCm({ maxCm, currentTotalCm: currentCm }),
      );
    }
  });

  it("is permissive while the countertop cannot be judged", () => {
    const unknown: CabinetRowLimits = { rows: clientRows, maxCm: null, countertopRemainingCm: null };

    expect(fitsCabinetRow(unknown, "Sink-Base", 120)).toBe(true);
    expect(maxCabinetRowWidth(unknown, "Side-Cabinet")).toBeNull();
  });
});

describe("plusRowOf", () => {
  it("tells where the cabinet a '+' adds ends up", () => {
    expect(plusRowOf(clientRows, { cabinetId: "sink-a", kind: "left" })).toEqual({ kind: "countertop" });
    expect(plusRowOf(clientRows, { cabinetId: "lower-c", kind: "right" })).toEqual({
      kind: "other",
      row: { groupId: "layout-1", lengthCm: 165 },
    });
    expect(plusRowOf(clientRows, { cabinetId: "unknown", kind: "right" })).toEqual({ kind: "countertop" });
    expect(plusRowOf(ONE_CABINET_ROW, { cabinetId: "lower-c", kind: "right" })).toEqual({ kind: "countertop" });
  });

  it("puts a column's bottom place under the countertop and its top places in the countertop row", () => {
    expect(plusRowOf(clientRows, { cabinetId: "lower-c", kind: "bottom" })).toEqual({ kind: "under" });
    for (const kind of ["top", "left-top", "right-top"] as const) {
      expect(plusRowOf(clientRows, { cabinetId: "lower-c", kind })).toEqual({ kind: "countertop" });
    }
  });
});

describe("checkPlusRow", () => {
  it("refuses the countertop row's '+' with the composition length reason", () => {
    expect(checkPlusRow(clientLimits, { cabinetId: "side-c", kind: "right" }, "Side-Cabinet", [25, 70])).toEqual({
      status: "refused",
      reason: { code: REASON_COMPOSITION_LENGTH_REACHED, params: { maxCm: 270, maxIn: "106.3" } },
    });
  });

  it("takes the lower row's '+' up to the room that row has left", () => {
    expect(
      checkPlusRow(clientLimits, { cabinetId: "lower-a", kind: "left" }, "Side-Cabinet", ULH_SIDE_CABINET_WIDTHS),
    ).toEqual({ status: "ok", limitCm: 105, widths: [25, 35, 50, 60, 70, 80, 90, 105] });
  });

  it("refuses the lower row's '+' with the row's own reason once that row is full", () => {
    const full = resolveCabinetRows(
      clientRead({ cabinets: [...clientRead().cabinets, cabinet("lower-d", "layout-1", 90)] }),
      SIDE_PANEL_CM,
    );

    expect(
      checkPlusRow({ ...clientLimits, rows: full }, { cabinetId: "lower-d", kind: "right" }, "Side-Cabinet", [25, 35]),
    ).toEqual({
      status: "refused",
      reason: { code: REASON_ROW_LENGTH_REACHED, params: { maxCm: 270, maxIn: "106.3" } },
    });
  });

  it("refuses a Sink Base anywhere but the countertop row, even where it would fit", () => {
    const roomy: CabinetRowLimits = { ...clientLimits, countertopRemainingCm: 150 };
    const sinkBaseReason = { status: "refused", reason: { code: REASON_SINK_BASE_IN_COUNTERTOP_ROW } };

    expect(checkPlusRow(roomy, { cabinetId: "lower-a", kind: "left" }, "Sink-Base", [60])).toEqual(sinkBaseReason);
    expect(checkPlusRow(roomy, { cabinetId: "lower-a", kind: "bottom" }, "Sink-Base", null)).toEqual(sinkBaseReason);
    expect(checkPlusRow(roomy, { cabinetId: "sink-a", kind: "right" }, "Sink-Base", [60])).toEqual({
      status: "ok",
      limitCm: 150,
      widths: [60],
    });
  });

  it("puts no length limit on a column's bottom place, and judges only the row while the width is unknown", () => {
    expect(checkPlusRow(clientLimits, { cabinetId: "lower-a", kind: "bottom" }, "Side-Cabinet", [120])).toEqual({
      status: "ok",
      limitCm: null,
      widths: [120],
    });
    expect(checkPlusRow(clientLimits, { cabinetId: "side-c", kind: "right" }, "Side-Cabinet", null)).toEqual({
      status: "ok",
      limitCm: 5,
      widths: null,
    });
  });
});

describe("pickRowEnd", () => {
  // The row ends the scene offers for the client's composition: the lower row reaches further right.
  const countertopLeft = { cabinetId: "sink-a", kind: "left", x: -1.3 } as const;
  const countertopRight = { cabinetId: "side-c", kind: "right", x: 1.35 } as const;
  const lowerLeft = { cabinetId: "lower-a", kind: "left", x: -0.8 } as const;
  const lowerRight = { cabinetId: "lower-c", kind: "right", x: 1.9 } as const;
  const allEnds = [lowerLeft, lowerRight, countertopLeft, countertopRight];
  const roomy: CabinetRowLimits = { ...clientLimits, countertopRemainingCm: 150 };

  it("starts a Sink Base at the right end of the countertop row, not at the lower row's further right end", () => {
    expect(pickRowEnd(roomy, allEnds, "Sink-Base", [60])).toBe(countertopRight);
    // Its width not fitting does not send it to another row: a Sink Base goes in none.
    expect(pickRowEnd(clientLimits, allEnds, "Sink-Base", [60])).toBe(countertopRight);
  });

  it("starts another cabinet in the countertop row while its width fits there, else in a row with room", () => {
    expect(pickRowEnd(roomy, allEnds, "Side-Cabinet", [70])).toBe(countertopRight);
    expect(pickRowEnd(clientLimits, allEnds, "Side-Cabinet", [70])).toBe(lowerRight);
    expect(pickRowEnd(clientLimits, allEnds, "Side-Cabinet", null)).toBe(countertopRight);
  });

  it("takes a left end only when no right end is offered", () => {
    expect(pickRowEnd(roomy, [lowerLeft, countertopLeft], "Sink-Base", [60])).toBe(countertopLeft);
    expect(pickRowEnd(roomy, [lowerLeft, countertopLeft], "Side-Cabinet", [70])).toBe(countertopLeft);
  });

  it("finds no start for a Sink Base offered only lower-row ends, nor in a composition judged as one row", () => {
    expect(pickRowEnd(roomy, [lowerLeft, lowerRight], "Sink-Base", [60])).toBeNull();
    expect(
      pickRowEnd(roomy, [{ cabinetId: "lower-a", kind: "bottom", x: 0 } as const], "Side-Cabinet", null),
    ).toBeNull();
    expect(
      pickRowEnd({ rows: ONE_CABINET_ROW, maxCm: 270, countertopRemainingCm: 150 }, allEnds, "Sink-Base", [60]),
    ).toBeNull();
  });
});
