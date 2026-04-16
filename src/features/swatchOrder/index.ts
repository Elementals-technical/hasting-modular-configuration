export { SwatchOrder } from "./ui/SwatchOrder";
export {
  openSwatchOrder,
  closeSwatchOrder,
  setSelectedMaterial,
  removeItem,
  setCartMaterials,
  markCartSubmitted,
  setSwatchesEnabledInSummary,
  setAutofillEnabled,
  swatchOrderReducer,
} from "./model/store/slice";
export {
  getIsSwatchOrderOpen,
  getActiveProductElement,
  getSelectedMaterials,
  getManualSelectedMaterials,
  getIsSwatchesEnabledInSummary,
  getIsAutofillEnabled,
  getHasSubmittedCart,
  getIsSwatchesVisibleInSummary,
  getAllMaterialValues,
  getProductElementOptions,
  getMaterialSelectStateFilters,
} from "./model/store/selectors";
export { swatchOrderPersistListener } from "./model/store/persistListener";
export { toSwatchPreview, type SwatchPreview } from "./lib/toSwatchPreview";
export { adaptThreekitConfig } from "./lib/adaptThreekitConfig";
export {
  deriveAutofillMaterials,
  mergeAutofillWithSelectedMaterials,
  areSameMaterialLists,
} from "./lib/deriveAutofillMaterials";
export { MAX_SLOTS } from "./model/constants";
export type { AttributeValue, IThreekitConfiguration, IMaterialMetadata } from "./model/types";
