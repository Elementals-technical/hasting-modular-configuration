// @vitest-environment jsdom

import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { useLocation } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { renderWithFixtureCollection } from "@/entities/collection/__tests__/fixtures/renderWithFixtureCollection";

import { StepNavigationBar } from "../StepNavigationBar";
import s from "../StepNavigationBar.module.scss";

afterEach(cleanup);

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
};

describe("StepNavigationBar against a non-USH schema", () => {
  it("shows the given title while a next step exists", () => {
    renderWithFixtureCollection(<StepNavigationBar title="Fixture Models" flow="prebuilt" />, {
      collectionId: "fixture-ui",
      initialPath: "/fixture/models?collectionId=fixture-ui",
    });

    expect(screen.getByText("Fixture Models")).toBeTruthy();
  });

  it("falls back to Your Configuration once the schema's flow has no next step", () => {
    renderWithFixtureCollection(<StepNavigationBar title="Test Finish" flow="prebuilt" />, {
      collectionId: "fixture-ui",
      initialPath: "/fixture/finish?collectionId=fixture-ui",
    });

    expect(screen.getByText("Your Configuration")).toBeTruthy();
  });

  it("navigates forward to the schema's next step path", async () => {
    const { container } = renderWithFixtureCollection(
      <>
        <StepNavigationBar title="Fixture Models" flow="prebuilt" />
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
        <StepNavigationBar title="Test Finish" flow="prebuilt" />
        <LocationProbe />
      </>,
      { collectionId: "fixture-ui", initialPath: "/fixture/finish?collectionId=fixture-ui" },
    );

    fireEvent.click(container.querySelector(`.${s.stepBack}`)!);

    await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/fixture/models"));
  });
});
