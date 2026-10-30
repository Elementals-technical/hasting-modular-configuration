// @vitest-environment jsdom
import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { store } from "@/app/store";
import { renderWithUshCollection } from "@/features/collectionCustomization/__tests__/testUtils/renderWithUshCollection";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { resetConfiguration, setActiveCollectionId } from "@/entities/configuration";
import { reset, setActiveProfile } from "@/entities/product/model/store/slice";

import { CabinetStyleDetailsPage } from "../CabinetStyleDetailsPage";

/**
 * The preview is resolved from the active collection by the style, cabinet type and height the
 * card was opened with. The picture is no longer carried in the URL, so a link cannot pin a
 * bundled asset path that the next build renames.
 */

const COLLECTION_IMAGES = "https://app.test/collections/urban-standard-height/images/cabinet";

const renderDetails = (search: string) =>
  renderWithUshCollection(<CabinetStyleDetailsPage />, {
    initialPath: `/custom/cabinet-builder/details/style?collectionId=urban-standard-height&${search}`,
  });

describe("cabinet style details preview", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(setActiveProfile(ushProfile));
    store.dispatch(setActiveCollectionId("urban-standard-height"));
  });

  afterEach(cleanup);

  it("shows the picture the collection declares for the style it was opened with", () => {
    renderDetails("style=2&cabinetType=Sink-Base&height=53&title=2%20Drawer");

    expect(screen.getByAltText("2-Drawer").getAttribute("src")).toBe(
      `${COLLECTION_IMAGES}/sink-base/SinkBase2D_centralG.png`,
    );
  });

  it("follows the cabinet type the card was opened with", () => {
    renderDetails("style=2&cabinetType=Sink-Cabinet&height=50&title=2%20Drawer");

    expect(screen.getByAltText("2-Drawer").getAttribute("src")).toBe(
      `${COLLECTION_IMAGES}/side-cabinet/SinkBase2D_PTO.png`,
    );
  });

  it("says so when the collection declares no picture for the style", () => {
    renderDetails("style=ghost&cabinetType=Sink-Base&height=53&title=Ghost");

    expect(screen.getByText("No image")).toBeTruthy();
  });
});
