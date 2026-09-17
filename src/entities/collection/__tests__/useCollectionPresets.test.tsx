// @vitest-environment jsdom

import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { renderWithFixtureCollection } from "./fixtures/renderWithFixtureCollection";
import { useCollectionPresets } from "../lib/useCollectionPresets";

const PresetsProbe = () => {
  const presets = useCollectionPresets();

  return (
    <output data-testid="presets">
      {JSON.stringify(presets.map((preset) => ({ id: preset.id, title: preset.title })))}
    </output>
  );
};

const readPresets = () => JSON.parse(screen.getByTestId("presets").textContent ?? "[]");

afterEach(cleanup);

describe("useCollectionPresets against a non-USH collection", () => {
  it("returns fixture-ui's own preset, not USH's catalog", () => {
    renderWithFixtureCollection(<PresetsProbe />, { collectionId: "fixture-ui" });

    expect(readPresets()).toEqual([{ id: 901, title: 'Fixture UI · 31" Demo' }]);
  });

  it("returns an empty list for a collection whose manifest declares no presets source", () => {
    renderWithFixtureCollection(<PresetsProbe />, { collectionId: "fixture-rules" });

    expect(readPresets()).toEqual([]);
  });
});
