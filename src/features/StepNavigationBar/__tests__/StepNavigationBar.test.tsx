// @vitest-environment jsdom

import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { useLocation } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { renderWithFixtureCollection } from "@/entities/collection/__tests__/fixtures/renderWithFixtureCollection";
import { fixtureUiWithSummary } from "@/entities/collection/__tests__/fixtures/fixtureUiWithSummary";

import { StepNavigationBar } from "../StepNavigationBar";
import s from "../StepNavigationBar.module.scss";

afterEach(cleanup);

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
};

describe("StepNavigationBar against a non-USH schema", () => {
  it("shows the given title while a next step exists", () => {
    renderWithFixtureCollection(<StepNavigationBar title="Fixture Models" />, {
      collectionId: "fixture-ui",
      initialPath: "/fixture/models?collectionId=fixture-ui",
    });

    expect(screen.getByText("Fixture Models")).toBeTruthy();
  });

  it("keeps the title on a last step that is not a summary", () => {
    renderWithFixtureCollection(<StepNavigationBar title="Test Finish" />, {
      collectionId: "fixture-ui",
      initialPath: "/fixture/finish?collectionId=fixture-ui",
    });

    expect(screen.getByText("Test Finish")).toBeTruthy();
    expect(screen.queryByText("Your Configuration")).toBeNull();
  });

  it("shows Your Configuration only on the summary step", () => {
    renderWithFixtureCollection(<StepNavigationBar title="Fixture Summary" />, {
      collectionId: "fixture-ui",
      initialPath: "/fixture/summary?collectionId=fixture-ui",
      uiDocument: fixtureUiWithSummary,
    });

    expect(screen.getByText("Your Configuration")).toBeTruthy();
  });

  it("navigates forward to the schema's next step path", async () => {
    const { container } = renderWithFixtureCollection(
      <>
        <StepNavigationBar title="Fixture Models" />
        <LocationProbe />
      </>,
      { collectionId: "fixture-ui", initialPath: "/fixture/models?collectionId=fixture-ui" },
    );

    fireEvent.click(container.querySelector(`.${s.stepForward}`)!);

    await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/fixture/finish"));
  });

  it("navigates back to the schema's previous step path", async () => {
    const { container } = renderWithFixtureCollection(
      <>
        <StepNavigationBar title="Test Finish" />
        <LocationProbe />
      </>,
      { collectionId: "fixture-ui", initialPath: "/fixture/finish?collectionId=fixture-ui" },
    );

    fireEvent.click(container.querySelector(`.${s.stepBack}`)!);

    await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/fixture/models"));
  });

  it("navigates from a nested detail route back to its parent step", async () => {
    const { container } = renderWithFixtureCollection(
      <>
        <StepNavigationBar title="Fixture Models" />
        <LocationProbe />
      </>,
      { collectionId: "fixture-ui", initialPath: "/fixture/models/901?collectionId=fixture-ui" },
    );

    fireEvent.click(container.querySelector(`.${s.stepBack}`)!);

    await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/fixture/models"));
  });
});
