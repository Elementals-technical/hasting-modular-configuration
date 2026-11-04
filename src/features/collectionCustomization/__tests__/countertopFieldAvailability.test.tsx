// @vitest-environment jsdom

import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { store } from "@/app/store";
import { ReadyCollectionContext, selectMessage, type ProductProfile } from "@/entities/collection";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";
import { configurator10WithLacquerCountertops } from "@/entities/collection/__tests__/fixtures/configurator4LiveVessels";
import configurator12 from "@/entities/collection/__tests__/fixtures/remote/configurator-12.json";
import configurator8 from "@/entities/collection/__tests__/fixtures/remote/configurator-8.json";
import configurator13 from "@/entities/collection/__tests__/fixtures/remote/configurator-13.json";
import configurator9 from "@/entities/collection/__tests__/fixtures/remote/configurator-9.json";
import datatable589 from "@/entities/collection/__tests__/fixtures/remote/datatable-589.json";
import datatable577 from "@/entities/collection/__tests__/fixtures/remote/datatable-577.json";
import datatable578 from "@/entities/collection/__tests__/fixtures/remote/datatable-578.json";
import datatable593 from "@/entities/collection/__tests__/fixtures/remote/datatable-593.json";
import datatable595 from "@/entities/collection/__tests__/fixtures/remote/datatable-595.json";
import { makoProfile } from "@/entities/collection/__tests__/makoProfileFixture";
import { parseProductProfile } from "@/entities/collection/lib/parseProductProfile";
import { classRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/classRuntimeBindingsFixture";
import { parseRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/parseRuntimeBindings";
import type { RuntimeBindingSet } from "@/entities/collection/model/runtimeBindings";
import { configuratorSchema, countertopDatatableSchema } from "@/entities/collection/model/schemas";
import { resetConfiguration, setActiveRuntimeBindings } from "@/entities/configuration";
import type { ConfiguratorVariant } from "@/entities/configurator/api";
import {
  addProductId,
  reset,
  setActiveBasinStyle,
  setActiveCountertopColor,
  setActiveCountertopThickness,
  setActiveProfile,
  setCountertopStyle,
  setSelectedDimensions,
} from "@/entities/product/model/store/slice";
import type { CountertopSinkLandingStatus, CountertopState } from "@/features/configuratorApi";
import { parseCountertopMatrix } from "@/features/configurator-rule-core/countertop";
import { checkUndetermined } from "@/features/configurationCommands/lib/undeterminedGate";
import { setCountertopRuntimeState } from "@/shared/lib/countertopRuntimeState";
import { resolveUiReasonText } from "@/shared/lib/reasonText";
import classManifest from "../../../../public/collections/class/manifest.json";
import classProfileDocument from "../../../../public/collections/class/product-profile.json";
import classUi from "../../../../public/collections/class/ui.json";
import makoManifest from "../../../../public/collections/mako/manifest.json";
import makoUi from "../../../../public/collections/mako/ui.json";
import tricotManifest from "../../../../public/collections/tricot/manifest.json";
import tricotProfileDocument from "../../../../public/collections/tricot/product-profile.json";
import tricotUi from "../../../../public/collections/tricot/ui.json";
import udManifest from "../../../../public/collections/urban-duplex/manifest.json";
import udProfileDocument from "../../../../public/collections/urban-duplex/product-profile.json";
import udBindingsDocument from "../../../../public/collections/urban-duplex/runtime-bindings.json";
import udUi from "../../../../public/collections/urban-duplex/ui.json";
import ulhManifest from "../../../../public/collections/urban-low-height/manifest.json";
import ulhProfileDocument from "../../../../public/collections/urban-low-height/product-profile.json";
import ulhUi from "../../../../public/collections/urban-low-height/ui.json";

import { useCustomizationStepSections } from "../lib/useCustomizationSectionState";

/**
 * Mako and Class render their countertop on the fields step, so the countertop matrix reaches the
 * style and basin fields only through their availabilityRef, and the vessel choice follows the USH
 * countertop step.
 */

/** The size the scene reads for a placed cabinet; with one not listed it answers as with no scene. */
const sceneSizes = vi.hoisted(() => new Map<string, { Width: number; Depth: number }>());
vi.mock("@/utils/functions/playcanvas/getConfig", () => ({
  getConfig: async (runtimeId: string) => sceneSizes.get(runtimeId) ?? null,
}));

// A rendered step keeps polling the scene until it is unmounted.
afterEach(cleanup);

const configuratorGroups = configuratorSchema.parse(configurator9).availableOptions;

// Configurator 10 as Urban Low Height loads it, with the lacquered countertop colours that keep table
// 589's rules for them covered.
const ulhConfiguratorGroups = configuratorSchema.parse(configurator10WithLacquerCountertops).availableOptions;

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
  ready: readyCollectionOf("urban-low-height", ulhManifest, ulhUi, datatable589, ulhConfiguratorGroups),
};

const parsedUdProfile = parseProductProfile(udProfileDocument);
if (!parsedUdProfile.ok) throw new Error("Packaged Urban Duplex profile failed validation");
const parsedUdBindings = parseRuntimeBindings(udBindingsDocument);
if (!parsedUdBindings.ok) throw new Error("Packaged Urban Duplex runtime bindings failed validation");

// Urban Duplex takes its countertop colours from its own material configurator 13 and its rows from table 595.
const urbanDuplex = {
  profile: parsedUdProfile.profile,
  ready: readyCollectionOf(
    "urban-duplex",
    udManifest,
    udUi,
    datatable595,
    configuratorSchema.parse(configurator13).availableOptions,
  ),
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
    wrapper,
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

// Configurator 9 as it answered on 2026-10-28, which the recorded sample of 2026-09-23 predates: it also offers a
// Fenix colour and the 3-1/8" Matte White, neither of which table 577 makes.
const makoCountertopVariant = (
  value: string,
  Material: string,
  sku: string,
  codeColor: string,
): ConfiguratorVariant => ({
  id: 0,
  name: value,
  image: null,
  enabled: true,
  description: "",
  metadata: { productType: "Vanities", label: value, value, Material, sku, codeColor },
});
const makoLiveConfiguratorGroups = configuratorGroups.map((group) =>
  group.proxyName === "Select Countertop Color"
    ? {
        ...group,
        options: group.options.map((option, index) =>
          index === 0
            ? {
                ...option,
                variants: [
                  ...option.variants,
                  makoCountertopVariant("Bianco Male TFA", "Fenix", "FX", "TFA"),
                  makoCountertopVariant("Matte White 8cm", "Solid Surface 3 ⅛", "SSTMT", "MW"),
                ],
              }
            : option,
        ),
      }
    : group,
);

describe("Mako countertop colours follow table 577", () => {
  const mako = {
    profile: makoProfile,
    ready: readyCollectionOf("mako", makoManifest, makoUi, datatable577, makoLiveConfiguratorGroups),
  };
  const { fieldOf } = fieldsOf(mako);
  const colorOf = (value: string) => fieldOf("countertop-color")?.options.find((option) => option.value === value);

  beforeEach(() => {
    startWith(mako);
    store.dispatch(setCountertopStyle("integrated"));
  });

  it("offers the materials the table makes, the Matte White the collection starts from among them", () => {
    expect(colorOf(makoProfile.defaults.CountertopColor)?.enabled).toBe(true);
    expect(colorOf("Nero 433 GL")?.enabled).toBe(true);
    expect(colorOf("CALACATTA 259")?.enabled).toBe(true);
    expect(colorOf("CALACATTA BLACK 338")?.enabled).toBe(true);
  });

  it('refuses the Fenix colours and the 3-1/8" Matte White, which the table does not make, in its own words', () => {
    for (const value of ["Bianco Male TFA", "Matte White 8cm"]) {
      const reasonCode = colorOf(value)?.reasonCode ?? "";
      expect(colorOf(value)).toMatchObject({ enabled: false, reasonCode: expect.stringMatching(/^countertop\./) });
      expect(selectMessage(makoProfile, reasonCode)).not.toBe(reasonCode);
    }
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

// Configurator 8 and table 578 as they answer on 2026-10-30, which the recorded samples predate: Matte White and
// Matte White 8cm are Solid Surface with their GB materials, Technolite and Technomat, and the 3-1/8" VA023 row is
// named Technomat.
const withGbMaterial = (variant: ConfiguratorVariant, GBMaterial: string): ConfiguratorVariant => ({
  ...variant,
  metadata: { ...variant.metadata, Material: "Solid Surface", GBMaterial },
});
const classLive = {
  profile: parsedClassProfile.profile,
  ready: readyCollectionOf(
    "class",
    classManifest,
    classUi,
    {
      ...datatable578,
      rows: datatable578.rows.map((row) => (row.basin_style === "VA023" ? { ...row, material: "Technomat" } : row)),
    },
    configuratorSchema.parse(configurator8).availableOptions.map((group) =>
      group.proxyName === "Select Countertop Color"
        ? {
            ...group,
            options: group.options.map((option) => ({
              ...option,
              variants: option.variants.map((variant) =>
                variant.name === "Matte White"
                  ? withGbMaterial(variant, "Technolite")
                  : variant.name === "Matte White 8cm"
                    ? withGbMaterial(variant, "Technomat")
                    : variant,
              ),
            })),
          }
        : group,
    ),
  ),
};

describe("Class countertop colours follow table 578", () => {
  const { fieldOf, shownValues, enabledValues } = fieldsOf(classLive);
  const colorOf = (value: string) => fieldOf("countertop-color")?.options.find((option) => option.value === value);

  beforeEach(() => {
    startWith(classLive);
    store.dispatch(setCountertopStyle("integrated"));
  });

  it("refuses Matte White 8cm on a Sink Base under 80 cm, naming the 80 cm, and keeps Matte White", () => {
    store.dispatch(setSelectedDimensions({ width: 60, depth: 52 }));

    expect(colorOf("Matte White 8cm")).toMatchObject({
      enabled: false,
      reason: 'Not available for current sink base width. Current 60 cm (23.6"), minimum 80 cm (31.5").',
      reasonCode: "countertop.sinkBaseBelowMin",
      reasonParams: { currentCm: 60, currentIn: "23.6", minCm: 80, minIn: "31.5" },
    });
    expect(colorOf("Matte White")?.enabled).toBe(true);
  });

  it('gives Matte White 8cm on an 80 cm Sink Base the 3-1/8" top and VA023 only', () => {
    store.dispatch(setActiveCountertopColor("Matte White 8cm"));

    expect(colorOf("Matte White 8cm")?.enabled).toBe(true);
    expect(enabledValues("thickness")).toEqual(["3.125"]);
    expect(shownValues("basin-style")).toEqual(["VA023"]);
  });

  // Matte White 8cm is Technomat (configurator 8's GBMaterial) with a row of its own in table 578: no
  // undetermined rule keeps the command from choosing it.
  it("lets the command choose Matte White 8cm", () => {
    expect(
      checkUndetermined(
        { attributeId: "CountertopColor", scope: "countertop", value: "Matte White 8cm" },
        { scope: "countertop" },
        store.getState(),
        classLive.profile,
      ),
    ).toBeNull();
  });
});

/**
 * The step on Sink Bases of these widths, as the scene reads them. They arrive after the first render, so this is one
 * render to wait on, where `fieldOf` renders afresh.
 */
const stepOnSinkBases = (collection: TestCollection, bindings: RuntimeBindingSet, widths: number[], depth: number) => {
  store.dispatch(setActiveRuntimeBindings(bindings));
  widths.forEach((Width, index) => {
    const runtimeId = `${bindings.productTypes?.["Sink-Base"]}-${index}`;
    sceneSizes.set(runtimeId, { Width, Depth: depth });
    store.dispatch(addProductId(runtimeId));
  });
  const { result } = renderHook(() => useCustomizationStepSections("countertop"), {
    wrapper: fieldsOf(collection).wrapper,
  });
  const optionsOf = (sectionId: string) =>
    result.current.find((section) => section.sectionId === sectionId)?.fields[0]?.field.options;

  return {
    optionOf: (sectionId: string, value: string) => optionsOf(sectionId)?.find((option) => option.value === value),
    enabledValues: (sectionId: string) =>
      optionsOf(sectionId)
        ?.filter(({ enabled }) => enabled)
        .map(({ value }) => value),
  };
};

// The store's selected size stands for the cabinet the user last picked: the scene's read is what changes the verdict.
describe("the countertop step judges a composition by its narrowest Sink Base", () => {
  afterEach(() => {
    sceneSizes.clear();
    store.dispatch(setActiveRuntimeBindings(null));
  });

  describe("on Class", () => {
    const classOn = (...widths: number[]) => stepOnSinkBases(classLive, classRuntimeBindings, widths, 52);

    beforeEach(() => {
      startWith(classLive);
      store.dispatch(setCountertopStyle("integrated"));
    });

    // Technomat's one row, VA023 from 80 cm, has no basin for the 60.
    it("refuses Matte White 8cm on an 80 and a 60 cm one, naming the 60 cm and the 80 cm it needs", async () => {
      const step = classOn(80, 60);

      await waitFor(() =>
        expect(step.optionOf("countertop-color", "Matte White 8cm")).toMatchObject({
          enabled: false,
          reason: 'Not available for current sink base width. Current 60 cm (23.6"), minimum 80 cm (31.5").',
          reasonCode: "countertop.sinkBaseBelowMin",
          reasonParams: { currentCm: 60, minCm: 80 },
        }),
      );
    });

    it("offers Matte White 8cm and VA023 on two 80 cm ones, with a 60 cm cabinet selected", async () => {
      store.dispatch(setSelectedDimensions({ width: 60 }));
      store.dispatch(setActiveCountertopColor("Matte White 8cm"));
      store.dispatch(setActiveCountertopThickness("3.125"));
      const step = classOn(80, 80);

      await waitFor(() => expect(step.optionOf("countertop-color", "Matte White 8cm")?.enabled).toBe(true));
      expect(step.enabledValues("basin-style")).toEqual(["VA023"]);
    });

    // The table names no Technolite, so Matte White keeps the Solid Surface rows, which make the LB basins from 60 cm.
    it("keeps Matte White and its LB basins on an 80 and a 60 cm one, where Matte White 8cm is refused", async () => {
      store.dispatch(setActiveCountertopColor("Matte White"));
      store.dispatch(setActiveCountertopThickness("0.5"));
      const step = classOn(80, 60);

      await waitFor(() => expect(step.optionOf("countertop-color", "Matte White 8cm")?.enabled).toBe(false));
      expect(step.optionOf("countertop-color", "Matte White")?.enabled).toBe(true);
      expect(step.enabledValues("basin-style")).toEqual(["LB440", "LB175", "LB575", "LB856"]);
    });
  });

  // Table 595 makes the HPL Strip 48 and Cover 50 basins from a 70 cm Sink Base, Prisma 50 and Quadra 50 from 60 cm,
  // and a vessel top on HPL from 80 cm.
  describe("on Urban Duplex", () => {
    const udOn = (...widths: number[]) => stepOnSinkBases(urbanDuplex, parsedUdBindings.bindings, widths, 50);

    beforeEach(() => {
      startWith(urbanDuplex);
      store.dispatch(setSelectedDimensions({ width: 80, depth: 50 }));
      store.dispatch(setCountertopStyle("integrated"));
      store.dispatch(setActiveCountertopColor("Pulpis Chiaro TKH"));
      store.dispatch(setActiveCountertopThickness("0.5"));
    });

    it("keeps an HPL colour on an 80 and a 60 cm one, without the basins the 60 cm one cannot take", async () => {
      const step = udOn(80, 60);

      await waitFor(() => expect(step.optionOf("basin-style", "Top_HPLStrip")?.enabled).toBe(false));
      expect(step.optionOf("basin-style", "Top_HPLCover")?.enabled).toBe(false);
      expect(step.optionOf("basin-style", "Top_HPLPrisma")?.enabled).toBe(true);
      expect(step.optionOf("countertop-color", "Pulpis Chiaro TKH")?.enabled).toBe(true);
    });

    it("names the minimum of a basin the 60 cm one cannot take, in the collection's words", async () => {
      const step = udOn(80, 60);

      await waitFor(() =>
        expect(step.optionOf("basin-style", "Top_HPLStrip")).toMatchObject({
          enabled: false,
          reason: 'Not available for current sink base width. Current 60 cm (23.6"), minimum 70 cm (27.6").',
          reasonCode: "countertop.sinkBaseBelowMin",
          reasonParams: { currentCm: 60, currentIn: "23.6", minCm: 70, minIn: "27.6" },
        }),
      );
      expect(step.optionOf("basin-style", "Top_HPLPrisma")).toMatchObject({ enabled: true, reasonCode: undefined });
    });

    it("keeps the general reason for a basin its width does not refuse", async () => {
      store.dispatch(setActiveCountertopThickness("9"));
      const step = udOn(80, 80);

      await waitFor(() =>
        expect(step.optionOf("basin-style", "Top_HPLStrip")).toMatchObject({
          enabled: false,
          reasonCode: "change.notAvailable",
        }),
      );
    });

    it("refuses the vessel style on an 80 and a 60 cm one, for its 80 cm minimum", async () => {
      const step = udOn(80, 60);

      await waitFor(() =>
        expect(step.optionOf("countertop-style", "vessel")).toMatchObject({
          enabled: false,
          reasonCode: "countertop.vesselSinkBaseMin",
          reasonParams: expect.objectContaining({ minCm: 80 }),
        }),
      );
      expect(step.optionOf("countertop-style", "integrated")?.enabled).toBe(true);
    });
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

// Table 589 makes a vessel top on a Sink Base of at least min_vsl_cm (80 cm): below it the cutout would be priced
// with no basin it could hold.
describe("Urban Low Height countertop style follows the vessel Sink Base minimum", () => {
  const { fieldOf, enabledValues } = fieldsOf(urbanLowHeight);
  const styleOf = (value: string) => fieldOf("countertop-style")?.options.find((option) => option.value === value);

  beforeEach(() => {
    startWith(urbanLowHeight);
    store.dispatch(setActiveCountertopColor("Ardesia TKF"));
    store.dispatch(setCountertopStyle("integrated"));
  });

  it("refuses the vessel style on a 70 cm Sink Base with the minimum, and keeps integrated", () => {
    store.dispatch(setSelectedDimensions({ width: 70, depth: 46 }));

    expect(enabledValues("countertop-style")).toEqual(["integrated"]);
    expect(styleOf("vessel")).toMatchObject({
      enabled: false,
      reasonCode: "countertop.vesselSinkBaseMin",
      reasonParams: expect.objectContaining({ minCm: 80 }),
    });
  });

  it("offers the vessel style on an 80 cm Sink Base", () => {
    store.dispatch(setSelectedDimensions({ width: 80, depth: 46 }));

    expect(enabledValues("countertop-style")).toEqual(["integrated", "vessel"]);
  });

  // Table 589 makes a glass integrated top on a Sink Base of 70 cm or more: at 60 cm both styles are refused, each
  // for its own minimum.
  it("says each refused style's own minimum on a 60 cm Sink Base", () => {
    store.dispatch(setSelectedDimensions({ width: 60, depth: 50 }));
    store.dispatch(setActiveCountertopColor("Bianco 0B GL"));

    expect(styleOf("integrated")).toMatchObject({ enabled: false, reasonCode: "countertop.sinkBaseBelowMin" });
    expect(styleOf("vessel")).toMatchObject({ enabled: false, reasonCode: "countertop.vesselSinkBaseMin" });
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

// Table 589 makes glass 50 cm deep only, so at the 46 cm of Urban Low Height a glass colour stays in
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

  it("offers the glass colours at 50 cm", () => {
    store.dispatch(setSelectedDimensions({ width: 80, depth: 50 }));

    expect(colorOf("Glass GL", "Bianco 0B GL")?.enabled).toBe(true);
    expect(colorOf("Glass MT", "Bianco 0B MT")?.enabled).toBe(true);
  });

  // Client rule (22.10): off its Sink Base the basin rides a 5⅛″ or 5½″ top; glass makes thin tops only.
  describe("while the top carries the sink", () => {
    beforeEach(() => store.dispatch(setSelectedDimensions({ width: 80, depth: 50 })));
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
  const { fieldOf, shownValues, enabledValues } = fieldsOf(urbanLowHeight);

  beforeEach(() => {
    startWith(urbanLowHeight);
    store.dispatch(setSelectedDimensions({ width: 80, depth: 46 }));
    store.dispatch(setCountertopStyle("integrated"));
    store.dispatch(setActiveCountertopColor("Ardesia TKF"));
  });

  it("enables the thicknesses of the chosen material at the cabinets' depth", () => {
    // Table 589: an HPL top 46 cm deep is 1/2", 4" or 5-1/8".
    expect(enabledValues("thickness")).toEqual(["0.5", "4", "5.125"]);
  });

  it("enables none where the table gives the material none, rather than every thickness", () => {
    // No HPL row of table 589 is 40 cm deep; the price says the top is missing (the countertop gap).
    store.dispatch(setSelectedDimensions({ depth: 40 }));

    expect(shownValues("thickness")?.length).toBeGreaterThan(0);
    expect(enabledValues("thickness")).toEqual([]);
  });

  // Client rule (22.10): off its Sink Base an integrated basin rides a top that lifts only (5⅛″ or 5½″), no thin or 4″ one.
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
      expect(fieldOf("thickness")?.preferredValue).toBe("5.125");
    });

    it("enables 4″ over the sink's own Sink Base", () => {
      setCountertopRuntimeState(carried("home", false));

      expect(enabledValues("thickness")).toEqual(["0.5", "4", "5.125"]);
    });

    // Client rule (27.10): 4″ is available with a Vessel style countertop, or over an integrated basin in its Sink Base.
    it("enables 4″ as well under a vessel, and keeps the top that lifts as the one autoSelect takes", () => {
      store.dispatch(setCountertopStyle("vessel"));
      setCountertopRuntimeState(carried("fits", true));

      expect(enabledValues("thickness")).toEqual(["4", "5.125"]);
      expect(fieldOf("thickness")?.preferredValue).toBe("5.125");
    });

    it("prefers nothing over the sink's own Sink Base", () => {
      store.dispatch(setCountertopStyle("vessel"));
      setCountertopRuntimeState(carried("home", false));

      expect(fieldOf("thickness")?.preferredValue).toBeUndefined();
    });
  });
});

// The same client rules as Urban Low Height (22.10, 27.10): Urban Duplex's Thickness options declare the same capabilities.
describe("Urban Duplex offers the thicknesses table 595 gives, by the Urban Low Height rules", () => {
  const { fieldOf, enabledValues } = fieldsOf(urbanDuplex);

  beforeEach(() => {
    startWith(urbanDuplex);
    store.dispatch(setSelectedDimensions({ width: 80, depth: 46 }));
    store.dispatch(setCountertopStyle("integrated"));
  });
  afterEach(() => setCountertopRuntimeState(null));

  it.each([
    // Table 595: an HPL or Fenix top is 1/2", 4" or 5-1/8"; a Porcelain one 1/2", 2-3/8", 4" or 5-1/2".
    ["HPL", "Ardesia TKF", ["0.5", "4", "5.125"], "5.125"],
    ["Fenix", "Bianco Male TFA", ["0.5", "4", "5.125"], "5.125"],
    ["Porcelain", "Avenue Amber TRC", ["0.5", "2.4", "4", "5.5"], "5.5"],
  ] as const)(
    "%s: every thickness over its Sink Base, the top that lifts off it, and 4″ too under a vessel",
    (_material, color, home, lifting) => {
      store.dispatch(setActiveCountertopColor(color));
      expect(enabledValues("thickness")).toEqual(home);

      setCountertopRuntimeState(carried("fits", true));
      expect(enabledValues("thickness")).toEqual([lifting]);
      expect(fieldOf("thickness")?.preferredValue).toBe(lifting);

      store.dispatch(setCountertopStyle("vessel"));
      expect(enabledValues("thickness")).toEqual(["4", lifting]);

      setCountertopRuntimeState(carried("home", false));
      expect(enabledValues("thickness")).toEqual(home);
    },
  );
});

// Urban Duplex carries fallbacks that restrict an integrated top at 46 cm for Tekormud and Solid Surface tops, none
// of which its configurator offers: the profile here restricts HPL instead, so that an HPL colour reaches the check.
describe("Urban Duplex names the restricted depth on a refused integrated style", () => {
  const { profile } = urbanDuplex;
  const fallbacks = profile.ruleData.countertopFallbacks;
  if (!fallbacks) throw new Error("The Urban Duplex profile declares no countertop fallbacks");
  const restrictingHpl: TestCollection = {
    ...urbanDuplex,
    profile: {
      ...profile,
      ruleData: {
        ...profile.ruleData,
        countertopFallbacks: { ...fallbacks, restrictedIntegratedMaterialTokens: ["hpl"] },
      },
    },
  };
  const { fieldOf, enabledValues } = fieldsOf(restrictingHpl);
  const styleOf = (value: string) => fieldOf("countertop-style")?.options.find((option) => option.value === value);

  beforeEach(() => {
    startWith(restrictingHpl);
    store.dispatch(setActiveCountertopColor("Ardesia TKF"));
    store.dispatch(setCountertopStyle("integrated"));
  });

  // Table 595 makes an integrated HPL top from a 60 cm Sink Base: on a 50 cm one the rules refuse it.
  it("refuses the integrated style at 46 cm in the profile's words for the depth", () => {
    store.dispatch(setSelectedDimensions({ width: 50, depth: 46 }));

    expect(styleOf("integrated")).toMatchObject({
      enabled: false,
      reasonCode: "countertop.integratedDepthRestricted",
      reasonParams: { depthCm: 46, depthIn: "18.1" },
      reason: 'Integrated basin style not available for 46cm (18.1") depth configurations',
    });
  });

  it("keeps the Sink Base minimum as the reason at 50 cm", () => {
    store.dispatch(setSelectedDimensions({ width: 50, depth: 50 }));

    expect(styleOf("integrated")).toMatchObject({ enabled: false, reasonCode: "countertop.sinkBaseBelowMin" });
  });

  it("still offers the integrated style at 46 cm where the rules allow it", () => {
    store.dispatch(setSelectedDimensions({ width: 80, depth: 46 }));

    expect(enabledValues("countertop-style")).toContain("integrated");
  });
});

// The scene cannot change a basin the lifted top hosts, and a basin field names a Sink Base: until the top is back
// over a sink cabinet the style, the basin and the vessel colour stay as they are, each saying why.
describe.each([
  ["Urban Low Height", urbanLowHeight],
  ["Urban Duplex", urbanDuplex],
] as const)("%s keeps the basin while the top hosts it", (_name, collection) => {
  const { fieldOf, shownValues, enabledValues } = fieldsOf(collection);
  const reasonsOf = (sectionId: string) =>
    new Set(fieldOf(sectionId)?.options.map(({ enabled, reasonCode }) => (enabled ? "enabled" : reasonCode)));
  const hostedRefusals = (sectionId: string) =>
    fieldOf(sectionId)?.options.filter(({ reasonCode }) => reasonCode?.startsWith("countertop.hostedSink.")) ?? [];

  beforeEach(() => {
    startWith(collection);
    store.dispatch(setSelectedDimensions({ width: 80, depth: 46 }));
    store.dispatch(setActiveCountertopColor("Ardesia TKF"));
    store.dispatch(setCountertopStyle("integrated"));
  });
  afterEach(() => setCountertopRuntimeState(null));

  it("refuses both countertop styles while the top hosts the basin, and offers them again once it lands", () => {
    expect(enabledValues("countertop-style")).toEqual(["integrated", "vessel"]);

    setCountertopRuntimeState(carried("fits", true));
    expect(reasonsOf("countertop-style")).toEqual(new Set(["countertop.hostedSink.style"]));
    expect(resolveUiReasonText({ code: "countertop.hostedSink.style" })).toBe(
      "Lower the countertop onto a sink cabinet to change the countertop style.",
    );

    setCountertopRuntimeState(carried("home", false));
    expect(enabledValues("countertop-style")).toEqual(["integrated", "vessel"]);
  });

  it("shows the basins of the countertop, as over its Sink Base, every one refused with the reason", () => {
    const basins = shownValues("basin-style");
    expect(basins?.length).toBeGreaterThan(0);

    setCountertopRuntimeState(carried("fits", true));
    expect(shownValues("basin-style")).toEqual(basins);
    expect(reasonsOf("basin-style")).toEqual(new Set(["countertop.hostedSink.basin"]));
  });

  it("refuses the colours of a hosted vessel with the reason", () => {
    store.dispatch(setCountertopStyle("vessel"));
    store.dispatch(setActiveBasinStyle("Vessel_Blade11"));
    expect(enabledValues("vessel-color")?.length).toBeGreaterThan(0);

    setCountertopRuntimeState(carried("fits", true));
    expect(fieldOf("vessel-color")?.visible).toBe(true);
    expect(reasonsOf("vessel-color")).toEqual(new Set(["countertop.hostedSink.vesselColor"]));
  });

  // As a lift the UI did not commit leaves it: the Sink Base still stands and takes a new basin.
  it("leaves them to the matrix while the top carries a basin it does not host", () => {
    setCountertopRuntimeState(carried("none", false));

    expect(hostedRefusals("countertop-style")).toEqual([]);
    expect(hostedRefusals("basin-style")).toEqual([]);
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

// Table 593 as uploaded on 2026-10-30 names its 3-1/8" VA023 row, the GB row SSTMT, Technomat: the GB material
// configurator 12 gives Matte White 8cm. The recorded fixture still names the row Solid Surface.
const tricotWithTechnomat = {
  profile: parsedTricotProfile.profile,
  ready: readyCollectionOf(
    "tricot",
    tricotManifest,
    tricotUi,
    {
      ...datatable593,
      rows: datatable593.rows.map((row) => (row.basin_style === "VA023" ? { ...row, material: "Technomat" } : row)),
    },
    tricotConfiguratorGroups,
  ),
};

describe("Tricot Solid Surface tops follow their GB material once table 593 names Technomat", () => {
  const { fieldOf, shownValues, enabledValues } = fieldsOf(tricotWithTechnomat);
  const colorOf = (value: string) => fieldOf("countertop-color")?.options.find((option) => option.value === value);

  beforeEach(() => {
    startWith(tricotWithTechnomat);
    store.dispatch(setCountertopStyle("integrated"));
  });

  it('gives Matte White 8cm (Technomat) the 3-1/8" top and VA023 only', () => {
    store.dispatch(setActiveCountertopColor("Matte White 8cm"));

    expect(enabledValues("thickness")).toEqual(["3.125"]);
    expect(shownValues("basin-style")).toEqual(["VA023"]);
  });

  it('keeps Matte White (Technolite) to the 1/2" and 4-3/4" tops and the LB basins', () => {
    store.dispatch(setActiveCountertopColor("Matte White"));

    expect(enabledValues("thickness")).toEqual(["0.5", "4.75"]);
    expect(shownValues("basin-style")).toEqual(["LB440", "LB175", "LB575", "LB856"]);
  });

  it('gives a vessel Matte White 8cm top the 3-1/8" thickness too', () => {
    store.dispatch(setCountertopStyle("vessel"));
    store.dispatch(setActiveCountertopColor("Matte White 8cm"));

    expect(enabledValues("thickness")).toEqual(["3.125"]);
  });

  it("refuses Matte White 8cm on a Sink Base under 80 cm with its reason, and keeps Matte White", () => {
    store.dispatch(setSelectedDimensions({ width: 60, depth: 52 }));

    expect(colorOf("Matte White 8cm")).toMatchObject({
      enabled: false,
      reasonCode: expect.stringMatching(/^countertop\./),
    });
    expect(colorOf("Matte White")?.enabled).toBe(true);
  });
});

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
    [
      "Vessel_Blade11",
      ["Antracite Matte OCF", "Cemento Matte OCD", "Cenere Matte OCE", "Gloss White OCB", "Matte White OCC"],
    ],
    ["Vessel_UrbanModo", ["Matte Black T1D", "Matte White T1C"]],
    ["Vessel_UrbanMorris", ["Bianco Gloss TAL", "Bianco Matte TAM"]],
  ])("enables the colours %s takes", (vessel, colors) => {
    store.dispatch(setActiveBasinStyle(vessel));

    expect(enabledValues("vessel-color")).toEqual(colors);
  });

  it("enables the 54 Tekorlux colours for Vessel_Aquarius", () => {
    store.dispatch(setActiveBasinStyle("Vessel_Aquarius"));

    expect(enabledValues("vessel-color")).toHaveLength(54);
    expect(enabledValues("vessel-color")).toEqual(
      expect.arrayContaining(["Agata BD MT", "Bianco Gloss TAL", "Bianco Matte TAM"]),
    );
  });
});
