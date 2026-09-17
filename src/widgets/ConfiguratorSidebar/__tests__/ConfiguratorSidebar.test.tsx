// @vitest-environment jsdom

import { cleanup, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { renderWithFixtureCollection } from "@/entities/collection/__tests__/fixtures/renderWithFixtureCollection";
import fixtureUiUi from "@/entities/collection/__tests__/fixtures/collections/fixture-ui/ui.json";

import { ConfiguratorSidebar } from "../ui/ConfiguratorSidebar";

afterEach(cleanup);

describe("ConfiguratorSidebar header against a non-USH schema", () => {
  it("derives the step header from the schema's own step label, not a hardcoded string", async () => {
    renderWithFixtureCollection(<ConfiguratorSidebar flow="prebuilt">content</ConfiguratorSidebar>, {
      collectionId: "fixture-ui",
      initialPath: "/fixture/models?collectionId=fixture-ui",
    });

    await waitFor(() => expect(screen.getByText("Select Fixture Models")).toBeTruthy());
  });

  it("omits the default Select prefix when the schema step declares headerPrefix: null", async () => {
    const mutatedUi = {
      ...fixtureUiUi,
      steps: {
        ...fixtureUiUi.steps,
        "fixture-model": { ...fixtureUiUi.steps["fixture-model"], headerPrefix: null },
      },
    };

    renderWithFixtureCollection(<ConfiguratorSidebar flow="prebuilt">content</ConfiguratorSidebar>, {
      collectionId: "fixture-ui",
      initialPath: "/fixture/models?collectionId=fixture-ui",
      uiDocument: mutatedUi,
    });

    await waitFor(() => expect(screen.getByText("Fixture Models")).toBeTruthy());
    expect(screen.queryByText("Select Fixture Models")).toBeNull();
  });
});
