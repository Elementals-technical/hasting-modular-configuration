// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ActiveCollectionState, LoadedCollectionData } from "../model/types";
import {
  ActiveCollectionContext,
  ActiveCollectionSessionContext,
  type ActiveCollectionSession,
  useReadyActiveCollection,
} from "../ui/activeCollectionContext";
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

const renderGate = (
  state: ActiveCollectionState,
  child: React.ReactNode,
  options: {
    session?: ActiveCollectionSession;
    navigateTo?: (url: string) => void;
    initialEntry?: string;
  } = {},
) =>
  render(
    <MemoryRouter initialEntries={[options.initialEntry ?? "/?collectionId=test-collection"]}>
      <ActiveCollectionSessionContext.Provider
        value={
          options.session ?? {
            requestedCollectionId: "test-collection",
            defaultCollectionId: "test-collection",
            retry: vi.fn(),
          }
        }
      >
        <ActiveCollectionContext.Provider value={state}>
          <CollectionReadinessGate navigateTo={options.navigateTo}>{child}</CollectionReadinessGate>
        </ActiveCollectionContext.Provider>
      </ActiveCollectionSessionContext.Provider>
    </MemoryRouter>,
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

  it("shows a safe error and retries the captured session", () => {
    const retry = vi.fn();
    renderGate(
      {
        status: "error",
        collectionId: "test-collection",
        error: {
          code: "source-load-failed",
          message: "secret upstream payload",
          cause: new Error("private stack"),
        },
      },
      <div data-testid="shell">Configurator</div>,
      {
        session: {
          requestedCollectionId: "test-collection",
          defaultCollectionId: "test-collection",
          retry,
        },
      },
    );

    expect(screen.queryByTestId("shell")).toBeNull();
    expect(screen.getByText("Collection unavailable")).toBeTruthy();
    expect(screen.queryByText("secret upstream payload")).toBeNull();
    screen.getByRole("button", { name: "Retry" }).click();
    expect(retry).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Open default collection" })).toBeNull();
  });

  it("opens a known different default as a new session and preserves other URL data", () => {
    const navigateTo = vi.fn();

    renderGate(
      {
        status: "error",
        collectionId: "unknown",
        error: { code: "unknown-collection", message: "Unknown collection: unknown" },
      },
      <div>Configurator</div>,
      {
        session: {
          requestedCollectionId: "unknown",
          defaultCollectionId: "urban-standard-height",
          retry: vi.fn(),
        },
        navigateTo,
        initialEntry: "/custom/countertop?collectionId=unknown&configId=13507&hostUrl=%2Fquote#details",
      },
    );

    screen.getByRole("button", { name: "Open default collection" }).click();

    const target = new URL(navigateTo.mock.calls[0][0]);
    expect(target.pathname).toBe("/custom/countertop");
    expect(target.searchParams.get("collectionId")).toBeNull();
    expect(target.searchParams.get("configId")).toBe("13507");
    expect(target.searchParams.get("hostUrl")).toBe("/quote");
    expect(target.hash).toBe("#details");
  });

  it("describes a missing configurator catalog as a shell capability error", () => {
    renderGate(
      {
        status: "ready",
        collectionId: "test-collection",
        data: loadedCollection(false),
      },
      <div data-testid="shell">Configurator</div>,
    );

    expect(screen.queryByTestId("shell")).toBeNull();
    expect(screen.getByText("This collection does not provide the configurator data required to start.")).toBeTruthy();
  });

  it.each([
    {
      name: "removes an explicit identity",
      requestedCollectionId: "class",
      initialEntry: "/custom/countertop",
    },
    {
      name: "adds identity to an implicit-default session",
      requestedCollectionId: null,
      initialEntry: "/custom/countertop?collectionId=class",
    },
    {
      name: "changes an explicit identity",
      requestedCollectionId: "class",
      initialEntry: "/custom/countertop?collectionId=urban-standard-height",
    },
    {
      name: "empties an explicit identity",
      requestedCollectionId: "class",
      initialEntry: "/custom/countertop?collectionId=",
    },
  ])("blocks the shell when client navigation $name", ({ requestedCollectionId, initialEntry }) => {
    const navigateTo = vi.fn();
    renderGate(
      {
        status: "ready",
        collectionId: requestedCollectionId ?? "urban-standard-height",
        data: loadedCollection(),
      },
      <div data-testid="shell">Configurator</div>,
      {
        session: {
          requestedCollectionId,
          defaultCollectionId: "urban-standard-height",
          retry: vi.fn(),
        },
        navigateTo,
        initialEntry,
      },
    );

    expect(screen.queryByTestId("shell")).toBeNull();
    expect(screen.getByText("Collection cannot be changed during an active configurator session.")).toBeTruthy();
    screen.getByRole("button", { name: "Restart configurator" }).click();
    expect(navigateTo).toHaveBeenCalledWith(new URL(initialEntry, window.location.origin).toString());
  });

  it("allows pathname and unrelated query changes while the startup identity stays exact", () => {
    renderGate(
      {
        status: "ready",
        collectionId: "class",
        data: loadedCollection(),
      },
      <div data-testid="shell">Configurator</div>,
      {
        session: {
          requestedCollectionId: "class",
          defaultCollectionId: "urban-standard-height",
          retry: vi.fn(),
        },
        initialEntry: "/custom/countertop?collectionId=class&configId=13507",
      },
    );

    expect(screen.getByTestId("shell")).toBeTruthy();
  });

  it("reports a composition error when ready access is used outside the gate", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => render(<ReadyConsumer />)).toThrowError(
      "useReadyActiveCollection must be used within CollectionReadinessGate",
    );

    consoleError.mockRestore();
  });
});
