import { describe, expect, it } from "vitest";

import udProfileDocument from "../../../../../public/collections/urban-duplex/product-profile.json";
import ulhProfileDocument from "../../../../../public/collections/urban-low-height/product-profile.json";
import datatable589 from "@/entities/collection/__tests__/fixtures/remote/datatable-589.json";
import datatable595 from "@/entities/collection/__tests__/fixtures/remote/datatable-595.json";
import { parseProductProfile } from "@/entities/collection/lib/parseProductProfile";
import { countertopDatatableSchema } from "@/entities/collection/model/schemas";

import { resolveSinkLandingRefusal } from "../basinSelection";
import { parseCountertopMatrix } from "../parse";

/**
 * A basin the top carries comes down only on a cabinet its matrix row allows as a Sink Base: the scene judges the
 * cut-out's fit alone, so a Side Cabinet resized below the basin's `min_sb_cm` would become a Sink Base too narrow for it.
 */

const parseProfile = (document: unknown) => {
  const result = parseProductProfile(document);
  if (!result.ok) throw new Error("the profile must parse");
  return result.profile;
};

const COLLECTIONS = {
  ulh: {
    profile: parseProfile(ulhProfileDocument),
    rules: parseCountertopMatrix(countertopDatatableSchema.parse(datatable589)),
  },
  ud: {
    profile: parseProfile(udProfileDocument),
    rules: parseCountertopMatrix(countertopDatatableSchema.parse(datatable595)),
  },
};

const refusalOf = (collection: keyof typeof COLLECTIONS, activeBasinStyle: string | null, cabinetWidthCm: number) =>
  resolveSinkLandingRefusal({
    ...COLLECTIONS[collection],
    activeMaterialTokens: ["fenix"],
    activeThickness: "5.125",
    activeBasinStyle,
    cabinetWidthCm,
    depth: 50,
  });

describe("resolveSinkLandingRefusal", () => {
  it.each([
    { collection: "ulh", basin: "Top_HPL/Fenix_Prisma_Gres", width: 25, min: 60 },
    { collection: "ulh", basin: "Top_HPL/Fenix_Prisma_Gres", width: 50, min: 60 },
    { collection: "ulh", basin: "Top_HPL/Fenix_Cover_Gres", width: 60, min: 70 },
    { collection: "ud", basin: "Top_HPL/Fenix_Cover_Gres", width: 60, min: 70 },
  ] as const)(
    "refuses $basin on a $width cm $collection cabinet, naming its $min cm minimum",
    ({ collection, basin, width, min }) => {
      expect(refusalOf(collection, basin, width)).toMatchObject({
        reasonCode: "countertop.sinkBaseBelowMin",
        reasonParams: { currentCm: width, minCm: min },
      });
    },
  );

  it("explains the refusal with the widths the user compares", () => {
    expect(refusalOf("ulh", "Top_HPL/Fenix_Prisma_Gres", 50)?.disabledReason).toBe(
      'Not available for current sink base width. Current 50 cm (19.7"), minimum 60 cm (23.6").',
    );
  });

  it.each([
    { collection: "ulh", basin: "Top_HPL/Fenix_Prisma_Gres", width: 60 },
    { collection: "ulh", basin: "Top_HPL/Fenix_Cover_Gres", width: 70 },
    { collection: "ud", basin: "Top_HPL/Fenix_Cover_Gres", width: 70 },
  ] as const)("lets $basin land on a $width cm $collection cabinet", ({ collection, basin, width }) => {
    expect(refusalOf(collection, basin, width)).toBeNull();
  });

  it("judges only the width of the cabinet the basin lands on, not the length of the top", () => {
    expect(refusalOf("ulh", "Top_HPL/Fenix_Prisma_Gres", 120)).toBeNull();
  });

  it.each([
    ["a vessel, which has no matrix row", "Vessel_Blade11"],
    ["a basin the collection does not list", "Top_Unknown"],
    ["no basin", null],
  ])("does not refuse %s", (_name, basin) => {
    expect(refusalOf("ulh", basin, 25)).toBeNull();
  });

  it("does not refuse a basin whose row is out of the current thickness", () => {
    expect(
      resolveSinkLandingRefusal({
        ...COLLECTIONS.ulh,
        activeMaterialTokens: ["fenix"],
        activeThickness: "2.4",
        activeBasinStyle: "Top_HPL/Fenix_Prisma_Gres",
        cabinetWidthCm: 25,
        depth: 50,
      }),
    ).toBeNull();
  });
});
