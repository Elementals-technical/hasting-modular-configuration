import { describe, expect, it } from "vitest";

import fixtureUiUi from "@/entities/collection/__tests__/fixtures/collections/fixture-ui/ui.json";
import { readCustomizationSchema } from "@/entities/collection/__tests__/fixtures/readCustomizationSchema";

import ushUi from "../../../../public/collections/urban-standard-height/ui.json";
import { filterSupportedTutorialSteps } from "../lib/filterSupportedTutorialSteps";
import { INTERACTIVE_CONFIGURATOR_TUTORIAL_STEPS } from "../model/steps";

const stepIds = (steps: readonly { id: string }[]) => steps.map((step) => step.id);

describe("filterSupportedTutorialSteps", () => {
  it("keeps every USH tutorial step", () => {
    expect(
      stepIds(filterSupportedTutorialSteps(INTERACTIVE_CONFIGURATOR_TUTORIAL_STEPS, readCustomizationSchema(ushUi))),
    ).toEqual(stepIds(INTERACTIVE_CONFIGURATOR_TUTORIAL_STEPS));
  });

  it("drops every step whose route the collection does not declare", () => {
    const kept = filterSupportedTutorialSteps(
      INTERACTIVE_CONFIGURATOR_TUTORIAL_STEPS,
      readCustomizationSchema(fixtureUiUi),
    );

    expect(stepIds(kept)).toEqual(["intro"]);
  });

  it("drops only the custom steps when the custom flow loses its cabinet builder", () => {
    const withoutBuilder = {
      ...ushUi,
      flows: {
        ...ushUi.flows,
        custom: { entryStepId: "summary", steps: [{ stepId: "summary", path: "/custom/summary" }] },
      },
    };

    const kept = filterSupportedTutorialSteps(
      INTERACTIVE_CONFIGURATOR_TUTORIAL_STEPS,
      readCustomizationSchema(withoutBuilder),
    );

    expect(stepIds(kept)).toEqual(["intro", "getting-started", "prebuilt-mode", "prebuilt-details", "custom-mode"]);
  });

  it("keeps every step when the collection has no ui schema", () => {
    expect(filterSupportedTutorialSteps(INTERACTIVE_CONFIGURATOR_TUTORIAL_STEPS, null)).toHaveLength(
      INTERACTIVE_CONFIGURATOR_TUTORIAL_STEPS.length,
    );
  });
});
