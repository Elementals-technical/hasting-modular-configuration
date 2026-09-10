import { describe, expect, it } from "vitest";

import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import type { ProductProfile } from "@/entities/collection";

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
