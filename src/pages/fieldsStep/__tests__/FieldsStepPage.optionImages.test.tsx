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
 * A collection declares the pictures of its own options in `ui.json`; the loader turns the
 * references into URLs and the options grid shows them. No code knows the option values.
 */

vi.mock("@/shared/ui/Accordion/ConfiguratorAccordion", () => ({
  ConfiguratorAccordionGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ConfiguratorAccordionItem: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <section aria-label={title}>{children}</section>
  ),
}));

const FIXTURE_IMAGE_URL = "https://app.test/collections/fixture-ui/images/fixture-ui.svg";

/** The fixture's one section, shown as a grid so its options carry pictures. */
const uiWithOptionImages = {
  ...fixtureUi,
  optionImages: { TestGrooveFinish: { "test-finish": "images/fixture-ui.svg" } },
  sections: {
    ...fixtureUi.sections,
    "test-finish": {
      ...fixtureUi.sections["test-finish"],
      fields: [{ attributeId: "TestGrooveFinish", control: "options-grid" }],
    },
  },
};

const fixtureProfile = (() => {
  const result = parseProductProfile(fixtureProfileDocument);
  if (!result.ok) throw new Error("fixture-ui profile failed validation");

  return result.profile;
})();

afterEach(cleanup);

beforeEach(() => {
  store.dispatch(reset());
  store.dispatch(replaceCollectionData({ profile: fixtureProfile, cabinetCatalog: null }));
});

describe("option pictures declared by the collection", () => {
  it("shows an option's picture at the URL resolved inside the collection folder", () => {
    renderWithFixtureCollection(<FieldsStepPage stepId="fixture-finish" />, {
      collectionId: "fixture-ui",
      uiDocument: uiWithOptionImages,
    });

    expect(screen.getByAltText("color image").getAttribute("src")).toBe(FIXTURE_IMAGE_URL);
  });

  it("still lists an option the collection declares no picture for", () => {
    renderWithFixtureCollection(<FieldsStepPage stepId="fixture-finish" />, {
      collectionId: "fixture-ui",
      uiDocument: { ...uiWithOptionImages, optionImages: undefined },
    });

    // The option is still listed, with the grid's generic placeholder instead of a picture.
    expect(screen.getByText("Test Finish")).not.toBeNull();
    expect(screen.getByAltText("color image").getAttribute("src")).not.toBe(FIXTURE_IMAGE_URL);
  });
});
