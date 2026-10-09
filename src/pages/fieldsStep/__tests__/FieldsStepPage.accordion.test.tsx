// @vitest-environment jsdom

import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { store } from "@/app/store";
import { parseProductProfile } from "@/entities/collection/lib/parseProductProfile";
import fixtureProfileDocument from "@/entities/collection/__tests__/fixtures/collections/fixture-ui/product-profile.json";
import fixtureUi from "@/entities/collection/__tests__/fixtures/collections/fixture-ui/ui.json";
import { renderWithFixtureCollection } from "@/entities/collection/__tests__/fixtures/renderWithFixtureCollection";
import { replaceCollectionData, reset } from "@/entities/product/model/store/slice";

import { FieldsStepPage } from "../FieldsStepPage";

/**
 * The in-scene menu sends the user to the section that edits a value, e.g. `?accordion=thickness`
 * on the countertop step. A fields step opens that section instead of its default one.
 */

vi.mock("@/shared/ui/Accordion/useCompactAccordionViewport");

/** The fixture step with a second section after its default-open one, labelled apart from the options. */
const uiWithTwoSections = {
  ...fixtureUi,
  steps: {
    ...fixtureUi.steps,
    "fixture-finish": { ...fixtureUi.steps["fixture-finish"], sectionIds: ["test-finish", "second-finish"] },
  },
  sections: {
    ...fixtureUi.sections,
    "test-finish": { ...fixtureUi.sections["test-finish"], label: "First Section" },
    "second-finish": { ...fixtureUi.sections["test-finish"], label: "Second Section", defaultOpen: false },
  },
};

const fixtureProfile = (() => {
  const result = parseProductProfile(fixtureProfileDocument);
  if (!result.ok) throw new Error("fixture-ui profile failed validation");

  return result.profile;
})();

const isExpanded = (sectionLabel: string) =>
  screen.getByRole("button", { name: sectionLabel }).getAttribute("aria-expanded") === "true";

afterEach(cleanup);

beforeEach(() => {
  store.dispatch(reset());
  store.dispatch(replaceCollectionData({ profile: fixtureProfile, cabinetCatalog: null }));
});

describe("a fields step opens the section the URL asks for", () => {
  it("opens the default section without ?accordion", () => {
    renderWithFixtureCollection(<FieldsStepPage stepId="fixture-finish" />, {
      collectionId: "fixture-ui",
      uiDocument: uiWithTwoSections,
      initialPath: "/fixture/finish?collectionId=fixture-ui",
    });

    expect(isExpanded("First Section")).toBe(true);
    expect(isExpanded("Second Section")).toBe(false);
  });

  it("opens the requested section", () => {
    renderWithFixtureCollection(<FieldsStepPage stepId="fixture-finish" />, {
      collectionId: "fixture-ui",
      uiDocument: uiWithTwoSections,
      initialPath: "/fixture/finish?collectionId=fixture-ui&accordion=second-finish",
    });

    expect(isExpanded("Second Section")).toBe(true);
    expect(isExpanded("First Section")).toBe(false);
  });

  it("keeps the default section for a section the step does not have", () => {
    renderWithFixtureCollection(<FieldsStepPage stepId="fixture-finish" />, {
      collectionId: "fixture-ui",
      uiDocument: uiWithTwoSections,
      initialPath: "/fixture/finish?collectionId=fixture-ui&accordion=counter-top-color",
    });

    expect(isExpanded("First Section")).toBe(true);
  });
});
