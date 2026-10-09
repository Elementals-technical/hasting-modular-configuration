// @vitest-environment jsdom
import { cleanup, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ulhManifest from "../../../../../../public/collections/urban-low-height/manifest.json";
import ulhPresets from "../../../../../../public/collections/urban-low-height/presets.json";
import ulhProfileDocument from "../../../../../../public/collections/urban-low-height/product-profile.json";
import ulhUi from "../../../../../../public/collections/urban-low-height/ui.json";
import { store } from "@/app/store";
import { parseProductProfile } from "@/entities/collection";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";
import { renderWithUshCollection } from "@/features/collectionCustomization/__tests__/testUtils/renderWithUshCollection";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { resetConfiguration, setActiveCollectionId } from "@/entities/configuration";
import {
  reset,
  setActiveCabinetType,
  setActiveProfile,
  setSelectedProductConfig,
} from "@/entities/product/model/store/slice";
import { setOpenStyleSidebar } from "@/features/sidebar/model/store/slice";

import { RightCabinetStyleSidebar } from "../RightCabinetStyleSidebar";

/** The handle preview is the collection's picture, not a list of handle ids kept in the sidebar. */

vi.mock("@/shared/hooks/usePlayCanvasReady", () => ({ usePlayCanvasReady: () => false }));

const parsedUlhProfile = parseProductProfile(ulhProfileDocument);
if (!parsedUlhProfile.ok) throw new Error("Urban Low Height profile must parse");
const ulhProfile = parsedUlhProfile.profile;

beforeEach(() => {
  store.dispatch(reset());
  store.dispatch(resetConfiguration());
  store.dispatch(setActiveProfile(ushProfile));
  store.dispatch(setActiveCollectionId("urban-standard-height"));
  store.dispatch(setActiveCabinetType("Sink-Base"));
  store.dispatch(setOpenStyleSidebar(true));
});

afterEach(cleanup);

const previewSrc = () => screen.getByAltText("handle preview").getAttribute("src");

describe("handle preview", () => {
  it("shows the picture the collection declares for the chosen handle", () => {
    store.dispatch(setSelectedProductConfig({ Handle: "handle_urban_botcut" }));
    renderWithUshCollection(<RightCabinetStyleSidebar />);

    expect(previewSrc()).toBe("https://app.test/collections/urban-standard-height/images/handle/CentralGHandle.jpg");
  });

  it("falls back to the generic picture for a handle the collection declares none for", () => {
    store.dispatch(setSelectedProductConfig({ Handle: "G57" }));
    renderWithUshCollection(<RightCabinetStyleSidebar />);

    expect(previewSrc()).not.toContain("/collections/");
  });
});

describe("an Urban Low Height cabinet placed in an empty builder", () => {
  beforeEach(() => {
    store.dispatch(setActiveProfile(ulhProfile));
    store.dispatch(setActiveCollectionId("urban-low-height"));
  });

  it("takes the collection's handle, the upper groove the models carry, while none is chosen", async () => {
    // Auto-add places a cabinet with the handle chosen so far: none after a page reload.
    store.dispatch(setSelectedProductConfig({ Drawers: "1D", Width: 60, Height: 38, Depth: 46 }));
    renderWithUshCollection(<RightCabinetStyleSidebar />, {
      initialPath: "/?collectionId=urban-low-height",
      data: buildReadyCollection("urban-low-height", ulhManifest, ulhUi, ulhPresets),
    });

    await waitFor(() =>
      expect(store.getState().rootStateUI.product.selectedProductConfig?.Handle).toBe("handle_urban_topcut"),
    );
    expect(previewSrc()).toBe("https://app.test/collections/urban-low-height/images/handle/UpperGHandle.png");
  });
});
