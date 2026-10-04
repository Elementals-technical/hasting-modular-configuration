// @vitest-environment jsdom

import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { renderWithFixtureCollection } from "@/entities/collection/__tests__/fixtures/renderWithFixtureCollection";
import { fixtureUiWithSummary } from "@/entities/collection/__tests__/fixtures/fixtureUiWithSummary";

import { BottomStickyBar } from "../ui/BottomStickyBar";

afterEach(cleanup);

describe("BottomStickyBar against a non-USH schema", () => {
  it("labels Next with the schema's own next step and hides Back on the first step", () => {
    renderWithFixtureCollection(<BottomStickyBar />, {
      collectionId: "fixture-ui",
      initialPath: "/fixture/models?collectionId=fixture-ui",
    });

    expect(screen.getByText("Next: Test Finish")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Back to/ })).toBeNull();
  });

  it("navigates to the schema's next step path when Next is clicked", async () => {
    renderWithFixtureCollection(<BottomStickyBar />, {
      collectionId: "fixture-ui",
      initialPath: "/fixture/models?collectionId=fixture-ui",
    });

    fireEvent.click(screen.getByText("Next: Test Finish"));

    await waitFor(() => expect(screen.getByRole("button", { name: "Back to Fixture Models" })).toBeTruthy());
  });

  it("navigates to the schema's previous step path when Back is clicked", async () => {
    renderWithFixtureCollection(<BottomStickyBar />, {
      collectionId: "fixture-ui",
      initialPath: "/fixture/finish?collectionId=fixture-ui",
    });

    fireEvent.click(screen.getByRole("button", { name: "Back to Fixture Models" }));

    await waitFor(() => expect(screen.getByText("Next: Test Finish")).toBeTruthy());
  });

  it("shows neither How to Buy nor Quote on a last step that is not a summary", () => {
    renderWithFixtureCollection(<BottomStickyBar />, {
      collectionId: "fixture-ui",
      initialPath: "/fixture/finish?collectionId=fixture-ui",
    });

    expect(screen.queryByText("How to Buy")).toBeNull();
    expect(screen.queryByRole("link", { name: "Quote" })).toBeNull();
  });

  it("shows How to Buy on the summary step and Quote once the flow declares a summary", () => {
    renderWithFixtureCollection(<BottomStickyBar />, {
      collectionId: "fixture-ui",
      initialPath: "/fixture/summary?collectionId=fixture-ui",
      uiDocument: fixtureUiWithSummary,
    });

    expect(screen.getAllByText("How to Buy").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Quote" })).toBeTruthy();
  });

  it("resolves the flow from the path instead of a prop", () => {
    renderWithFixtureCollection(<BottomStickyBar />, {
      collectionId: "fixture-ui",
      initialPath: "/fixture/builder?collectionId=fixture-ui",
    });

    expect(screen.queryByText(/Next:/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Back to/ })).toBeNull();
  });
});
