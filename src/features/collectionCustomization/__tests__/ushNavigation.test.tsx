// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { store } from "@/app/store";
import { ReadyCollectionContext, useCollectionPresets } from "@/entities/collection";
import { buildReadyCollection } from "@/entities/collection/__tests__/fixtures/buildReadyCollection";
import { SideNavigation } from "@/widgets/SideNavigation/ui/SideNavigation";

import ushManifest from "../../../../public/collections/urban-standard-height/manifest.json";
import ushPresets from "../../../../public/collections/urban-standard-height/presets.json";
import ushUi from "../../../../public/collections/urban-standard-height/ui.json";

import { NavigationProbe } from "./testUtils/NavigationProbe";
import { readNavigation } from "./testUtils/readNavigation";

const readyUsh = buildReadyCollection("urban-standard-height", ushManifest, ushUi, ushPresets);

const renderUsh = (children: React.ReactNode, initialPath = "/?collectionId=urban-standard-height") =>
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialPath]}>
        <ReadyCollectionContext.Provider value={readyUsh}>{children}</ReadyCollectionContext.Provider>
      </MemoryRouter>
    </Provider>,
  );

const PresetsProbe = () => {
  const presets = useCollectionPresets();
  return <output data-testid="presets-count">{presets.length}</output>;
};

afterEach(cleanup);

describe("USH through the shared navigation/presets path", () => {
  it("keeps USH's own 6 prebuilt steps, in order", () => {
    renderUsh(<NavigationProbe flow="prebuilt" />);

    expect(readNavigation().steps.map((step) => step.stepId)).toEqual([
      "model",
      "cabinet",
      "countertop",
      "accessories",
      "faucet-holes",
      "summary",
    ]);
  });

  it("keeps USH's own 6 custom steps, in order", () => {
    renderUsh(<NavigationProbe flow="custom" />);

    expect(readNavigation().steps.map((step) => step.stepId)).toEqual([
      "cabinet-builder",
      "cabinet-colors",
      "countertop-custom",
      "accessories-custom",
      "faucet-holes",
      "summary",
    ]);
  });

  it("exposes USH's full 54-preset catalog", () => {
    renderUsh(<PresetsProbe />);

    expect(screen.getByTestId("presets-count").textContent).toBe("54");
  });

  it("renders USH's 6 prebuilt step labels through the real SideNavigation widget", () => {
    renderUsh(<SideNavigation flow="prebuilt" />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(6);
    expect(links[0].textContent).toBe("Model");
    expect(links[links.length - 1].textContent).toBe("Summary");
  });
});
