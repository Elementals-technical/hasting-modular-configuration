import { describe, expect, it } from "vitest";

import urbanDuplexProfileDocument from "../../../../public/collections/urban-duplex/product-profile.json";
import urbanDuplexUi from "../../../../public/collections/urban-duplex/ui.json";
import { parseProductProfile } from "@/entities/collection";
import { readCustomizationSchema } from "@/entities/collection/__tests__/fixtures/readCustomizationSchema";
import type { PerCabinetAttribute } from "@/entities/collection";
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

const fieldsFor = (
  cabinetId: string | null,
  recorded: ScopedValue[] = [],
  attributes: PerCabinetAttribute[] = ["LateralPanelSide"],
) =>
  buildPerCabinetAttributeFields({
    profile,
    schema,
    recorded: { LateralPanelSide: recorded },
    firstCabinetId: "cab-1",
    attributes,
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

/**
 * A cabinet Urban Standard Height or Urban Low Height supplies has no lateral panel, so the
 * collection offers the side to its own cabinets only (`when` of the ui.json entry).
 */
describe("a value offered to the cabinets that hold given values", () => {
  const ownCabinetsOnly = schema.styleSidebar?.attributes ?? [];
  const seriesAt = (cabinetId: string, value: string): ScopedValue => ({
    target: { scope: "cabinet", cabinetId },
    value,
  });
  const offered = (cabinetId: string | null, series: ScopedValue[], pending?: Record<string, unknown>) =>
    buildPerCabinetAttributeFields({
      profile,
      schema,
      recorded: { Series: series },
      firstCabinetId: "cab-1",
      attributes: ownCabinetsOnly,
      cabinetId,
      pending,
    }).map(({ attributeId }) => attributeId);

  it("is how the collection lists the side of the lateral panel", () => {
    expect(ownCabinetsOnly).toEqual([{ attributeId: "LateralPanelSide", when: { Series: "URDPX" } }]);
    expect(schema.playerMenu?.attributes).toEqual(ownCabinetsOnly);
  });

  it("offers the side to a placed cabinet of the collection, and not to one of another series", () => {
    const series = [seriesAt("cab-1", "URSTD"), seriesAt("cab-2", "URDPX"), seriesAt("cab-3", "URLH")];

    expect(offered("cab-2", series)).toEqual(["LateralPanelSide"]);
    expect(offered("cab-1", series)).toEqual([]);
    expect(offered("cab-3", series)).toEqual([]);
  });

  it("reads a cabinet that holds no series as the collection's own, whatever the first cabinet is", () => {
    expect(offered("cab-2", [seriesAt("cab-1", "URSTD")])).toEqual(["LateralPanelSide"]);
    expect(offered("cab-1", [])).toEqual(["LateralPanelSide"]);
  });

  it("reads the cabinet being added from its config", () => {
    const series = [seriesAt("cab-1", "URSTD")];

    expect(offered(null, series, { Series: "URLH" })).toEqual([]);
    expect(offered(null, series, { Series: "URDPX" })).toEqual(["LateralPanelSide"]);
    // No series chosen yet: the collection's own cabinet.
    expect(offered(null, series, { Drawers: "2D" })).toEqual(["LateralPanelSide"]);
    expect(offered(null, series)).toEqual(["LateralPanelSide"]);
  });
});
