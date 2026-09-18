// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import classManifestDocument from "../../../../public/collections/class/manifest.json";
import classUiDocument from "../../../../public/collections/class/ui.json";
import makoManifestDocument from "../../../../public/collections/mako/manifest.json";
import makoUiDocument from "../../../../public/collections/mako/ui.json";
import urbanLowHeightManifestDocument from "../../../../public/collections/urban-low-height/manifest.json";
import urbanLowHeightUiDocument from "../../../../public/collections/urban-low-height/ui.json";
import { ReadyCollectionContext } from "@/entities/collection";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";

import { FlowEntryRedirect } from "../FlowEntryRedirect";

afterEach(cleanup);

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
};

describe("FlowEntryRedirect", () => {
  it.each([
    ["urban-low-height", urbanLowHeightManifestDocument, urbanLowHeightUiDocument],
    ["class", classManifestDocument, classUiDocument],
    ["mako", makoManifestDocument, makoUiDocument],
  ])("uses the %s entry route and preserves collection identity", async (collectionId, manifest, ui) => {
    render(
      <ReadyCollectionContext.Provider value={buildReadyCollection(collectionId, manifest, ui)}>
        <MemoryRouter initialEntries={[`/prebuilt?collectionId=${collectionId}`]}>
          <Routes>
            <Route path="/prebuilt" element={<FlowEntryRedirect flow="prebuilt" />} />
            <Route path="/prebuilt/model" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </ReadyCollectionContext.Provider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("location").textContent).toBe(`/prebuilt/model?collectionId=${collectionId}`),
    );
  });
});
