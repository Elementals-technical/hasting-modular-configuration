// @vitest-environment jsdom

import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { store } from "@/app/store";
import { getTowelBarOption } from "@/entities/product/model/store/selectors";
import { setTowelBarOption } from "@/entities/product/model/store/slice";
import { BottomStickyBar } from "@/features/bottomStickyBar/ui/BottomStickyBar";
import { SideNavigation } from "@/widgets/SideNavigation/ui/SideNavigation";

import ushUi from "../../../../public/collections/urban-standard-height/ui.json";

import { buildReadyUshCollection, renderWithUshCollection } from "./testUtils/renderWithUshCollection";

const withDisabledAccessories = {
  ...ushUi,
  steps: {
    ...ushUi.steps,
    accessories: { ...ushUi.steps.accessories, enabled: false },
  },
};

const readyWithDisabledAccessories = buildReadyUshCollection({ uiDocument: withDisabledAccessories });

const renderWithDisabledAccessories = (children: React.ReactNode, initialPath: string) =>
  renderWithUshCollection(children, { data: readyWithDisabledAccessories, initialPath });

afterEach(cleanup);

describe("disabling Accessories in ui.json", () => {
  it("drops it from the side menu", () => {
    renderWithDisabledAccessories(<SideNavigation />, "/prebuilt/countertop?collectionId=urban-standard-height");

    expect(screen.queryByRole("link", { name: "Accessories" })).toBeNull();
  });

  it("makes the bottom bar's Next skip straight to Faucet Details", () => {
    renderWithDisabledAccessories(<BottomStickyBar />, "/prebuilt/countertop?collectionId=urban-standard-height");

    expect(screen.getByText("Next: Faucet Details")).toBeTruthy();
  });

  it("does not erase a value already chosen in the now-hidden step's section", () => {
    store.dispatch(setTowelBarOption("Left"));

    renderWithDisabledAccessories(<SideNavigation />, "/prebuilt/countertop?collectionId=urban-standard-height");

    expect(getTowelBarOption(store.getState())).toBe("Left");
  });
});
