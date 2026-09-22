// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { store } from "@/app/store";
import { ReadyCollectionContext } from "@/entities/collection";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { reset, setActiveProfile, setFaucetHolesAmount } from "@/entities/product/model/store/slice";
import { readyCollectionFixture } from "@/features/configurationCommands/__tests__/readyCollectionFixture";

import { FieldsStepPage } from "../FieldsStepPage";

// Faucet has no page of its own: section from ui.json, options from the profile, pick through the shared handler.

const onChangeMock = vi.fn(async (attributeId: string, value: string) => {
  if (attributeId === "FaucetHolesAmount") store.dispatch(setFaucetHolesAmount(value));
  return { status: "applied" as const, plan: [] };
});

vi.mock("@/features/configurationCommands", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/configurationCommands")>();

  return {
    ...actual,
    useAttributeChangeHandler: (attributeId: string) => ({
      onChange: (value: string) => onChangeMock(attributeId, value),
      preview: null,
      notice: null,
      onConfirm: vi.fn(),
      onCancel: vi.fn(),
    }),
  };
});

vi.mock("@/shared/ui/Accordion/ConfiguratorAccordion");

afterEach(cleanup);

const renderStep = () =>
  render(
    <ReadyCollectionContext.Provider value={readyCollectionFixture}>
      <Provider store={store}>
        <MemoryRouter initialEntries={["/prebuilt/faucet-holes"]}>
          <FieldsStepPage stepId="faucet-holes" />
        </MemoryRouter>
      </Provider>
    </ReadyCollectionContext.Provider>,
  );

describe("the faucet holes step on the generic fields page", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(setActiveProfile(ushProfile));
    onChangeMock.mockClear();
  });

  it("renders the section and the profile's options from ui.json alone", () => {
    renderStep();

    expect(screen.getByRole("region", { name: "Faucet Holes" })).toBeTruthy();
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual(["0", "1", "2", "3", "4", "5"]);
  });

  it("shows the hint ui.json declares for the selected amount", () => {
    store.dispatch(setFaucetHolesAmount("2"));
    renderStep();

    expect(screen.getByText("Faucet hole placement and spacing to be specified at time of order.")).toBeTruthy();
  });

  it("sends the picked amount to the shared handler", async () => {
    renderStep();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "3" }));
    });

    expect(onChangeMock).toHaveBeenCalledWith("FaucetHolesAmount", "3");
  });
});
