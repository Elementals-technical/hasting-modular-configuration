// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it } from "vitest";

import { store } from "@/app/store";
import { ReadyCollectionContext } from "@/entities/collection";
import { configuratorColorGroups } from "@/entities/collection/__tests__/fixtures/configuratorColorGroups";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { resetConfiguration } from "@/entities/configuration";
import {
  reset,
  setActiveProfile,
  setCountertopStyle,
  setSelectedProductConfig,
  setTowelBarOption,
} from "@/entities/product/model/store/slice";
import { readyCollectionFixture } from "@/features/configurationCommands/__tests__/readyCollectionFixture";

import { useCustomizationStepSections } from "../lib/useCustomizationSectionState";

const readyCollection = {
  ...readyCollectionFixture,
  catalog: { ...readyCollectionFixture.catalog, configurator: configuratorColorGroups },
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <ReadyCollectionContext.Provider value={readyCollection}>
    <Provider store={store}>{children}</Provider>
  </ReadyCollectionContext.Provider>
);

const renderStep = (stepId: string) =>
  renderHook(() => useCustomizationStepSections(stepId), { wrapper }).result.current;

const renderSection = (stepId: string, sectionId: string) =>
  renderStep(stepId).find((section) => section.sectionId === sectionId)?.fields ?? [];

describe("field availability from the modules that already compute it", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(setActiveProfile(ushProfile));
  });

  it("shows the groove colour only for a handle whose profile option supports it", () => {
    store.dispatch(setSelectedProductConfig({ Handle: "handle_pto" }));
    expect(renderSection("cabinet-colors", "groove-color")[0]?.field.visible).toBe(false);

    store.dispatch(setSelectedProductConfig({ Handle: "handle_urban_topcut" }));
    expect(renderSection("cabinet-colors", "groove-color")[0]?.field.visible).toBe(true);
  });

  it("shows the towel bar colour only while a towel bar is chosen", () => {
    store.dispatch(setTowelBarOption("None"));
    expect(renderSection("accessories", "towel-bar")[1]?.field.visible).toBe(false);

    store.dispatch(setTowelBarOption("Left"));
    expect(renderSection("accessories", "towel-bar")[1]?.field.visible).toBe(true);
  });

  it("shows the vessel colour only for the vessel countertop style", () => {
    store.dispatch(setCountertopStyle("Integrated"));
    expect(renderSection("countertop", "vessel-color")[0]?.field.visible).toBe(false);

    store.dispatch(setCountertopStyle("Vessel"));
    expect(renderSection("countertop", "vessel-color")[0]?.field.visible).toBe(true);
  });

  it("resolves a step's sections in the order ui.json declares them", () => {
    const sections = renderStep("cabinet-colors");

    expect(sections.map((section) => section.sectionId)).toEqual([
      "cabinet-color-custom",
      "groove-color",
      "drawer-panel-custom",
      "grain-direction-custom",
    ]);
    expect(sections[0]?.fields[0]?.field.options.map((option) => option.value)).toEqual([
      "Old Cabinet Color",
      "New Cabinet Color",
    ]);
  });
});
