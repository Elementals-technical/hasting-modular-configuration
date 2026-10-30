// @vitest-environment jsdom

import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { renderWithFixtureCollection } from "@/entities/collection/__tests__/fixtures/renderWithFixtureCollection";
import fixtureUiUi from "@/entities/collection/__tests__/fixtures/collections/fixture-ui/ui.json";

import { FieldControl } from "../ui/FieldControl";
import { useCustomizationStepSections } from "../lib/useCustomizationSectionState";

const StepProbe = ({ stepId }: { stepId: string }) => {
  const fields = useCustomizationStepSections(stepId).flatMap((section) => section.fields);

  return (
    <div data-testid="section">
      {fields.map(({ definition, field }) => (
        <div key={definition.attributeId} data-testid={`field-${definition.attributeId}`}>
          <FieldControl control={definition.control} field={field} onChange={() => {}} />
        </div>
      ))}
    </div>
  );
};

afterEach(cleanup);

describe("a fixture-only field renders through the generic section pipeline", () => {
  it("resolves fixture-ui's TestGrooveFinish swatches field with no collectionId-specific component", () => {
    renderWithFixtureCollection(<StepProbe stepId="fixture-finish" />, { collectionId: "fixture-ui" });

    expect(screen.getByTestId("field-TestGrooveFinish")).toBeTruthy();
  });

  it("returns no fields for a step the collection's schema doesn't declare", () => {
    renderWithFixtureCollection(<StepProbe stepId="does-not-exist" />, { collectionId: "fixture-ui" });

    expect(screen.getByTestId("section").children).toHaveLength(0);
  });

  it("adds a field to the rendered section when the schema's section composition gains one", () => {
    const mutatedUi = {
      ...fixtureUiUi,
      sections: {
        ...fixtureUiUi.sections,
        "test-finish": {
          ...fixtureUiUi.sections["test-finish"],
          fields: [
            ...fixtureUiUi.sections["test-finish"].fields,
            { attributeId: "TestSecondField", control: "swatches", optionsRef: "TestSecondField" },
          ],
        },
      },
    };

    renderWithFixtureCollection(<StepProbe stepId="fixture-finish" />, {
      collectionId: "fixture-ui",
      uiDocument: mutatedUi,
    });

    expect(screen.getByTestId("field-TestGrooveFinish")).toBeTruthy();
    expect(screen.getByTestId("field-TestSecondField")).toBeTruthy();
  });

  it("drops a field from the rendered section when the schema's section composition loses it", () => {
    const mutatedUi = {
      ...fixtureUiUi,
      sections: {
        ...fixtureUiUi.sections,
        "test-finish": { ...fixtureUiUi.sections["test-finish"], fields: [] },
      },
    };

    renderWithFixtureCollection(<StepProbe stepId="fixture-finish" />, {
      collectionId: "fixture-ui",
      uiDocument: mutatedUi,
    });

    expect(screen.queryByTestId("field-TestGrooveFinish")).toBeNull();
    expect(screen.getByTestId("section").children).toHaveLength(0);
  });
});
