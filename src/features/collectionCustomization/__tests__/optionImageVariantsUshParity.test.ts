import { describe, expect, it } from "vitest";

import ushProfileDocument from "../../../../public/collections/urban-standard-height/product-profile.json";
import ushUi from "../../../../public/collections/urban-standard-height/ui.json";
import cabinetTable439 from "@/entities/collection/__tests__/fixtures/remote/datatable-439.json";

import {
  parseProductProfile,
  resolveCustomizationImageUrls,
  validateCustomizationSchema,
  type CustomizationSchema,
} from "@/entities/collection";
import type { ProductDatatable } from "@/entities/product/api";
import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";

import { resolveOptionImage } from "../lib/optionImageVariants";

/**
 * Every picture the USH cards can show, over each cabinet type, each drawers value the catalog
 * offers (and none placed) and each catalog height. The table was taken from the code that used
 * to choose these pictures and checked against it combination by combination before that code
 * was removed, so it is what the cards looked like before the collection owned them.
 *
 * Heights outside the catalog are left out on purpose: the state cannot hold one.
 * `applyConfiguratorRules` writes `selectedDimensions` from the catalog, and
 * `setActiveCabinetType` substitutes a catalog height whenever the current one is invalid.
 */

const EXPECTED_TYPE_CARD: Record<string, string> = {
  "Sink-Base|1|50": "sink-base/SinkBase1D_PTO.png",
  "Sink-Base|2|50": "sink-base/SinkBase2D_PTO.png",
  "Sink-Base|1+inner|50": "sink-base/SinkBase1D_PTO.png",
  "Sink-Base||50": "sink-base/SinkBase2D_upperG.png",
  "Sink-Base|1|53": "sink-base/SinkBase1D_upperG.png",
  "Sink-Base|2|53": "sink-base/SinkBase2D_centralG.png",
  "Sink-Base|1+inner|53": "sink-base/SinkBase1D_upperG.png",
  "Sink-Base||53": "sink-base/SinkBase2D_upperG.png",
  "Sink-Base|1|56": "sink-base/SinkBase1D_upperG.png",
  "Sink-Base|2|56": "sink-base/SinkBase2D_upperG.png",
  "Sink-Base|1+inner|56": "sink-base/SinkBase1D_upperG.png",
  "Sink-Base||56": "sink-base/SinkBase2D_upperG.png",
  "Sink-Cabinet|1|50": "side-cabinet/SinkBase1D_PTO.png",
  "Sink-Cabinet|2|50": "side-cabinet/SinkBase2D_PTO.png",
  "Sink-Cabinet|1+inner|50": "side-cabinet/SinkBase1D_PTO.png",
  "Sink-Cabinet||50": "side-cabinet/SideCabinet2D_upperG.png",
  "Sink-Cabinet|1|53": "side-cabinet/SinkBase1D_upperG.png",
  "Sink-Cabinet|2|53": "side-cabinet/SinkBase2D_centralG.png",
  "Sink-Cabinet|1+inner|53": "side-cabinet/SinkBase1D_upperG.png",
  "Sink-Cabinet||53": "side-cabinet/SideCabinet2D_upperG.png",
  "Sink-Cabinet|1|56": "side-cabinet/SinkBase1D_upperG.png",
  "Sink-Cabinet|2|56": "side-cabinet/SideCabinet2D_upperG.png",
  "Sink-Cabinet|1+inner|56": "side-cabinet/SinkBase1D_upperG.png",
  "Sink-Cabinet||56": "side-cabinet/SideCabinet2D_upperG.png",
  "Side-Shelf|1|50": "SideShelves_Trans.png",
  "Side-Shelf|2|50": "SideShelves_Trans.png",
  "Side-Shelf|1+inner|50": "SideShelves_Trans.png",
  "Side-Shelf||50": "SideShelves_Trans.png",
  "Side-Shelf|1|53": "SideShelves_Trans.png",
  "Side-Shelf|2|53": "SideShelves_Trans.png",
  "Side-Shelf|1+inner|53": "SideShelves_Trans.png",
  "Side-Shelf||53": "SideShelves_Trans.png",
  "Side-Shelf|1|56": "SideShelves_Trans.png",
  "Side-Shelf|2|56": "SideShelves_Trans.png",
  "Side-Shelf|1+inner|56": "SideShelves_Trans.png",
  "Side-Shelf||56": "SideShelves_Trans.png",
  "Open-Shelf|1|50": "OpenShelves.png",
  "Open-Shelf|2|50": "OpenShelves.png",
  "Open-Shelf|1+inner|50": "OpenShelves.png",
  "Open-Shelf||50": "OpenShelves.png",
  "Open-Shelf|1|53": "OpenShelves.png",
  "Open-Shelf|2|53": "OpenShelves.png",
  "Open-Shelf|1+inner|53": "OpenShelves.png",
  "Open-Shelf||53": "OpenShelves.png",
  "Open-Shelf|1|56": "OpenShelves.png",
  "Open-Shelf|2|56": "OpenShelves.png",
  "Open-Shelf|1+inner|56": "OpenShelves.png",
  "Open-Shelf||56": "OpenShelves.png",
};

const EXPECTED_STYLE_CARD: Record<string, string> = {
  "Sink-Base|1|50": "sink-base/SinkBase1D_PTO.png",
  "Sink-Base|2|50": "sink-base/SinkBase2D_PTO.png",
  "Sink-Base|1+inner|50": "sink-base/SinkBase1D_PTO.png",
  "Sink-Base|1|53": "sink-base/SinkBase1D_upperG.png",
  "Sink-Base|2|53": "sink-base/SinkBase2D_centralG.png",
  "Sink-Base|1+inner|53": "sink-base/SinkBase1D_upperG.png",
  "Sink-Base|1|56": "sink-base/SinkBase1D_upperG.png",
  "Sink-Base|2|56": "sink-base/SinkBase2D_upperG.png",
  "Sink-Base|1+inner|56": "sink-base/SinkBase1D_upperG.png",
  "Sink-Cabinet|1|50": "side-cabinet/SinkBase1D_PTO.png",
  "Sink-Cabinet|2|50": "side-cabinet/SinkBase2D_PTO.png",
  "Sink-Cabinet|1+inner|50": "side-cabinet/SinkBase1D_PTO.png",
  "Sink-Cabinet|1|53": "side-cabinet/SinkBase1D_upperG.png",
  "Sink-Cabinet|2|53": "side-cabinet/SinkBase2D_centralG.png",
  "Sink-Cabinet|1+inner|53": "side-cabinet/SinkBase1D_upperG.png",
  "Sink-Cabinet|1|56": "side-cabinet/SinkBase1D_upperG.png",
  "Sink-Cabinet|2|56": "side-cabinet/SideCabinet2D_upperG.png",
  "Sink-Cabinet|1+inner|56": "side-cabinet/SinkBase1D_upperG.png",
};

const profile = (() => {
  const result = parseProductProfile(ushProfileDocument);
  if (!result.ok) throw new Error("USH profile must parse");

  return result.profile;
})();

const schema: CustomizationSchema = (() => {
  const result = validateCustomizationSchema(ushUi);
  if (!result.ok) throw new Error("USH ui.json must validate");

  return resolveCustomizationImageUrls(
    result.schema,
    "https://app.test/collections/urban-standard-height/manifest.json",
    "https://app.test/collections/",
  );
})();

const catalog = buildCabinetCatalogFromMatrix(cabinetTable439 as ProductDatatable, profile);
const cabinetTypes = catalog.typeCabinetRules.map((rule) => rule.code);
const heights = [...new Set(catalog.typeCabinetRules.flatMap((rule) => rule.heights))].sort((a, b) => a - b);
const drawerValues = [...new Set(catalog.typeCabinetRules.flatMap((rule) => rule.drawers))];

/** The tail of a collection URL, so the table below reads as "<folder>/<file>". */
const collectionTail = (url: string | undefined): string | undefined => {
  if (!url) return undefined;

  const marker = "/images/cabinet/";
  const index = url.indexOf(marker);

  return index < 0 ? url : url.slice(index + marker.length);
};

const resolved = (attributeId: string, value: string, context: Record<string, string>) =>
  collectionTail(
    resolveOptionImage({
      optionImages: schema.optionImages,
      variants: schema.optionImageVariants,
      attributeId,
      value,
      context,
    }),
  );

describe("USH cabinet pictures come out of the collection exactly as the code chose them", () => {
  it("covers every type, drawers value and catalog height", () => {
    expect(cabinetTypes.length).toBeGreaterThan(0);
    expect(heights).toEqual([50, 53, 56]);
    expect([...drawerValues].sort()).toEqual(["1", "1+inner", "2"]);
    expect(Object.keys(EXPECTED_TYPE_CARD)).toHaveLength(
      cabinetTypes.length * heights.length * (drawerValues.length + 1),
    );
  });

  it("draws every type card as the collection declares", () => {
    const actual = Object.fromEntries(
      Object.keys(EXPECTED_TYPE_CARD).map((key) => {
        const [code, drawers, height] = key.split("|");
        return [key, resolved("CabinetType", code ?? "", { Drawers: drawers ?? "", Height: height ?? "" })];
      }),
    );

    expect(actual).toEqual(EXPECTED_TYPE_CARD);
  });

  it("draws every style card as the collection declares", () => {
    const actual = Object.fromEntries(
      Object.keys(EXPECTED_STYLE_CARD).map((key) => {
        const [code, drawers, height] = key.split("|");
        return [key, resolved("Drawers", drawers ?? "", { CabinetType: code ?? "", Height: height ?? "" })];
      }),
    );

    expect(actual).toEqual(EXPECTED_STYLE_CARD);
  });
});
