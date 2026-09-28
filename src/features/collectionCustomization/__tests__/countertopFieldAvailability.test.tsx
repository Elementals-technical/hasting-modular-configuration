// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it } from "vitest";

import { store } from "@/app/store";
import { ReadyCollectionContext, type ProductProfile } from "@/entities/collection";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";
import configurator4 from "@/entities/collection/__tests__/fixtures/remote/configurator-4.json";
import configurator9 from "@/entities/collection/__tests__/fixtures/remote/configurator-9.json";
import datatable438 from "@/entities/collection/__tests__/fixtures/remote/datatable-438.json";
import datatable577 from "@/entities/collection/__tests__/fixtures/remote/datatable-577.json";
import datatable578 from "@/entities/collection/__tests__/fixtures/remote/datatable-578.json";
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
import { parseCountertopMatrix } from "@/features/configurator-rule-core/countertop";
import classManifest from "../../../../public/collections/class/manifest.json";
import classProfileDocument from "../../../../public/collections/class/product-profile.json";
import classUi from "../../../../public/collections/class/ui.json";
import makoManifest from "../../../../public/collections/mako/manifest.json";
import makoUi from "../../../../public/collections/mako/ui.json";
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

// Configurator 4 as Urban Low Height loads it, with one live Tekorlux colour: its material is
// "Lacquered MT" (LACM), which the recorded fixture leaves out.
const ulhConfiguratorGroups = configuratorSchema.parse(configurator4).availableOptions.map((group) =>
  group.proxyName === "Countertop Color"
    ? {
        ...group,
        options: [
          ...group.options,
          {
            id: 290,
            name: "Tekorlux",
            resource: null,
            paramString: "",
            playcanvasString: "",
            variants: [
              {
                id: 3094,
                name: "Agata BD MT",
                image: null,
                enabled: true,
                description: "",
                metadata: {
                  sku: "SSTKR",
                  codeColor: "BD MT",
                  Material: "Lacquered MT",
                  label: "Agata BD MT",
                  value: "Agata BD MT",
                },
              },
            ],
          },
        ],
      }
    : group,
);

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
    store.dispatch(setCountertopStyle("vessel"));
    expect(fieldOf("basin-style")?.value).toBe("None");

    store.dispatch(setActiveBasinStyle("Iris"));
    expect(fieldOf("basin-style")?.value).toBe("Iris");

    // An integrated countertop without a basin has nothing chosen.
    store.dispatch(setActiveBasinStyle(""));
    store.dispatch(setCountertopStyle("integrated"));
    expect(fieldOf("basin-style")?.value).toBe("");
  });

  it("shows the vessel colour for the vessel style only, in the cabinet palette", () => {
    store.dispatch(setCountertopStyle("integrated"));
    expect(fieldOf("vessel-color")?.visible).toBe(false);

    store.dispatch(setCountertopStyle("vessel"));
    const vesselColors = shownValues("vessel-color");

    expect(fieldOf("vessel-color")?.visible).toBe(true);
    expect(vesselColors?.length).toBeGreaterThan(0);
    expect(vesselColors).toEqual(fieldOf("cabinet-color", "color")?.options.map(({ value }) => value));
  });
});
