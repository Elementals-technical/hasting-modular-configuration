// @vitest-environment jsdom

import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { renderWithFixtureCollection } from "@/entities/collection/__tests__/fixtures/renderWithFixtureCollection";
import fixtureRulesUi from "@/entities/collection/__tests__/fixtures/collections/fixture-rules/ui.json";

import { NavigationProbe } from "./testUtils/NavigationProbe";
import { readNavigation } from "./testUtils/readNavigation";

afterEach(cleanup);

describe("useCollectionNavigation against a non-USH schema", () => {
  it("builds the prebuilt flow's own steps, not USH's", () => {
    renderWithFixtureCollection(<NavigationProbe flow="prebuilt" />, { collectionId: "fixture-ui" });

    expect(readNavigation().steps).toEqual([
      { stepId: "fixture-model", label: "Fixture Models", path: "/fixture/models" },
      { stepId: "fixture-finish", label: "Test Finish", path: "/fixture/finish" },
    ]);
  });

  it("builds the custom flow's own single-step list", () => {
    renderWithFixtureCollection(<NavigationProbe flow="custom" />, { collectionId: "fixture-ui" });

    expect(readNavigation().steps).toEqual([{ stepId: "fixture-builder", label: "Fixture Builder", path: "/fixture/builder" }]);
  });

  it("matches the current step from the URL and computes prev/next", () => {
    renderWithFixtureCollection(<NavigationProbe flow="prebuilt" />, {
      collectionId: "fixture-ui",
      initialPath: "/fixture/finish?collectionId=fixture-ui",
    });

    const navigation = readNavigation();
    expect(navigation.currentStepId).toBe("fixture-finish");
    expect(navigation.previousStepId).toBe("fixture-model");
    expect(navigation.nextStepId).toBeNull();
  });

  it("recomputes steps entirely when the schema's own flow is edited, not just switched between fixtures", () => {
    const mutatedUi = {
      ...fixtureRulesUi,
      flows: {
        ...fixtureRulesUi.flows,
        prebuilt: {
          entryStepId: "finish",
          steps: [
            { stepId: "extra-step", path: "/prebuilt/extra" },
            { stepId: "finish", path: "/prebuilt/finish" },
          ],
        },
      },
      steps: {
        ...fixtureRulesUi.steps,
        "extra-step": { label: "Extra Step", kind: "fields", sectionIds: ["handle"] },
      },
    };

    renderWithFixtureCollection(<NavigationProbe flow="prebuilt" />, {
      collectionId: "fixture-rules",
      initialPath: "/prebuilt/finish?collectionId=fixture-rules",
      uiDocument: mutatedUi,
    });

    const navigation = readNavigation();
    expect(navigation.steps).toEqual([
      { stepId: "extra-step", label: "Extra Step", path: "/prebuilt/extra" },
      { stepId: "finish", label: "Finish", path: "/prebuilt/finish" },
    ]);
    expect(navigation.currentStepId).toBe("finish");
    expect(navigation.previousStepId).toBe("extra-step");
  });

  it("matches a nested detail route to its parent step", () => {
    renderWithFixtureCollection(<NavigationProbe flow="prebuilt" />, {
      collectionId: "fixture-ui",
      initialPath: "/fixture/models/12?collectionId=fixture-ui",
    });

    expect(readNavigation().currentStepId).toBe("fixture-model");
  });

  it("drops a step removed from the flow's step list and closes the prev/next gap around it", () => {
    const mutatedUi = {
      ...fixtureRulesUi,
      flows: {
        ...fixtureRulesUi.flows,
        prebuilt: {
          entryStepId: "finish",
          steps: [{ stepId: "finish", path: "/prebuilt/finish" }],
        },
      },
    };

    renderWithFixtureCollection(<NavigationProbe flow="prebuilt" />, {
      collectionId: "fixture-rules",
      initialPath: "/prebuilt/finish?collectionId=fixture-rules",
      uiDocument: mutatedUi,
    });

    const navigation = readNavigation();
    expect(navigation.steps).toEqual([{ stepId: "finish", label: "Finish", path: "/prebuilt/finish" }]);
    expect(navigation.currentStepId).toBe("finish");
    expect(navigation.previousStepId).toBeNull();
    expect(navigation.nextStepId).toBeNull();
  });
});
