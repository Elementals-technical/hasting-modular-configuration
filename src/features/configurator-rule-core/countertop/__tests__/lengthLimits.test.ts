import { describe, expect, it } from "vitest";

import datatable438 from "@/entities/collection/__tests__/fixtures/remote/datatable-438.json";
import datatable577 from "@/entities/collection/__tests__/fixtures/remote/datatable-577.json";
import { countertopDatatableSchema } from "@/entities/collection/model/schemas";

import {
  resolveCountertopMaxLengthByRules,
  resolveMaxAddableCabinetWidthCm,
  resolveMaxResizableCabinetWidthCm,
} from "../lengthLimits";
import { parseCountertopMatrix } from "../parse";

describe("resolveMaxAddableCabinetWidthCm", () => {
  it("subtracts the current composition total when adding a new cabinet", () => {
    expect(
      resolveMaxAddableCabinetWidthCm({
        maxCm: 94.4,
        currentTotalCm: 80.6,
      }),
    ).toBeCloseTo(13.8);
  });

  it("returns zero when the current composition already reaches or exceeds the max", () => {
    expect(
      resolveMaxAddableCabinetWidthCm({
        maxCm: 94.4,
        currentTotalCm: 94.4,
      }),
    ).toBe(0);

    expect(
      resolveMaxAddableCabinetWidthCm({
        maxCm: 94.4,
        currentTotalCm: 100,
      }),
    ).toBe(0);
  });

  it.each([
    { maxCm: null, currentTotalCm: 60 },
    { maxCm: 120, currentTotalCm: null },
    { maxCm: Number.POSITIVE_INFINITY, currentTotalCm: 60 },
    { maxCm: 120, currentTotalCm: Number.NaN },
  ])("returns null when the add limit cannot be evaluated from %j", (input) => {
    expect(resolveMaxAddableCabinetWidthCm(input)).toBeNull();
  });
});

describe("resolveMaxResizableCabinetWidthCm", () => {
  it("allows resizing a single Syntesi-compatible cabinet up to the total max", () => {
    expect(
      resolveMaxResizableCabinetWidthCm({
        maxCm: 120,
        currentTotalCm: 60,
        currentCabinetWidthCm: 60,
      }),
    ).toBe(120);
  });

  it("subtracts only the other cabinets when resizing one cabinet in a composition", () => {
    expect(
      resolveMaxResizableCabinetWidthCm({
        maxCm: 120,
        currentTotalCm: 100,
        currentCabinetWidthCm: 40,
      }),
    ).toBe(60);
  });

  it.each([
    { maxCm: null, currentTotalCm: 60, currentCabinetWidthCm: 60 },
    { maxCm: 120, currentTotalCm: null, currentCabinetWidthCm: 60 },
    { maxCm: 120, currentTotalCm: 60, currentCabinetWidthCm: null },
    { maxCm: Number.POSITIVE_INFINITY, currentTotalCm: 60, currentCabinetWidthCm: 60 },
  ])("returns null when the resize limit cannot be evaluated from %j", (input) => {
    expect(resolveMaxResizableCabinetWidthCm(input)).toBeNull();
  });
});

describe("resolveCountertopMaxLengthByRules", () => {
  const makoRules = parseCountertopMatrix(countertopDatatableSchema.parse(datatable577));
  const ushRules = parseCountertopMatrix(countertopDatatableSchema.parse(datatable438));
  const maxLength = (rules: typeof makoRules, style: string | null, depth: number) =>
    resolveCountertopMaxLengthByRules({ rules, materialTokens: [], style, depth, thickness: null });

  it("holds a composition without a countertop style to the longer of integrated and vessel", () => {
    // Mako: the builder comes before the countertop step and the profile names no default style.
    expect(maxLength(makoRules, null, 52)).toBe(220);
    expect(maxLength(makoRules, "", 52)).toBe(220);

    const ushIntegrated = maxLength(ushRules, "integrated", 50.5);
    const ushVessel = maxLength(ushRules, "vessel", 50.5);
    expect(maxLength(ushRules, null, 50.5)).toBe(Math.max(ushIntegrated ?? 0, ushVessel ?? 0));
  });

  it("keeps the limit of a chosen style and no limit for an unknown one or an empty table", () => {
    expect(maxLength(makoRules, "integrated", 52)).toBe(220);
    expect(maxLength(makoRules, "vessel", 52)).toBe(220);
    expect(maxLength(makoRules, "plain", 52)).toBeNull();
    expect(maxLength([], null, 52)).toBeNull();
  });
});
