import { describe, expect, it } from "vitest";

import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import datatable438 from "@/entities/collection/__tests__/fixtures/remote/datatable-438.json";
import type { ProductProfile } from "@/entities/collection";
import { parseThicknessValue } from "@/features/configurator-rule-core/countertop/parse";

import { REASON_VALUE_NOT_IN_CATALOG, validateChange } from "../lib/validateChange";
import type { AttributeChange } from "../model/types";

const profile = ushProfile;

const change = (overrides: Partial<AttributeChange> = {}): AttributeChange =>
  ({
    attributeId: "Handle",
    value: "handle_urban_topcut",
    scope: "cabinet",
    cabinetId: "cab-1",
    ...overrides,
  }) as AttributeChange;

describe("validateChange", () => {
  it("accepts a known attribute with a catalog value at the declared scope", () => {
    expect(validateChange(change(), profile)).toEqual({ ok: true });
  });

  it("errors when no collection is active", () => {
    const verdict = validateChange(change(), null);

    expect(verdict).toMatchObject({ ok: false, kind: "error", code: "no-active-profile" });
  });

  it("errors on an attribute the collection does not declare", () => {
    const verdict = validateChange(change({ attributeId: "NotAnAttribute" }), profile);

    expect(verdict).toMatchObject({ ok: false, kind: "error", code: "unknown-attribute" });
  });

  it("errors when the scope does not match the profile", () => {
    // Handle is cabinet-scoped; addressing it globally is a contract mistake, not a rule block.
    const verdict = validateChange(change({ scope: "global" } as Partial<AttributeChange>), profile);

    expect(verdict).toMatchObject({ ok: false, kind: "error", code: "scope-mismatch" });
  });

  it("blocks a value that is not in the catalog", () => {
    const verdict = validateChange(change({ value: "handle_invented" }), profile);

    expect(verdict).toMatchObject({
      ok: false,
      kind: "blocked",
      attributeId: "Handle",
      reasonCode: REASON_VALUE_NOT_IN_CATALOG,
    });
  });

  it("accepts any value for an attribute whose options come from an external source", () => {
    // HandleGrooveColor declares optionsSource, not a closed catalog: A validates those.
    const verdict = validateChange(
      change({ attributeId: "HandleGrooveColor", value: "Pulpis Chiaro TKH" }),
      profile,
    );

    expect(verdict).toEqual({ ok: true });
  });

  it("accepts a value through an alias the catalog declares", () => {
    const thickness = (value: string) =>
      validateChange({ attributeId: "Thickness", value, scope: "countertop" }, profile);

    expect(thickness("0.375")).toEqual({ ok: true });
    expect(thickness("2.375")).toEqual({ ok: true });
    // The table spelling never reaches state: pages store the parsed decimal.
    expect(thickness("3/8")).toMatchObject({ ok: false, kind: "blocked", reasonCode: REASON_VALUE_NOT_IN_CATALOG });
  });

  it("accepts every thickness the countertop table produces in state", () => {
    const rawValues = Array.from(JSON.stringify(datatable438).matchAll(/"top_thicknesses":"([^"]*)"/g), (match) =>
      match[1].split("|"),
    ).flat();
    // Pages and rules store String(parseThicknessValue(raw)), e.g. "2-3/8" -> "2.4".
    const stateValues = Array.from(new Set(rawValues.map((raw) => String(parseThicknessValue(raw)))));

    expect(stateValues.length).toBeGreaterThan(0);
    for (const value of stateValues) {
      expect(validateChange({ attributeId: "Thickness", value, scope: "countertop" }, profile), value).toEqual({
        ok: true,
      });
    }
  });

  it("keeps an empty string a catalog member", () => {
    expect(validateChange({ attributeId: "BookMatching", value: "", scope: "global" }, profile)).toEqual({ ok: true });
  });

  it("accepts a synthetic handle that exists only in a fixture profile", () => {
    const extended: ProductProfile = {
      ...profile,
      attributes: profile.attributes.map((attribute) =>
        attribute.attributeId === "Handle"
          ? {
              ...attribute,
              options: [
                ...(attribute.options ?? []),
                { value: "test_groove_handle", label: "Test Groove", order: 40 },
              ],
            }
          : attribute,
      ),
    };

    expect(validateChange(change({ value: "test_groove_handle" }), extended)).toEqual({ ok: true });
    // The same value is not a member of the unmodified USH catalog.
    expect(validateChange(change({ value: "test_groove_handle" }), profile)).toMatchObject({
      ok: false,
      kind: "blocked",
    });
  });
});
