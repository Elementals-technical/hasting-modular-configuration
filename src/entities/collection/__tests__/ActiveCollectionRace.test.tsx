// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createMemoryRouter, RouterProvider, useNavigate } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { store } from "@/app/store";

import type { CollectionRuntimeDependencies } from "../model/types";
import { useActiveCollectionState } from "../ui/activeCollectionContext";
import { ActiveCollectionProvider } from "../ui/ActiveCollectionProvider";

const registryUrl = "https://app.test/collections/registry.json";
const rootUrl = "https://app.test/collections/";
const registry = {
  defaultCollectionId: "slow-collection",
  collections: [{ id: "slow-collection", manifest: "slow-collection/manifest.json" }],
};

const Consumer = () => {
  const state = useActiveCollectionState();
  const navigate = useNavigate();
  const id = "collectionId" in state ? state.collectionId : "";

  return (
    <>
      <output data-testid="state">{state.status + ":" + (id ?? "")}</output>
      <button onClick={() => navigate("/?collectionId=slow-collection&configId=13507")}>update query</button>
    </>
  );
};

afterEach(cleanup);

describe("ActiveCollectionProvider fixed session", () => {
  it("does not restart an in-flight load for an unrelated query-string change", async () => {
    let resolveManifest: ((value: unknown) => void) | undefined;
    const slowManifest = new Promise<unknown>((resolve) => {
      resolveManifest = resolve;
    });
    const fetchJson = vi.fn(async (url: string) => {
      if (url === rootUrl + "slow-collection/manifest.json") return slowManifest;
      throw new Error("Unexpected request: " + url);
    });
    const dependencies: CollectionRuntimeDependencies = {
      registryUrl,
      collectionsRootUrl: rootUrl,
      registry,
      fetchJson,
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
    fireEvent.click(screen.getByRole("button", { name: "update query" }));
    expect(fetchJson).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveManifest?.({ id: "slow-collection", label: "Slow", defaults: {} });
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("ready:slow-collection"));
    expect(fetchJson).toHaveBeenCalledTimes(1);
  });
});
