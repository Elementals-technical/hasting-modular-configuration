import fixtureUiUi from "./collections/fixture-ui/ui.json";

export const fixtureUiWithSummary = {
  ...fixtureUiUi,
  flows: {
    ...fixtureUiUi.flows,
    prebuilt: {
      ...fixtureUiUi.flows.prebuilt,
      steps: [...fixtureUiUi.flows.prebuilt.steps, { stepId: "fixture-summary", path: "/fixture/summary" }],
    },
  },
  steps: { ...fixtureUiUi.steps, "fixture-summary": { label: "Fixture Summary", kind: "summary" } },
};
