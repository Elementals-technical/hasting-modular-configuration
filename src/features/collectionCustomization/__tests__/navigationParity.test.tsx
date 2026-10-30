// @vitest-environment jsdom

import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { useLocation } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { resolveInSceneQuickEditorNotificationBacktrack } from "@/features/inSceneQuickEditorNotification";
import { BottomStickyBar } from "@/features/bottomStickyBar/ui/BottomStickyBar";
import { StepNavigationBar } from "@/features/StepNavigationBar/StepNavigationBar";
import s from "@/features/StepNavigationBar/StepNavigationBar.module.scss";
import { SideNavigation } from "@/widgets/SideNavigation/ui/SideNavigation";

import ushUi from "../../../../public/collections/urban-standard-height/ui.json";

import { buildReadyUshCollection, renderWithUshCollection } from "./testUtils/renderWithUshCollection";

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
};

// Accessories and Faucet Details swapped, everything else the same as USH's real prebuilt flow.
const reorderedUi = {
  ...ushUi,
  flows: {
    ...ushUi.flows,
    prebuilt: {
      ...ushUi.flows.prebuilt,
      steps: ushUi.flows.prebuilt.steps.map((ref) => {
        if (ref.stepId === "accessories") return ushUi.flows.prebuilt.steps.find((r) => r.stepId === "faucet-holes")!;
        if (ref.stepId === "faucet-holes") return ushUi.flows.prebuilt.steps.find((r) => r.stepId === "accessories")!;
        return ref;
      }),
    },
  },
};

const readyReordered = buildReadyUshCollection({ uiDocument: reorderedUi });

const renderReordered = (children: React.ReactNode, initialPath: string) =>
  renderWithUshCollection(children, { data: readyReordered, initialPath });

afterEach(cleanup);

describe("reordering Accessories and Faucet Details in ui.json", () => {
  it("shows the new order in the side menu", () => {
    renderReordered(<SideNavigation />, "/prebuilt/countertop?collectionId=urban-standard-height");

    const links = screen.getAllByRole("link");
    const accessoriesIndex = links.findIndex((link) => link.textContent === "Accessories");
    const faucetIndex = links.findIndex((link) => link.textContent === "Faucet Details");

    expect(accessoriesIndex).toBeGreaterThan(-1);
    expect(faucetIndex).toBeGreaterThan(-1);
    expect(faucetIndex).toBeLessThan(accessoriesIndex);
  });

  it("points the top step bar's Next at the new neighbour", async () => {
    const { container } = renderReordered(
      <>
        <StepNavigationBar title="Countertop & Basin" />
        <LocationProbe />
      </>,
      "/prebuilt/countertop?collectionId=urban-standard-height",
    );

    fireEvent.click(container.querySelector(`.${s.stepForward}`)!);

    await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/prebuilt/faucet-holes"));
  });

  it("points the bottom bar's Next at the new neighbour, same as the top bar", () => {
    renderReordered(<BottomStickyBar />, "/prebuilt/countertop?collectionId=urban-standard-height");

    expect(screen.getByText("Next: Faucet Details")).toBeTruthy();
  });

  it("keeps the quick-editor backtrack resolver in step with the new order", () => {
    const schema = readyReordered.catalog.customization ?? null;

    const forward = resolveInSceneQuickEditorNotificationBacktrack({
      flow: "prebuilt",
      previousPath: "/prebuilt/countertop",
      currentPath: "/prebuilt/faucet-holes",
      schema,
    });
    expect(forward.transition).toBe("forward");

    const backtrack = resolveInSceneQuickEditorNotificationBacktrack({
      flow: "prebuilt",
      previousPath: "/prebuilt/accessories",
      currentPath: "/prebuilt/countertop",
      schema,
    });
    expect(backtrack.transition).toBe("backtrack");
  });
});
