// @vitest-environment jsdom
import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { store } from "@/app/store";
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
