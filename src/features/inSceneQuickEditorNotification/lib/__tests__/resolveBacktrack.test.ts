import { describe, expect, it } from "vitest";

import fixtureUiUi from "@/entities/collection/__tests__/fixtures/collections/fixture-ui/ui.json";
import { readCustomizationSchema } from "@/entities/collection/__tests__/fixtures/readCustomizationSchema";

import { resolveInSceneQuickEditorNotificationBacktrack } from "../resolveBacktrack";

describe("resolveInSceneQuickEditorNotificationBacktrack against a non-USH schema", () => {
  it("reads the flow's own step order from the schema, not a hardcoded map", () => {
    const schema = readCustomizationSchema(fixtureUiUi);

    const forward = resolveInSceneQuickEditorNotificationBacktrack({
      flow: "prebuilt",
      previousPath: "/fixture/models",
      currentPath: "/fixture/finish",
      schema,
    });
    expect(forward.transition).toBe("forward");

    const backtrack = resolveInSceneQuickEditorNotificationBacktrack({
      flow: "prebuilt",
      previousPath: "/fixture/finish",
      currentPath: "/fixture/models",
      schema,
    });
    expect(backtrack.transition).toBe("backtrack");
  });

  it("flips forward/backtrack when the schema's step order is edited", () => {
    const reorderedUi = {
      ...fixtureUiUi,
      flows: {
        ...fixtureUiUi.flows,
        prebuilt: {
          entryStepId: "fixture-finish",
          steps: [
            { stepId: "fixture-finish", path: "/fixture/finish" },
            { stepId: "fixture-model", path: "/fixture/models" },
          ],
        },
      },
    };
    const schema = readCustomizationSchema(reorderedUi);

    const result = resolveInSceneQuickEditorNotificationBacktrack({
      flow: "prebuilt",
      previousPath: "/fixture/models",
      currentPath: "/fixture/finish",
      schema,
    });

    expect(result.transition).toBe("backtrack");
  });

  it("treats a path outside the flow's declared steps as outside-flow", () => {
    const schema = readCustomizationSchema(fixtureUiUi);

    const result = resolveInSceneQuickEditorNotificationBacktrack({
      flow: "prebuilt",
      previousPath: "/fixture/models",
      currentPath: "/somewhere/else",
      schema,
    });

    expect(result.transition).toBe("outside-flow");
    expect(result.currentStep).toBeNull();
  });
});
