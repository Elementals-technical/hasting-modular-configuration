// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import classManifestDocument from "../../../../public/collections/class/manifest.json";
import classUiDocument from "../../../../public/collections/class/ui.json";
import urbanLowHeightManifestDocument from "../../../../public/collections/urban-low-height/manifest.json";
import urbanLowHeightUiDocument from "../../../../public/collections/urban-low-height/ui.json";
import {
  ActiveCollectionContext,
  validateCollectionManifest,
  validateCustomizationSchema,
  type ActiveCollectionState,
} from "@/entities/collection";

import { FlowEntryRedirect } from "../FlowEntryRedirect";

const rootUrl = "https://app.test/collections/";

afterEach(cleanup);

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
};

const readyCollection = (
  collectionId: string,
  manifestDocument: unknown,
  uiDocument: unknown,
): ActiveCollectionState => {
  const manifest = validateCollectionManifest(
    manifestDocument,
    collectionId,
    `${rootUrl}${collectionId}/manifest.json`,
    rootUrl,
  );
  const customization = validateCustomizationSchema(uiDocument);
  if (!customization.ok) throw new Error(`Expected valid ${collectionId} UI`);

  return {
    status: "ready",
    collectionId,
    data: {
      id: collectionId,
      manifest,
      diagnostics: [],
      sources: { local: { ui: customization.schema }, remote: {} },
      catalog: { customization: customization.schema },
    },
  };
};

describe("FlowEntryRedirect", () => {
  it.each([
    ["urban-low-height", urbanLowHeightManifestDocument, urbanLowHeightUiDocument],
    ["class", classManifestDocument, classUiDocument],
  ])("uses the %s entry route and preserves collection identity", async (collectionId, manifest, ui) => {
    render(
      <ActiveCollectionContext.Provider value={readyCollection(collectionId, manifest, ui)}>
        <MemoryRouter initialEntries={[`/prebuilt?collectionId=${collectionId}`]}>
          <Routes>
            <Route path="/prebuilt" element={<FlowEntryRedirect flow="prebuilt" />} />
            <Route path="/prebuilt/model" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </ActiveCollectionContext.Provider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("location").textContent).toBe(`/prebuilt/model?collectionId=${collectionId}`),
    );
  });
});
