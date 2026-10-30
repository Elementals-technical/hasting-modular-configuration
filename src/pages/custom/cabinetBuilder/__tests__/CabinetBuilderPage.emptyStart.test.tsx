// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildReadyUshCollection,
  renderWithUshCollection,
} from "@/features/collectionCustomization/__tests__/testUtils/renderWithUshCollection";
import { store } from "@/app/store";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { resetConfiguration, setActiveCollectionId } from "@/entities/configuration";
import { getSelectedProducts } from "@/entities/product/model/store/selectors";
import { reset, setActiveProfile } from "@/entities/product/model/store/slice";

import { CabinetBuilderPage } from "../CabinetBuilderPage";

vi.mock("@/shared/hooks/usePlayCanvasReady", () => ({ usePlayCanvasReady: () => false }));
vi.mock("@/utils/functions/playcanvas/emptyButton", () => ({ showEmptyButton: vi.fn(), hideEmptyButton: vi.fn() }));
vi.mock("@/features/sidebar/ui/RightCabinetStyleSidebar/RightCabinetStyleSidebar", () => ({
  RightCabinetStyleSidebar: () => null,
}));
vi.mock("@/shared/ui/Accordion/ConfiguratorAccordion", () => ({
  ConfiguratorAccordionGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ConfiguratorAccordionItem: () => null,
}));

const readyUsh = buildReadyUshCollection();

describe("Custom without a preset starts empty for USH", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(setActiveProfile(ushProfile));
    store.dispatch(setActiveCollectionId("urban-standard-height"));
  });

  afterEach(cleanup);

  it("has no products in the composition until the user adds one", () => {
    renderWithUshCollection(<CabinetBuilderPage />, {
      data: readyUsh,
      initialPath: "/custom/cabinet-builder?collectionId=urban-standard-height",
    });

    expect(getSelectedProducts(store.getState())).toEqual([]);
  });
});
