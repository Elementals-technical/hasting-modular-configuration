import { describe, expect, it } from "vitest";

import { configurator4WithLiveVessels } from "@/entities/collection/__tests__/fixtures/configurator4LiveVessels";
import configurator8 from "@/entities/collection/__tests__/fixtures/remote/configurator-8.json";
import configurator9 from "@/entities/collection/__tests__/fixtures/remote/configurator-9.json";
import configurator10 from "@/entities/collection/__tests__/fixtures/remote/configurator-10.json";
import configurator11 from "@/entities/collection/__tests__/fixtures/remote/configurator-11.json";
import configurator12 from "@/entities/collection/__tests__/fixtures/remote/configurator-12.json";
import configurator13 from "@/entities/collection/__tests__/fixtures/remote/configurator-13.json";
import configurator14 from "@/entities/collection/__tests__/fixtures/remote/configurator-14.json";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import {
  configuratorSchema,
  parseProductProfile,
  selectOptions,
  type ConfiguratorGroupCatalog,
  type ProductProfile,
} from "@/entities/collection";
import { isVisibleVesselSinkStyle } from "@/features/configurator-rule-core/countertop/vesselCompatibility";

import classProfileDocument from "../../../../public/collections/class/product-profile.json";
import lameProfileDocument from "../../../../public/collections/lame/product-profile.json";
import makoProfileDocument from "../../../../public/collections/mako/product-profile.json";
import tricotProfileDocument from "../../../../public/collections/tricot/product-profile.json";
import urbanDuplexProfileDocument from "../../../../public/collections/urban-duplex/product-profile.json";
import urbanFreestandingProfileDocument from "../../../../public/collections/urban-freestanding/product-profile.json";
import urbanLowHeightProfileDocument from "../../../../public/collections/urban-low-height/product-profile.json";
import { resolveVesselColorForBasin, resolveVesselColorOptions } from "../lib/resolveVesselColor";

const parseProfile = (document: unknown): ProductProfile => {
  const result = parseProductProfile(document);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.profile;
};

/** A configurator as the loader indexes it. */
const catalogOf = (document: unknown): ConfiguratorGroupCatalog => {
  const { availableOptions } = configuratorSchema.parse(document);
  return {
    groups: availableOptions,
    groupsByName: Object.fromEntries(availableOptions.map((group) => [group.proxyName, group])),
  };
};

const colour = (id: number, name: string, sku: string, codeColor: string, Material?: string) => ({
  id,
  name,
  image: null,
  enabled: true,
  sort: 0,
  description: "",
  metadata: { sku, codeColor, ...(Material ? { Material } : {}) },
});

/** A group of configurator 4 with one more option, of colours its recording leaves out. */
const withOption = (proxyName: string, name: string, variants: ReturnType<typeof colour>[]) => ({
  ...configurator4WithLiveVessels,
  availableOptions: configurator4WithLiveVessels.availableOptions.map((group) =>
    group.proxyName === proxyName
      ? {
          ...group,
          options: [
            ...group.options,
            { id: 90_000, name, resource: null, paramString: "", playcanvasString: "", variants },
          ],
        }
      : group,
  ),
});

/**
 * Configurator 4 as it answers (read 2026-11-03): its Ceramic, Solid Surface and Tekorlux vessels, and the
 * Porcelain the Urban Modo takes from Countertop Color, which the recording leaves out.
 */
const USH_CONFIGURATOR = catalogOf(
  withOption("Countertop Color", "Porcelain", [
    colour(90_001, "Avenue Ivory TR9", "POR", "TR9", "Porcelain"),
    colour(90_002, "Fokos Rena TQ2", "POR", "TQ2", "Porcelain"),
  ]),
);

const URBAN_PICKS = {
  Vessel_Blade11: "Antracite Matte OCF",
  Vessel_Blade18: "Antracite Matte OCF",
  Vessel_UrbanModo: "Matte White T1C",
  Vessel_UrbanMorris: "Bianco Gloss TAL",
  Vessel_Aquarius: "Agata BD MT",
};

const LACQUER_PICKS = {
  Iris: "Salvia 415 MT",
  Frame: "Fumo 401 MT",
  Plaza: "Antracite 400 MT",
};

const COLLECTIONS: {
  collection: string;
  profile: ProductProfile;
  configurator: ConfiguratorGroupCatalog;
  picks: Record<string, string>;
}[] = [
  {
    collection: "urban-standard-height",
    profile: ushProfile,
    configurator: USH_CONFIGURATOR,
    picks: URBAN_PICKS,
  },
  {
    collection: "urban-low-height",
    profile: parseProfile(urbanLowHeightProfileDocument),
    configurator: catalogOf(configurator10),
    picks: URBAN_PICKS,
  },
  {
    collection: "urban-freestanding",
    profile: parseProfile(urbanFreestandingProfileDocument),
    configurator: catalogOf(configurator11),
    picks: {
      Vessel_Blade11: "Antracite Matte OCF",
      Vessel_Blade18: "Antracite Matte OCF",
      Vessel_UrbanModo: "Matte White T1C",
      Vessel_UrbanMorris: "Bianco Gloss TAL",
    },
  },
  {
    collection: "urban-duplex",
    profile: parseProfile(urbanDuplexProfileDocument),
    configurator: catalogOf(configurator13),
    picks: { ...URBAN_PICKS, Vessel_Aquarius: "Bianco Gloss TAL" },
  },
  {
    collection: "class",
    profile: parseProfile(classProfileDocument),
    configurator: catalogOf(configurator8),
    picks: LACQUER_PICKS,
  },
  {
    collection: "mako",
    profile: parseProfile(makoProfileDocument),
    configurator: catalogOf(configurator9),
    picks: LACQUER_PICKS,
  },
  {
    collection: "lame",
    profile: parseProfile(lameProfileDocument),
    configurator: catalogOf(configurator14),
    picks: LACQUER_PICKS,
  },
  {
    collection: "tricot",
    profile: parseProfile(tricotProfileDocument),
    configurator: catalogOf(configurator12),
    picks: LACQUER_PICKS,
  },
];

const PICKS = COLLECTIONS.flatMap(({ picks, ...collection }) =>
  Object.entries(picks).map(([vessel, color]) => ({ ...collection, vessel, color })),
);

const CLASS = COLLECTIONS.find(({ collection }) => collection === "class");
if (!CLASS) throw new Error("the table lists Class");

describe("the colour a vessel takes with no colour chosen", () => {
  it.each(PICKS)("$collection: $vessel takes $color", ({ profile, configurator, vessel, color }) => {
    expect(resolveVesselColorForBasin({ profile, configurator, vesselStyle: vessel, current: "" })).toBe(color);
  });

  it.each(COLLECTIONS)("$collection: the table names every vessel it offers", ({ profile, picks }) => {
    const offered = selectOptions(profile, "sinkType")
      .map(({ value }) => value)
      .filter((value) => isVisibleVesselSinkStyle(value, profile));

    expect([...offered].sort()).toEqual(Object.keys(picks).sort());
  });
});

describe("resolveVesselColorOptions", () => {
  const options = (vesselStyle: string) => {
    const { allowed, preferredValue } = resolveVesselColorOptions(ushProfile, USH_CONFIGURATOR, vesselStyle);
    return { allowed: allowed.map(({ value }) => value), preferredValue };
  };

  it("lists the colours the vessel allows, with its default finish", () => {
    expect(options("Vessel_UrbanModo")).toEqual({
      allowed: ["Matte Black T1D", "Matte White T1C"],
      preferredValue: "Matte White T1C",
    });
  });

  it("names no default finish where the vessel declares none", () => {
    expect(options("Vessel_UrbanMorris")).toEqual({
      allowed: ["Bianco Gloss TAL", "Bianco Matte TAM"],
      preferredValue: undefined,
    });
  });
});

describe("resolveVesselColorForBasin", () => {
  const ush = (vesselStyle: string | null | undefined, current: string | null | undefined) =>
    resolveVesselColorForBasin({ profile: ushProfile, configurator: USH_CONFIGURATOR, vesselStyle, current });

  it.each(["Vessel", "Top_HPLPrisma", "", null, undefined])("leaves the colour alone on the basin %s", (basin) => {
    expect(ush(basin, "Antracite Matte OCF")).toBeNull();
  });

  it("leaves the colour alone before the configurator loads", () => {
    expect(
      resolveVesselColorForBasin({
        profile: ushProfile,
        configurator: null,
        vesselStyle: "Vessel_UrbanModo",
        current: "Antracite Matte OCF",
      }),
    ).toBeNull();
  });

  it("leaves the colour alone where the vessel allows no colour of its section", () => {
    const withoutVessels = catalogOf({
      ...configurator4WithLiveVessels,
      availableOptions: configurator4WithLiveVessels.availableOptions.filter(
        ({ proxyName }) => proxyName !== "Vessels",
      ),
    });

    expect(
      resolveVesselColorForBasin({
        profile: ushProfile,
        configurator: withoutVessels,
        vesselStyle: "Vessel_UrbanModo",
        current: "Antracite Matte OCF",
      }),
    ).toBeNull();
  });

  it("keeps a colour the vessel allows", () => {
    expect(ush("Vessel_UrbanModo", "Matte Black T1D")).toBe("Matte Black T1D");
  });

  it("replaces a colour the vessel refuses by its default finish", () => {
    expect(ush("Vessel_UrbanModo", "Antracite Matte OCF")).toBe("Matte White T1C");
  });

  it("replaces a colour the vessel refuses by its first colour where it has no default finish", () => {
    expect(ush("Vessel_Blade11", "Matte White T1C")).toBe("Antracite Matte OCF");
  });

  it("replaces a colour no section lists", () => {
    expect(ush("Vessel_UrbanModo", "Retired Colour")).toBe("Matte White T1C");
  });

  it.each(["Ardesia TKF", "Avenue Ivory TR9"])(
    "keeps %s, which the Urban Modo takes from Countertop Color",
    (color) => {
      expect(ush("Vessel_UrbanModo", color)).toBe(color);
    },
  );

  it("refuses a Countertop Color colour by its own material and code", () => {
    expect(ush("Vessel_Blade11", "Ardesia TKF")).toBe("Antracite Matte OCF");
    expect(ush("Vessel_UrbanModo", "Fokos Rena TQ2")).toBe("Matte White T1C");
  });

  it("does not let another section bring back a colour the vessel section refuses", () => {
    // Listed as a vessel colour of a material the Urban Modo refuses, and as an HPL countertop it takes.
    const listedTwice = catalogOf(withOption("Vessels", "Tekormud", [colour(90_003, "Ardesia TKF", "TKM", "TKF")]));

    expect(
      resolveVesselColorForBasin({
        profile: ushProfile,
        configurator: listedTwice,
        vesselStyle: "Vessel_UrbanModo",
        current: "Ardesia TKF",
      }),
    ).toBe("Matte White T1C");
  });

  it("replaces a finish the vessel refuses in a collection that lists it, and keeps one it allows", () => {
    const { profile, configurator } = CLASS;
    const basin = (vesselStyle: string) =>
      resolveVesselColorForBasin({ profile, configurator, vesselStyle, current: "Nero 433 GL" });

    expect(basin("Frame")).toBe("Fumo 401 MT");
    expect(basin("Plaza")).toBe("Nero 433 GL");
  });
});
