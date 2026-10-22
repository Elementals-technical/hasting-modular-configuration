// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { store } from "@/app/store";
import { ReadyCollectionContext, selectMessage, type ProductProfile } from "@/entities/collection";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";
import { configurator4WithLiveCountertops } from "@/entities/collection/__tests__/fixtures/configurator4LiveVessels";
import configurator12 from "@/entities/collection/__tests__/fixtures/remote/configurator-12.json";
import configurator9 from "@/entities/collection/__tests__/fixtures/remote/configurator-9.json";
import datatable438 from "@/entities/collection/__tests__/fixtures/remote/datatable-438.json";
import datatable577 from "@/entities/collection/__tests__/fixtures/remote/datatable-577.json";
import datatable578 from "@/entities/collection/__tests__/fixtures/remote/datatable-578.json";
import datatable593 from "@/entities/collection/__tests__/fixtures/remote/datatable-593.json";
import { makoProfile } from "@/entities/collection/__tests__/makoProfileFixture";
import { parseProductProfile } from "@/entities/collection/lib/parseProductProfile";
import { configuratorSchema, countertopDatatableSchema } from "@/entities/collection/model/schemas";
import { resetConfiguration } from "@/entities/configuration";
import {
  reset,
  setActiveBasinStyle,
  setActiveCountertopColor,
  setActiveProfile,
  setCountertopStyle,
  setSelectedDimensions,
} from "@/entities/product/model/store/slice";
import type { CountertopSinkLandingStatus, CountertopState } from "@/features/configuratorApi";
import { parseCountertopMatrix } from "@/features/configurator-rule-core/countertop";
import { setCountertopRuntimeState } from "@/shared/lib/countertopRuntimeState";
import classManifest from "../../../../public/collections/class/manifest.json";
import classProfileDocument from "../../../../public/collections/class/product-profile.json";
import classUi from "../../../../public/collections/class/ui.json";
import makoManifest from "../../../../public/collections/mako/manifest.json";
import makoUi from "../../../../public/collections/mako/ui.json";
import tricotManifest from "../../../../public/collections/tricot/manifest.json";
import tricotProfileDocument from "../../../../public/collections/tricot/product-profile.json";
import tricotUi from "../../../../public/collections/tricot/ui.json";
import ulhManifest from "../../../../public/collections/urban-low-height/manifest.json";
import ulhProfileDocument from "../../../../public/collections/urban-low-height/product-profile.json";
import ulhUi from "../../../../public/collections/urban-low-height/ui.json";

import { useCustomizationStepSections } from "../lib/useCustomizationSectionState";

/**
 * Mako and Class render their countertop on the fields step, so the countertop matrix reaches the
 * style and basin fields only through their availabilityRef, and the vessel choice follows the USH
 * countertop step.
 */

const configuratorGroups = configuratorSchema.parse(configurator9).availableOptions;

// Configurator 4 as Urban Low Height loads it, with the live vessel and lacquered countertop colours
// the recorded sample leaves out.
const ulhConfiguratorGroups = configuratorSchema.parse(configurator4WithLiveCountertops).availableOptions;

const readyCollectionOf = (
  collectionId: string,
  manifest: unknown,
  ui: unknown,
  countertopTable: unknown,
  groups = configuratorGroups,
) => {
  const collection = buildReadyCollection(collectionId, manifest, ui);

  return {
    ...collection,
    catalog: {
      ...collection.catalog,
      configurator: {
        groups,
        groupsByName: Object.fromEntries(groups.map((group) => [group.proxyName, group])),
      },
      countertops: parseCountertopMatrix(countertopDatatableSchema.parse(countertopTable)),
    },
  };
};

const parsedClassProfile = parseProductProfile(classProfileDocument);
if (!parsedClassProfile.ok) throw new Error("Packaged Class profile failed validation");

const parsedUlhProfile = parseProductProfile(ulhProfileDocument);
if (!parsedUlhProfile.ok) throw new Error("Packaged Urban Low Height profile failed validation");

const collections = {
  mako: { profile: makoProfile, ready: readyCollectionOf("mako", makoManifest, makoUi, datatable577) },
  class: {
    profile: parsedClassProfile.profile,
    ready: readyCollectionOf("class", classManifest, classUi, datatable578),
  },
};

const parsedTricotProfile = parseProductProfile(tricotProfileDocument);
if (!parsedTricotProfile.ok) throw new Error("Packaged Tricot profile failed validation");

// Tricot takes its vessel colours from a section of its own material configurator 12.
const tricotConfiguratorGroups = configuratorSchema.parse(configurator12).availableOptions;
const tricot = {
  profile: parsedTricotProfile.profile,
  ready: readyCollectionOf("tricot", tricotManifest, tricotUi, datatable593, tricotConfiguratorGroups),
};

const urbanLowHeight = {
  profile: parsedUlhProfile.profile,
  ready: readyCollectionOf("urban-low-height", ulhManifest, ulhUi, datatable438, ulhConfiguratorGroups),
};

type TestCollection = { profile: ProductProfile; ready: ReturnType<typeof readyCollectionOf> };

const fieldsOf = ({ ready }: TestCollection) => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ReadyCollectionContext.Provider value={ready}>
      <Provider store={store}>{children}</Provider>
    </ReadyCollectionContext.Provider>
  );
  const fieldOf = (sectionId: string, stepId = "countertop") =>
    renderHook(() => useCustomizationStepSections(stepId), { wrapper }).result.current.find(
      (section) => section.sectionId === sectionId,
    )?.fields[0]?.field;

  return {
    fieldOf,
    shownValues: (sectionId: string) => fieldOf(sectionId)?.options.map(({ value }) => value),
    enabledValues: (sectionId: string) =>
      fieldOf(sectionId)
        ?.options.filter(({ enabled }) => enabled)
        .map(({ value }) => value),
  };
};

const startWith = ({ profile }: TestCollection) => {
  store.dispatch(reset());
  store.dispatch(resetConfiguration());
  store.dispatch(setActiveProfile(profile));
  store.dispatch(setSelectedDimensions({ width: 80, depth: 52 }));
};

describe("Mako countertop fields follow the countertop matrix", () => {
  const { fieldOf, shownValues, enabledValues } = fieldsOf(collections.mako);

  beforeEach(() => startWith(collections.mako));

  it("shows the integrated basins of the chosen material only", () => {
    store.dispatch(setCountertopStyle("integrated"));

    store.dispatch(setActiveCountertopColor("CALACATTA 259"));
    expect(shownValues("basin-style")).toEqual(["VA024"]);
    expect(enabledValues("basin-style")).toEqual(["VA024"]);

    store.dispatch(setActiveCountertopColor("CALACATTA BLACK 338"));
    expect(shownValues("basin-style")).toEqual(["LV890", "LV892"]);

    store.dispatch(setActiveCountertopColor("Matte White"));
    expect(shownValues("basin-style")).toEqual(["LB440", "LB175", "LB575", "LB856"]);
  });

  it("refuses both styles past the 220 cm maximum, with the rule's reason", () => {
    store.dispatch(setActiveCountertopColor("CALACATTA 259"));
    expect(enabledValues("countertop-style")).toEqual(["integrated", "vessel"]);

    store.dispatch(setSelectedDimensions({ width: 240 }));
    const style = fieldOf("countertop-style");

    expect(style?.options.filter(({ enabled }) => enabled)).toEqual([]);
    expect(style?.options[0]?.reasonCode).toMatch(/^countertop\./);
  });
});

describe("Class countertop fields follow the countertop matrix", () => {
  const { shownValues } = fieldsOf(collections.class);

  beforeEach(() => {
    startWith(collections.class);
    store.dispatch(setCountertopStyle("integrated"));
  });

  it("shows the integrated basins of the chosen material only", () => {
    // Table 578 names its rows as configurator 9 names the material (Glass GL, Glass MT, Solid Surface).
    store.dispatch(setActiveCountertopColor("Nero 433 GL"));
    expect(shownValues("basin-style")).toEqual(["VA002", "VA005"]);

    store.dispatch(setActiveCountertopColor("CALACATTA BLACK 338"));
    expect(shownValues("basin-style")).toEqual(["LV890", "LV892"]);

    store.dispatch(setActiveCountertopColor("CALACATTA 259"));
    expect(shownValues("basin-style")).toEqual(["VA024"]);

    // VA030, Texturizzato, is in the table but not among the Class basins.
    store.dispatch(setActiveCountertopColor("Matte White"));
    expect(shownValues("basin-style")).toEqual(["LB440", "LB175", "LB575", "LB856", "VA023"]);
  });
});

// The Urban Standard Height basins name their matrix row by their label ("HPL Cover 50" is the
// HPL row "Cover 50"), as the USH countertop step reads them.
describe("Urban Low Height integrated basins follow the countertop matrix as the USH countertop step", () => {
  const { shownValues } = fieldsOf(urbanLowHeight);

  beforeEach(() => {
    startWith(urbanLowHeight);
    store.dispatch(setSelectedDimensions({ width: 80, depth: 46 }));
    store.dispatch(setCountertopStyle("integrated"));
  });

  it("shows the Tekorlux basins of a lacquered (LACM) Tekorlux countertop", () => {
    store.dispatch(setActiveCountertopColor("Agata BD MT"));

    expect(shownValues("basin-style")).toEqual([
      "Top_Tekorlux_Quadra",
      "Top_Tekorlux_Rectangular",
      "Top_Tekorlux_Trip",
    ]);
  });

  it("keeps an HPL countertop to the HPL basins, not the Fenix ones of the same name", () => {
    store.dispatch(setActiveCountertopColor("Ardesia TKF"));

    expect(shownValues("basin-style")).toEqual(["Top_HPLPrisma", "Top_HPLQuadra", "Top_HPLCover", "Top_HPLStrip"]);
  });
});

/** The scene's top carrying the sink: hosting it, over another cabinet, beside the row or back home. */
const carried = (status: CountertopSinkLandingStatus, hosted: boolean): CountertopState => ({
  readiness: "ready",
  productId: "top",
  sink: {
    owner: "countertop",
    shiftM: 0,
    landing: { status, cabinetId: null, fromCabinetId: null, reason: null, snapDxM: 0 },
    pending: null,
    hosted,
  },
});

// Table 438 makes glass 50.5 cm deep only, so at the 46 cm of Urban Low Height a glass colour stays in
// the grid, refused with the depth reason, as the USH countertop step refuses it.
describe("Urban Low Height countertop colours follow the countertop matrix, as the USH countertop step", () => {
  const { fieldOf } = fieldsOf(urbanLowHeight);
  // Bianco 0B MT is listed twice, as Tekorlux and as Glass MT: each is judged by its own material.
  const colorOf = (material: string, value: string) =>
    fieldOf("countertop-color")?.options.find((option) => option.desc === material && option.value === value);

  beforeEach(() => {
    startWith(urbanLowHeight);
    store.dispatch(setCountertopStyle("integrated"));
  });

  it("refuses the glass colours at 46 cm with the depth reason, and keeps the Tekorlux one of the same name", () => {
    store.dispatch(setSelectedDimensions({ width: 80, depth: 46 }));

    const refusedForDepth = { enabled: false, reasonCode: "countertop.materialNotAvailableForDepth" };
    expect(colorOf("Glass GL", "Bianco 0B GL")).toMatchObject(refusedForDepth);
    expect(colorOf("Glass MT", "Bianco 0B MT")).toMatchObject(refusedForDepth);
    expect(colorOf("Tekorlux", "Bianco 0B MT")?.enabled).toBe(true);
  });

  it("offers the glass colours at 50.5 cm", () => {
    store.dispatch(setSelectedDimensions({ width: 80, depth: 50.5 }));

    expect(colorOf("Glass GL", "Bianco 0B GL")?.enabled).toBe(true);
    expect(colorOf("Glass MT", "Bianco 0B MT")?.enabled).toBe(true);
  });

  // Client rule (22.10): off its Sink Base the basin rides a 5⅛″ or 5½″ top; glass makes thin tops only.
  describe("while the top carries the sink", () => {
    beforeEach(() => store.dispatch(setSelectedDimensions({ width: 80, depth: 50.5 })));
    afterEach(() => setCountertopRuntimeState(null));

    it.each([
      ["hosting it", carried("fits", true)],
      ["beside the row", carried("none", false)],
    ])("refuses the glass colours with their own reason, %s", (_where, state) => {
      setCountertopRuntimeState(state);

      const refusedOffSinkBase = { enabled: false, reasonCode: "countertop.materialNotAvailableOffSinkBase" };
      expect(colorOf("Glass GL", "Bianco 0B GL")).toMatchObject(refusedOffSinkBase);
      expect(colorOf("Glass MT", "Bianco 0B MT")).toMatchObject(refusedOffSinkBase);
      expect(colorOf("Tekorlux", "Bianco 0B MT")?.enabled).toBe(true);
      expect(colorOf("HPL", "Ardesia TKF")?.enabled).toBe(true);
    });

    it("offers them again over the sink's own Sink Base", () => {
      setCountertopRuntimeState(carried("home", false));

      expect(colorOf("Glass GL", "Bianco 0B GL")?.enabled).toBe(true);
    });

    // The glass colours are refused at 46 cm for the depth too, but lowering the top would not make them: the
    // floating top is the reason the step says.
    it("says the floating top, not the depth, for the glass colours at 46 cm", () => {
      store.dispatch(setSelectedDimensions({ width: 80, depth: 46 }));
      setCountertopRuntimeState(carried("fits", true));

      const refusedOffSinkBase = { enabled: false, reasonCode: "countertop.materialNotAvailableOffSinkBase" };
      expect(colorOf("Glass GL", "Bianco 0B GL")).toMatchObject(refusedOffSinkBase);
      expect(colorOf("Glass MT", "Bianco 0B MT")).toMatchObject(refusedOffSinkBase);
      expect(colorOf("Tekorlux", "Bianco 0B MT")?.enabled).toBe(true);
    });
  });
});

// As after the "Model Compatibility Restriction" confirm, which clears the countertop.
describe.each([
  ["Mako", collections.mako, 52],
  ["Class", collections.class, 52],
  ["Urban Low Height", urbanLowHeight, 46],
] as const)("%s offers no integrated basin before a countertop colour is chosen", (_name, collection, depth) => {
  const { shownValues, enabledValues } = fieldsOf(collection);

  it("shows the basins but enables none, as the Urban Standard Height step waits for a material", () => {
    startWith(collection);
    store.dispatch(setSelectedDimensions({ width: 80, depth }));
    store.dispatch(setCountertopStyle("integrated"));
    store.dispatch(setActiveCountertopColor(""));

    expect(shownValues("basin-style")?.length).toBeGreaterThan(0);
    expect(enabledValues("basin-style")).toEqual([]);
  });
});

describe("Class and Mako offer the thicknesses their countertop tables give", () => {
  it.each([
    // Table 578: a Class Porcelain top is 3/4" or 4-3/4", an HPL one 1/2" or 4", a Solid Surface one
    // 1/2", 4-3/4" or, with VA023 on a Sink Base of 80 cm or more, 3-1/8".
    ["class", "ARDESIA NERA 328", ["0.75", "4.75"]],
    ["class", "CALACATTA 259", ["0.5", "4"]],
    ["class", "Matte White", ["0.5", "3.125", "4.75"]],
    // Table 577: a Mako HPL top is 1/2" only.
    ["mako", "CALACATTA 259", ["0.5"]],
  ] as const)("%s, %s", (collectionId, color, thicknesses) => {
    const collection = collections[collectionId];
    startWith(collection);
    store.dispatch(setCountertopStyle("integrated"));
    store.dispatch(setActiveCountertopColor(color));

    expect(fieldsOf(collection).enabledValues("thickness")).toEqual(thicknesses);
  });
});

describe("Urban Low Height offers the thicknesses the countertop matrix gives, as the USH countertop step", () => {
  const { shownValues, enabledValues } = fieldsOf(urbanLowHeight);

  beforeEach(() => {
    startWith(urbanLowHeight);
    store.dispatch(setSelectedDimensions({ width: 80, depth: 46 }));
    store.dispatch(setCountertopStyle("integrated"));
    store.dispatch(setActiveCountertopColor("Ardesia TKF"));
  });

  it("enables the thicknesses of the chosen material at the cabinets' depth", () => {
    // Table 438: an HPL top 46 cm deep is 1/2", 4" or 5-1/8".
    expect(enabledValues("thickness")).toEqual(["0.5", "4", "5.125"]);
  });

  it("enables none where the table gives the material none, rather than every thickness", () => {
    // No HPL row of table 438 is 40 cm deep; the price says the top is missing (the countertop gap).
    store.dispatch(setSelectedDimensions({ depth: 40 }));

    expect(shownValues("thickness")?.length).toBeGreaterThan(0);
    expect(enabledValues("thickness")).toEqual([]);
  });

  // Client rule (22.10): off its Sink Base the basin rides a top that lifts only (5⅛″ or 5½″), no thin or 4″ one.
  describe("while the top carries the sink", () => {
    afterEach(() => setCountertopRuntimeState(null));

    it.each([
      ["hosting it", carried("fits", true)],
      // As a lift the UI did not commit leaves it: the Sink Base still stands, beside the basin.
      ["beside the row", carried("none", false)],
    ])("keeps the thin and 4″ tops on the step but disables them, %s", (_where, state) => {
      setCountertopRuntimeState(state);

      expect(shownValues("thickness")).toEqual(expect.arrayContaining(["0.5", "4"]));
      expect(enabledValues("thickness")).toEqual(["5.125"]);
    });

    it("enables 4″ over the sink's own Sink Base", () => {
      setCountertopRuntimeState(carried("home", false));

      expect(enabledValues("thickness")).toEqual(["0.5", "4", "5.125"]);
    });
  });
});

describe.each(Object.entries(collections))("%s vessel choice follows the USH countertop step", (_id, collection) => {
  const { fieldOf, shownValues, enabledValues } = fieldsOf(collection);

  beforeEach(() => startWith(collection));

  it("shows None and the vessels, not the integrated basins, for the vessel style", () => {
    store.dispatch(setActiveCountertopColor("CALACATTA 259"));
    store.dispatch(setCountertopStyle("vessel"));

    expect(shownValues("basin-style")).toEqual(["None", "Iris", "Frame", "Plaza"]);
    expect(enabledValues("basin-style")).toEqual(["None", "Iris", "Frame", "Plaza"]);
  });

  it("shows None as chosen while a vessel countertop has no basin", () => {
    // Switching to vessel clears an integrated basin, such as a collection's default (buildChangePlan).
    store.dispatch(setActiveBasinStyle(""));
    store.dispatch(setCountertopStyle("vessel"));
    expect(fieldOf("basin-style")?.value).toBe("None");

    store.dispatch(setActiveBasinStyle("Iris"));
    expect(fieldOf("basin-style")?.value).toBe("Iris");

    // An integrated countertop without a basin has nothing chosen.
    store.dispatch(setActiveBasinStyle(""));
    store.dispatch(setCountertopStyle("integrated"));
    expect(fieldOf("basin-style")?.value).toBe("");
  });

  it("offers the vessel colour once a vessel is chosen: the empty cutout and an integrated top have none", () => {
    store.dispatch(setCountertopStyle("integrated"));
    expect(fieldOf("vessel-color")?.visible).toBe(false);

    store.dispatch(setCountertopStyle("vessel"));
    store.dispatch(setActiveBasinStyle(""));
    expect(fieldOf("vessel-color")?.visible).toBe(false);

    store.dispatch(setActiveBasinStyle("Iris"));
    expect(fieldOf("vessel-color")?.visible).toBe(true);
  });

  // The recorded configurator lists the 20 lacquered matt and 20 lacquered gloss colours.
  it.each([
    ["Iris", / MT$/, 20],
    ["Frame", / MT$/, 20],
    ["Plaza", / (MT|GL)$/, 40],
  ])("offers %s the lacquers of its palette, and shows the rest with the reason", (vessel, finish, count) => {
    store.dispatch(setCountertopStyle("vessel"));
    store.dispatch(setActiveBasinStyle(vessel));
    const field = fieldOf("vessel-color");
    const enabled = enabledValues("vessel-color") ?? [];

    expect(enabled).toHaveLength(count);
    expect(enabled.every((value) => finish.test(value))).toBe(true);
    expect(shownValues("vessel-color")).toEqual(fieldOf("cabinet-color", "color")?.options.map(({ value }) => value));
    expect(
      field?.options
        .filter(({ enabled: isEnabled }) => !isEnabled)
        .every(({ reasonCode }) => reasonCode === "vessel.colorUnavailable"),
    ).toBe(true);
  });
});

describe("Tricot vessel choice follows the Class one", () => {
  const { fieldOf, shownValues, enabledValues } = fieldsOf(tricot);
  const vesselPalette = configuratorSchema
    .parse(configurator12)
    .availableOptions.find(({ proxyName }) => proxyName === "Select Vessel Color")
    ?.options.flatMap(({ variants }) => variants.map(({ name }) => name));

  beforeEach(() => {
    startWith(tricot);
    store.dispatch(setActiveCountertopColor("CALACATTA 259"));
  });

  it("offers both countertop styles, with their pictures", () => {
    expect(fieldOf("countertop-style")?.options.map(({ value, image }) => [value, image])).toEqual([
      ["integrated", expect.stringContaining("images/countertop-style/Integrated.png")],
      ["vessel", expect.stringContaining("images/countertop-style/Vessel.png")],
    ]);
    expect(enabledValues("countertop-style")).toEqual(["integrated", "vessel"]);
  });

  it("shows None and the vessels, not the integrated basins, for the vessel style", () => {
    store.dispatch(setCountertopStyle("vessel"));

    expect(shownValues("basin-style")).toEqual(["None", "Iris", "Frame", "Plaza"]);
    expect(enabledValues("basin-style")).toEqual(["None", "Iris", "Frame", "Plaza"]);
  });

  it("offers the vessel colour once a vessel is chosen: the empty cutout and an integrated top have none", () => {
    store.dispatch(setCountertopStyle("integrated"));
    expect(fieldOf("vessel-color")?.visible).toBe(false);

    store.dispatch(setCountertopStyle("vessel"));
    store.dispatch(setActiveBasinStyle(""));
    expect(fieldOf("vessel-color")?.visible).toBe(false);

    store.dispatch(setActiveBasinStyle("Iris"));
    expect(fieldOf("vessel-color")?.visible).toBe(true);
  });

  // Configurator 12 lists the 20 lacquered matt and 20 lacquered gloss colours under Select Vessel Color.
  it.each([
    ["Iris", / MT$/, 20],
    ["Frame", / MT$/, 20],
    ["Plaza", / (MT|GL)$/, 40],
  ])("offers %s the lacquers of its palette, and shows the rest with the reason", (vessel, finish, count) => {
    store.dispatch(setCountertopStyle("vessel"));
    store.dispatch(setActiveBasinStyle(vessel));
    const field = fieldOf("vessel-color");
    const enabled = enabledValues("vessel-color") ?? [];

    expect(enabled).toHaveLength(count);
    expect(enabled.every((value) => finish.test(value))).toBe(true);
    expect(vesselPalette).toHaveLength(40);
    expect(new Set(shownValues("vessel-color"))).toEqual(new Set(vesselPalette));
    expect(
      field?.options
        .filter(({ enabled: isEnabled }) => !isEnabled)
        .every(({ reasonCode }) => reasonCode === "vessel.colorUnavailable"),
    ).toBe(true);
  });
});

// Table 593 makes every Tricot top up to 220 cm, for both styles, so the colours follow the cabinets'
// widths as the Urban Low Height ones do.
describe.each(["integrated", "vessel"])(
  "Tricot countertop colours follow the countertop matrix for the %s style, as Urban Low Height's",
  (style) => {
    const { fieldOf } = fieldsOf(tricot);

    beforeEach(() => {
      startWith(tricot);
      store.dispatch(setCountertopStyle(style));
    });

    it("offers every colour while the top stays within 220 cm", () => {
      store.dispatch(setSelectedDimensions({ width: 200, depth: 52 }));
      const options = fieldOf("countertop-color")?.options ?? [];

      expect(options).toHaveLength(71);
      expect(options.every(({ enabled }) => enabled)).toBe(true);
    });

    it("refuses every colour past 220 cm, with a reason the collection words", () => {
      store.dispatch(setSelectedDimensions({ width: 240, depth: 52 }));
      const options = fieldOf("countertop-color")?.options ?? [];

      expect(options.filter(({ enabled }) => enabled)).toEqual([]);
      expect(new Set(options.map(({ reasonCode }) => reasonCode))).toEqual(
        new Set(["countertop.materialNotAvailableForWidth"]),
      );
      expect(selectMessage(tricot.profile, "countertop.materialNotAvailableForWidth")).toBe(
        "Not available for current cabinet width",
      );
    });
  },
);

// The Urban Standard Height vessels take the colours its vesselCompatibility names, judged by the
// material a colour is listed under and its colour code, as the USH countertop step judges them.
describe("Urban Low Height vessel colours follow the chosen vessel, as the USH countertop step", () => {
  const { fieldOf, enabledValues } = fieldsOf(urbanLowHeight);

  beforeEach(() => {
    startWith(urbanLowHeight);
    store.dispatch(setSelectedDimensions({ width: 80, depth: 46 }));
    store.dispatch(setActiveCountertopColor("Ardesia TKF"));
    store.dispatch(setCountertopStyle("vessel"));
  });

  it("offers the colour once a vessel is chosen: the empty cutout has none", () => {
    store.dispatch(setActiveBasinStyle(""));
    expect(fieldOf("vessel-color")?.visible).toBe(false);

    store.dispatch(setActiveBasinStyle("Vessel_Blade11"));
    expect(fieldOf("vessel-color")?.visible).toBe(true);
  });

  it.each([
    ["Vessel_Blade11", ["Antracite Matte OCF", "Cemento Matte OCD"]],
    ["Vessel_UrbanModo", ["Matte Black T1D", "Matte White T1C"]],
    ["Vessel_UrbanMorris", ["Bianco Gloss TAL", "Bianco Matte TAM"]],
    ["Vessel_Aquarius", ["Agata BD MT", "Bianco Gloss TAL", "Bianco Matte TAM"]],
  ])("enables the colours %s takes", (vessel, colors) => {
    store.dispatch(setActiveBasinStyle(vessel));

    expect(enabledValues("vessel-color")).toEqual(colors);
  });
});
