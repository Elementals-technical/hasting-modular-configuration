import { configureStore } from "@reduxjs/toolkit";
import { describe, expect, it } from "vitest";

import { rootReducer } from "@/app/store/reducer";
import type { RootState } from "@/app/store";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { setActiveProfile, setCountertopColorSku } from "@/entities/product/model/store/slice";

import { selectSidePanelAvailability } from "../../model/selectors";

/**
 * On a Syntesi countertop the selector allows no groove and names the `messages` key of its text,
 * so the grid shows the profile's words instead of the generic "not available".
 */

const availabilityOn = (countertopColorSku: string) => {
  const store = configureStore({ reducer: rootReducer });
  store.dispatch(setActiveProfile(ushProfile));
  store.dispatch(setCountertopColorSku(countertopColorSku));
  return selectSidePanelAvailability(store.getState() as RootState);
};

describe("selectSidePanelAvailability on a Syntesi countertop", () => {
  it("allows no groove and names the Syntesi message key beside its rule code", () => {
    expect(availabilityOn("SSSYN")).toEqual({
      allowed: new Set(),
      reason: "Syntesi is not available with side panels.",
      reasonCode: "syntesi-countertop",
      messageCode: "syntesi.sidePanelsUnavailable",
    });
  });

  it("names no Syntesi reason on another countertop", () => {
    expect(availabilityOn("SSTKR").reasonCode).toBeUndefined();
  });
});
