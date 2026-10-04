// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { store } from "@/app/store";
import { clearRestore, failRestore, finishRestore, startRestore } from "@/entities/configuration";

import { RestoreFailurePopup } from "../ui/RestoreFailurePopup";

const renderPopup = () =>
  render(
    <Provider store={store}>
      <RestoreFailurePopup />
    </Provider>,
  );

describe("RestoreFailurePopup", () => {
  beforeEach(() => {
    store.dispatch(clearRestore());
  });

  afterEach(cleanup);

  it("tells the user why a saved configuration did not open, once", async () => {
    renderPopup();

    act(() => {
      store.dispatch(failRestore({ configId: "13507", reason: "not-found", message: "404" }));
    });

    expect(screen.getByText("The saved link was not found.")).toBeTruthy();

    fireEvent.click(screen.getByText("OK"));

    await waitFor(() => expect(screen.queryByText("The saved link was not found.")).toBeNull());
  });

  it("reports a partial restore", () => {
    renderPopup();

    act(() => {
      store.dispatch(startRestore("13507"));
      store.dispatch(finishRestore({ status: "partial", reason: "partial", message: "no asset" }));
    });

    expect(screen.getByText("Only part of the configuration was restored. Check it before saving.")).toBeTruthy();
  });

  it("stays closed for a configuration that came back whole", () => {
    renderPopup();

    act(() => {
      store.dispatch(startRestore("13507"));
      store.dispatch(finishRestore({ status: "restored", reason: null, message: null }));
    });

    expect(screen.queryByText("We couldn't open this configuration")).toBeNull();
  });
});
