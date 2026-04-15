import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit";
import { StorageService } from "../../lib/storageService";
import {
  markCartSubmitted,
  removeItem,
  setAutofillEnabled,
  setCartMaterials,
  setSelectedMaterial,
} from "./slice";
import {
  getHasSubmittedCart,
  getIsAutofillEnabled,
  getSelectedMaterials,
} from "./selectors";

export const swatchOrderPersistListener = createListenerMiddleware();

swatchOrderPersistListener.startListening({
  matcher: isAnyOf(
    setSelectedMaterial,
    removeItem,
    setCartMaterials,
    setAutofillEnabled,
    markCartSubmitted,
  ),
  effect: (_action, api) => {
    const state = api.getState() as Parameters<typeof getSelectedMaterials>[0];
    StorageService.setState({
      selectedMaterials: getSelectedMaterials(state),
      isAutofillEnabled: getIsAutofillEnabled(state),
      hasSubmittedCart: getHasSubmittedCart(state),
    });
  },
});
