// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ActiveCollectionState, LoadedCollectionData } from "../model/types";
import { ActiveCollectionContext, useReadyActiveCollection } from "../ui/activeCollectionContext";
import { CollectionReadinessGate } from "../ui/CollectionReadinessGate";

const loadedCollection = (withConfigurator = true): LoadedCollectionData => ({
  id: "test-collection",
  manifest: {
    id: "test-collection",
    label: "Test collection",
    defaults: {},
  },
  diagnostics: [],
  sources: {
    local: {},
    remote: {},
  },
  catalog: withConfigurator
    ? {
        configurator: {
          groups: [],
          groupsByName: {},
        },
      }
    : {},
});

const renderGate = (state: ActiveCollectionState, child: React.ReactNode) =>
  render(
    <ActiveCollectionContext.Provider value={state}>
      <CollectionReadinessGate>{child}</CollectionReadinessGate>
    </ActiveCollectionContext.Provider>,
  );

const ReadyConsumer = () => {
  const collection = useReadyActiveCollection();
  const configurator = useReadyActiveCollection((active) => active.catalog.configurator);

  return (
    <output data-testid="ready-data">
      {collection.id}:{configurator.groups.length}
    </output>
  );
};

afterEach(cleanup);

describe("CollectionReadinessGate", () => {
  it.each<ActiveCollectionState>([{ status: "resolving" }, { status: "loading", collectionId: "test-collection" }])(
    "withholds children while the collection is $status",
    (state) => {
      renderGate(state, <div data-testid="shell">Configurator</div>);

      expect(screen.queryByTestId("shell")).toBeNull();
      expect(screen.getByText("Loading collection…")).toBeTruthy();
    },
  );

  it("publishes a refined ready collection to full-data and selector consumers", () => {
    renderGate(
      {
        status: "ready",
        collectionId: "test-collection",
        data: loadedCollection(),
      },
      <ReadyConsumer />,
    );

    expect(screen.getByTestId("ready-data").textContent).toBe("test-collection:0");
  });

  it("does not mount the shell when a generally ready collection lacks a configurator catalog", () => {
    renderGate(
      {
        status: "ready",
        collectionId: "test-collection",
        data: loadedCollection(false),
      },
      <div data-testid="shell">Configurator</div>,
    );

    expect(screen.queryByTestId("shell")).toBeNull();
  });

  it("reports a composition error when ready access is used outside the gate", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => render(<ReadyConsumer />)).toThrowError(
      "useReadyActiveCollection must be used within CollectionReadinessGate",
    );

    consoleError.mockRestore();
  });
});
