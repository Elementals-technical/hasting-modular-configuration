// @vitest-environment jsdom

import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithFixtureCollection } from "@/entities/collection/__tests__/fixtures/renderWithFixtureCollection";

import { FieldsStepPage } from "../FieldsStepPage";

vi.mock("@/shared/ui/Accordion/ConfiguratorAccordion", () => ({
  ConfiguratorAccordionGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ConfiguratorAccordionItem: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <section aria-label={title}>{children}</section>
  ),
}));

afterEach(cleanup);

const sectionTitles = () => screen.queryAllByRole("region").map((region) => region.getAttribute("aria-label"));

describe("FieldsStepPage renders a step's sections from the schema alone", () => {
  it("renders fixture-ui's test-finish section", () => {
    renderWithFixtureCollection(<FieldsStepPage stepId="fixture-finish" />, { collectionId: "fixture-ui" });

    expect(sectionTitles()).toEqual(["Test Finish"]);
  });

  it("renders fixture-rules' sections in schema order", () => {
    renderWithFixtureCollection(<FieldsStepPage stepId="finish" />, { collectionId: "fixture-rules" });

    expect(sectionTitles()).toEqual(["Handle", "Drawers", "Height"]);
  });

  it("renders no sections for a step the schema does not declare", () => {
    renderWithFixtureCollection(<FieldsStepPage stepId="ghost" />, { collectionId: "fixture-ui" });

    expect(sectionTitles()).toEqual([]);
  });
});
