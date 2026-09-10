// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createMemoryRouter, RouterProvider, useNavigate } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { store } from "@/app/store";

import type { CollectionRuntimeDependencies } from "../model/types";
import { useActiveCollection } from "../ui/activeCollectionContext";
import { ActiveCollectionProvider } from "../ui/ActiveCollectionProvider";

const registryUrl = "https://app.test/collections/registry.json";
const rootUrl = "https://app.test/collections/";
const registry = {
  defaultCollectionId: "slow-collection",
  collections: [
    { id: "slow-collection", manifest: "slow-collection/manifest.json" },
    { id: "latest-collection", manifest: "latest-collection/manifest.json" },
  ],
};

const Consumer = () => {
  const state = useActiveCollection();
  const navigate = useNavigate();
  const id = "collectionId" in state ? state.collectionId : "";
  return (
    <>
      <output data-testid="state">{`${state.status}:${id ?? ""}`}</output>
      <button onClick={() => navigate("/?collectionId=latest-collection")}>navigate</button>
    </>
  );
};

afterEach(cleanup);

describe("ActiveCollectionProvider navigation races", () => {
  it.each(["success", "failure"])("ignores a stale %s after collectionId changes", async (outcome) => {
    let resolveSlow: ((value: unknown) => void) | undefined;
    let rejectSlow: ((reason: unknown) => void) | undefined;
    const slowManifest = new Promise<unknown>((resolve, reject) => {
      resolveSlow = resolve;
      rejectSlow = reject;
    });
    const dependencies: CollectionRuntimeDependencies = {
      registryUrl,
      collectionsRootUrl: rootUrl,
      registry,
      fetchJson: vi.fn(async (url) => {
        if (url === `${rootUrl}slow-collection/manifest.json`) return slowManifest;
        if (url === `${rootUrl}latest-collection/manifest.json`) {
          return { id: "latest-collection", label: "Latest", defaults: {} };
        }
        throw new Error(`Unexpected request: ${url}`);
      }),
      remote: {
        loadConfigurator: vi.fn(async () => Promise.reject(new Error("Unexpected remote request"))),
        loadCountertopTable: vi.fn(async () => Promise.reject(new Error("Unexpected remote request"))),
        loadCabinetTable: vi.fn(async () => Promise.reject(new Error("Unexpected remote request"))),
      },
    };
    const router = createMemoryRouter(
      [
        {
          path: "*",
          element: (
            <ActiveCollectionProvider dependencies={dependencies}>
              <Consumer />
            </ActiveCollectionProvider>
          ),
        },
      ],
      { initialEntries: ["/?collectionId=slow-collection"] },
    );
    render(
      <Provider store={store}>
        <RouterProvider router={router} />
      </Provider>,
    );

    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("loading:slow-collection"));
    fireEvent.click(screen.getByRole("button", { name: "navigate" }));
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("ready:latest-collection"));

    await act(async () => {
      if (outcome === "success") {
        resolveSlow?.({ id: "slow-collection", label: "Slow", defaults: {} });
      } else {
        rejectSlow?.(new Error("late failure"));
      }
      await Promise.resolve();
    });
    expect(screen.getByTestId("state").textContent).toBe("ready:latest-collection");
  });
});
