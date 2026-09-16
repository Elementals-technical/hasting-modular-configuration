// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";

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

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
};

const readyUrbanLowHeight = (): ActiveCollectionState => {
  const manifest = validateCollectionManifest(
    urbanLowHeightManifestDocument,
    "urban-low-height",
    `${rootUrl}urban-low-height/manifest.json`,
    rootUrl,
  );
  const customization = validateCustomizationSchema(urbanLowHeightUiDocument);
  if (!customization.ok) throw new Error("Expected valid Urban Low Height UI");

  return {
    status: "ready",
    collectionId: "urban-low-height",
    data: {
      id: "urban-low-height",
      manifest,
      diagnostics: [],
      sources: { local: { ui: customization.schema }, remote: {} },
      catalog: { customization: customization.schema },
    },
  };
};

describe("FlowEntryRedirect", () => {
  it("uses the Urban Low Height entry route and preserves collection identity", async () => {
    render(
      <ActiveCollectionContext.Provider value={readyUrbanLowHeight()}>
        <MemoryRouter initialEntries={["/prebuilt?collectionId=urban-low-height"]}>
          <Routes>
            <Route path="/prebuilt" element={<FlowEntryRedirect flow="prebuilt" />} />
            <Route path="/prebuilt/model" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </ActiveCollectionContext.Provider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("location").textContent).toBe(
        "/prebuilt/model?collectionId=urban-low-height",
      ),
    );
  });
});
