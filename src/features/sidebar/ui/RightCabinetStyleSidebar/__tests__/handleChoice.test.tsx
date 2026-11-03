// @vitest-environment jsdom
import { cleanup, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import lameManifest from "../../../../../../public/collections/lame/manifest.json";
import lameProfileDocument from "../../../../../../public/collections/lame/product-profile.json";
import lameUi from "../../../../../../public/collections/lame/ui.json";
import tricotManifest from "../../../../../../public/collections/tricot/manifest.json";
import tricotUi from "../../../../../../public/collections/tricot/ui.json";
import urbanDuplexManifest from "../../../../../../public/collections/urban-duplex/manifest.json";
import urbanDuplexProfileDocument from "../../../../../../public/collections/urban-duplex/product-profile.json";
import urbanDuplexUi from "../../../../../../public/collections/urban-duplex/ui.json";
import ulhManifest from "../../../../../../public/collections/urban-low-height/manifest.json";
import ulhProfileDocument from "../../../../../../public/collections/urban-low-height/product-profile.json";
import ulhUi from "../../../../../../public/collections/urban-low-height/ui.json";
import { store } from "@/app/store";
import { parseProductProfile, type ProductProfile } from "@/entities/collection";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";
import { tricotProfile } from "@/entities/collection/__tests__/tricotFixtures";
import { resetConfiguration, setActiveCollectionId } from "@/entities/configuration";
import {
  replaceCollectionData,
  reset,
  setActiveCabinetType,
  setSelectedProductConfig,
} from "@/entities/product/model/store/slice";
import { renderWithUshCollection } from "@/features/collectionCustomization/__tests__/testUtils/renderWithUshCollection";
import { setOpenStyleSidebar } from "@/features/sidebar/model/store/slice";

import { RightCabinetStyleSidebar } from "../RightCabinetStyleSidebar";

/** A collection with one handle has nothing to choose: its builder shows no handle selector and no picture of it. */

vi.mock("@/shared/hooks/usePlayCanvasReady", () => ({ usePlayCanvasReady: () => false }));

const parsedProfile = (document: unknown): ProductProfile => {
  const result = parseProductProfile(document);
  if (!result.ok) throw new Error("A packaged profile failed validation");
  return result.profile;
};

const COLLECTIONS = {
  tricot: { profile: tricotProfile, manifest: tricotManifest, ui: tricotUi },
  lame: { profile: parsedProfile(lameProfileDocument), manifest: lameManifest, ui: lameUi },
  "urban-duplex": {
    profile: parsedProfile(urbanDuplexProfileDocument),
    manifest: urbanDuplexManifest,
    ui: urbanDuplexUi,
  },
  "urban-low-height": { profile: parsedProfile(ulhProfileDocument), manifest: ulhManifest, ui: ulhUi },
};

const renderSidebar = (collectionId: keyof typeof COLLECTIONS) => {
  const { profile, manifest, ui } = COLLECTIONS[collectionId];

  store.dispatch(replaceCollectionData({ profile, cabinetCatalog: null }));
  store.dispatch(setActiveCollectionId(collectionId));
  store.dispatch(setActiveCabinetType("Sink-Base"));
  store.dispatch(setSelectedProductConfig({ Drawers: "1D" }));
  store.dispatch(setOpenStyleSidebar(true));

  renderWithUshCollection(<RightCabinetStyleSidebar />, {
    initialPath: `/?collectionId=${collectionId}`,
    data: buildReadyCollection(collectionId, manifest, ui),
  });
};

const selectorTitles = () =>
  Array.from(document.querySelectorAll('[class*="contentItem"]')).map((row) => row.firstElementChild?.textContent);

const handlePreview = () => screen.queryByAltText("handle preview");

beforeEach(() => {
  store.dispatch(reset());
  store.dispatch(resetConfiguration());
});

afterEach(cleanup);

describe("the handle in the style sidebar", () => {
  it.each(["tricot", "lame", "urban-duplex"] as const)("offers no choice in %s, which has one handle", (id) => {
    renderSidebar(id);

    expect(selectorTitles()).toEqual(expect.arrayContaining(["Width", "Depth"]));
    expect(selectorTitles()).not.toContain("Handle");
    expect(handlePreview()).toBeNull();
  });

  it("still records the one handle of a Tricot cabinet, which its SKU and groove colour read", async () => {
    renderSidebar("tricot");

    await waitFor(() => expect(store.getState().rootStateUI.product.selectedProductConfig?.Handle).toBe("UG"));
  });

  it("offers the selector and the picture in Urban Low Height, which has two handles", () => {
    renderSidebar("urban-low-height");

    expect(selectorTitles()).toContain("Handle");
    expect(handlePreview()).not.toBeNull();
  });
});
