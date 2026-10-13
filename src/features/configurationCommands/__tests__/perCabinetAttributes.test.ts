import { describe, expect, it } from "vitest";

import urbanDuplexProfileDocument from "../../../../public/collections/urban-duplex/product-profile.json";
import urbanDuplexUi from "../../../../public/collections/urban-duplex/ui.json";
import { parseProductProfile } from "@/entities/collection";
import { readCustomizationSchema } from "@/entities/collection/__tests__/fixtures/readCustomizationSchema";
import type { ScopedValue } from "@/entities/configuration";

import { buildPerCabinetAttributeFields } from "../lib/perCabinetAttributes";

/**
 * The side of the lateral panel of an Urban Duplex cabinet, as the style sidebar and the menu of
 * a placed cabinet show it: the cabinet's own side, else the composition's, else the starting one.
 */

const parsed = parseProductProfile(urbanDuplexProfileDocument);
if (!parsed.ok) throw new Error("Urban Duplex profile must parse");
const profile = parsed.profile;
const schema = readCustomizationSchema(urbanDuplexUi);

const sideAt = (cabinetId: string, value: string): ScopedValue => ({ target: { scope: "cabinet", cabinetId }, value });

const fieldsFor = (cabinetId: string | null, recorded: ScopedValue[] = [], attributeIds = ["LateralPanelSide"]) =>
  buildPerCabinetAttributeFields({
    profile,
    schema,
    recorded: { LateralPanelSide: recorded },
    firstCabinetId: "cab-1",
    attributeIds,
    cabinetId,
  });

describe("the values a collection offers for one cabinet alone", () => {
  it("names the field as the collection's ui.json names it and lists the options of the profile", () => {
    expect(fieldsFor(null)).toEqual([
      {
        attributeId: "LateralPanelSide",
        label: "Lateral Panel",
        options: [
          { value: "L", label: "Left" },
          { value: "R", label: "Right" },
        ],
        value: "R",
      },
    ]);
  });

  it("shows the side the cabinet holds itself", () => {
    const recorded = [sideAt("cab-1", "R"), sideAt("cab-2", "L")];

    expect(fieldsFor("cab-2", recorded)[0].value).toBe("L");
    expect(fieldsFor("cab-1", recorded)[0].value).toBe("R");
  });

  it("shows the side of the composition for a cabinet that holds none, placed or still to add", () => {
    const recorded = [sideAt("cab-1", "L")];

    expect(fieldsFor("cab-2", recorded)[0].value).toBe("L");
    expect(fieldsFor(null, recorded)[0].value).toBe("L");
  });

  it("starts from the collection's side while nothing is recorded", () => {
    expect(fieldsFor("cab-1")[0].value).toBe("R");
  });

  it("leaves out a value the profile has no options for", () => {
    expect(fieldsFor(null, [], ["Missing"])).toEqual([]);
  });
});
