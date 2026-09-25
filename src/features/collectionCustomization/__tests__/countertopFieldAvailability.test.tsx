// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it } from "vitest";

import { store } from "@/app/store";
import { ReadyCollectionContext } from "@/entities/collection";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";
import configurator9 from "@/entities/collection/__tests__/fixtures/remote/configurator-9.json";
import datatable577 from "@/entities/collection/__tests__/fixtures/remote/datatable-577.json";
import { makoProfile } from "@/entities/collection/__tests__/makoProfileFixture";
import { configuratorSchema, countertopDatatableSchema } from "@/entities/collection/model/schemas";
import { resetConfiguration } from "@/entities/configuration";
import {
  reset,
  setActiveCountertopColor,
  setActiveProfile,
  setCountertopStyle,
  setSelectedDimensions,
} from "@/entities/product/model/store/slice";
import { parseCountertopMatrix } from "@/features/configurator-rule-core/countertop";
import makoManifest from "../../../../public/collections/mako/manifest.json";
import makoUi from "../../../../public/collections/mako/ui.json";

import { useCustomizationStepSections } from "../lib/useCustomizationSectionState";

/**
 * Mako renders its countertop on the fields step, so the countertop matrix (table 577) reaches
 * the style and basin fields only through their availabilityRef.
 */

const collection = buildReadyCollection("mako", makoManifest, makoUi);
const configuratorGroups = configuratorSchema.parse(configurator9).availableOptions;

const readyCollection = {
  ...collection,
  catalog: {
    ...collection.catalog,
    configurator: {
      groups: configuratorGroups,
      groupsByName: Object.fromEntries(configuratorGroups.map((group) => [group.proxyName, group])),
    },
    countertops: parseCountertopMatrix(countertopDatatableSchema.parse(datatable577)),
  },
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <ReadyCollectionContext.Provider value={readyCollection}>
    <Provider store={store}>{children}</Provider>
  </ReadyCollectionContext.Provider>
);

const fieldOf = (sectionId: string) =>
  renderHook(() => useCustomizationStepSections("countertop"), { wrapper }).result.current.find(
    (section) => section.sectionId === sectionId,
  )?.fields[0]?.field;

const enabledValues = (sectionId: string) =>
  fieldOf(sectionId)
    ?.options.filter(({ enabled }) => enabled)
    .map(({ value }) => value);

describe("Mako countertop fields follow the countertop matrix", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(setActiveProfile(makoProfile));
    store.dispatch(setSelectedDimensions({ width: 80, depth: 52 }));
  });

  it("offers the integrated basins of the chosen material only", () => {
    store.dispatch(setCountertopStyle("integrated"));

    store.dispatch(setActiveCountertopColor("CALACATTA 259"));
    expect(enabledValues("basin-style")).toEqual(["VA024"]);

    store.dispatch(setActiveCountertopColor("CALACATTA BLACK 338"));
    expect(enabledValues("basin-style")).toEqual(["LV890", "LV892"]);

    store.dispatch(setActiveCountertopColor("Matte White"));
    expect(enabledValues("basin-style")).toEqual(["LB440", "LB175", "LB575", "LB856"]);
  });

  it("offers the vessels, not the integrated basins, for the vessel style", () => {
    store.dispatch(setActiveCountertopColor("CALACATTA 259"));
    store.dispatch(setCountertopStyle("vessel"));

    expect(enabledValues("basin-style")).toEqual(["Iris", "Frame", "Plaza"]);
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
