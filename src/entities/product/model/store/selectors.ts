import type { RootState } from "@/app/store";

export const getActiveCabinetType = (state: RootState) => state.rootStateUI.product.activeCabinetType;

export const getCabinetCatalog = (state: RootState) => state.rootStateUI.product.cabinetCatalog;

export const getActiveCabinetRule = (state: RootState) => {
  const activeCode = state.rootStateUI.product.activeCabinetType;
  if (!activeCode) return null;

  return state.rootStateUI.product.cabinetCatalog.typeCabinetRules.find((rule) => rule.code === activeCode) ?? null;
};

export const getDimensionOptions = (state: RootState) => state.rootStateUI.product.dimensionOptions;

export const getSelectedDimensions = (state: RootState) => state.rootStateUI.product.selectedDimensions;

export const getHasBootstrappedCabinetBuilder = (state: RootState) =>
  state.rootStateUI.product.hasBootstrappedCabinetBuilder;

export const getSelectedProducts = (state: RootState) => state.rootStateUI.product.productIds;

export const getDrawerProduct = (state: RootState) => state.rootStateUI.product.activeDrawerProduct;

export const getSelectedProductConfig = (state: RootState) => state.rootStateUI.product.selectedProductConfig;

export const getCabinetColor = (state: RootState) => state.rootStateUI.product.productOptions.CabinetColor;

export const getCabinetColorSku = (state: RootState) => state.rootStateUI.product.productOptions.CabinetColorSku;

export const getCabinetColorMaterial = (state: RootState) =>
  state.rootStateUI.product.productOptions.CabinetColorMaterial;

export const getCabinetColorFinish = (state: RootState) => state.rootStateUI.product.productOptions.CabinetColorFinish;

export const getHandleGrooveColor = (state: RootState) => state.rootStateUI.product.productOptions.HandleGrooveColor;

export const getHandleGrooveColorSku = (state: RootState) =>
  state.rootStateUI.product.productOptions.HandleGrooveColorSku;

export const getSinkType = (state: RootState) => state.rootStateUI.product.productOptions.sinkType;

export const getProductsPresets = (state: RootState) => state.rootStateUI.product.productsPresets;

export const getSelectedSceneProduct = (state: RootState) => state.rootStateUI.product.selectedSceneProduct;

export const getIsDrawerOpen = (state: RootState) => state.rootStateUI.product.isDrawerOpen;

export const getActiveCountertopColor = (state: RootState) => state.rootStateUI.product.productOptions.CountertopColor;

export const getCountertopColorSku = (state: RootState) => state.rootStateUI.product.productOptions.CountertopColorSku;

export const getActiveCountertopThickness = (state: RootState) => state.rootStateUI.product.productOptions.Thickness;

export const getDrawerPanelFluting = (state: RootState) => state.rootStateUI.product.productOptions.DrawerPanelFluting;

export const getGrainDirection = (state: RootState) => state.rootStateUI.product.productOptions.GrainDirection;

export const getBookMatching = (state: RootState) => state.rootStateUI.product.productOptions.BookMatching;

export const getCountertopStyle = (state: RootState) => state.rootStateUI.product.productOptions.CountertopStyle;

export const getSidePanelsOption = (state: RootState) => state.rootStateUI.product.productOptions.SidePanels;

export const getLedOption = (state: RootState) => state.rootStateUI.product.productOptions.LedOption;

export const getDividersOption = (state: RootState) => state.rootStateUI.product.productOptions.DividersOption;

export const getDividersStyle = (state: RootState) => state.rootStateUI.product.productOptions.DividersStyle;

export const getPlacedDividers = (state: RootState) => state.rootStateUI.product.placedDividers;

export const getPlacedCabinetStyles = (state: RootState) => state.rootStateUI.product.placedCabinetStyles;

/** Returns which drawer group currently dominates the scene.
 *  "single" = at least one 1DW or 1DWID placed (no 2DW)
 *  "double" = at least one 2DW placed
 *  null     = nothing placed yet (or all OS/OSS)
 */
export const getDominantDrawerGroup = (state: RootState): "single" | "double" | null => {
  const styles = Object.values(state.rootStateUI.product.placedCabinetStyles);
  if (styles.length === 0) return null;
  if (styles.some((v) => v === "2")) return "double";
  if (styles.some((v) => v === "1" || v === "1+inner")) return "single";
  return null;
};

export const getTowelBarOption = (state: RootState) => state.rootStateUI.product.productOptions.TowelBarOption;

export const getTowelBarColor = (state: RootState) => state.rootStateUI.product.productOptions.TowelBarColor;

export const getFaucetHolesAmount = (state: RootState) => state.rootStateUI.product.productOptions.FaucetHolesAmount;

export const getFaucetHolesSpacing = (state: RootState) => state.rootStateUI.product.productOptions.FaucetHolesSpacing;

export const getPriceBySku = (state: RootState) => state.rootStateUI.priceStore.skuPrices;

export const getPriceTotal = (state: RootState) => state.rootStateUI.priceStore.total;

export const getActiveSkus = (state: RootState) => state.rootStateUI.priceStore.activeSkus;

export const getPriceLoading = (state: RootState) => state.rootStateUI.priceStore.isLoading;

// For attention popup in the prebuilt path.
export const getHasPrebuiltSelections = (state: RootState) => {
  const options = state.rootStateUI.product.productOptions;

  return (
    options.CabinetColor !== "Ardesia DD GL" ||
    options.sinkType !== "Top_HPLPrisma" ||
    options.CountertopColor !== "Rosso Rubino 19 MT" ||
    options.HandleGrooveColor !== "Blu Pavone A6 MT" ||
    options.Handle !== "" ||
    options.Thickness !== "" ||
    options.DrawerPanelFluting !== "" ||
    options.GrainDirection !== "" ||
    options.BookMatching !== "" ||
    options.CountertopStyle !== "" ||
    options.SidePanels !== "" ||
    options.LedOption !== "" ||
    options.DividersOption !== "" ||
    options.DividersStyle !== "" ||
    options.TowelBarOption !== "None" ||
    options.TowelBarColor !== "" ||
    options.FaucetHolesAmount !== "" ||
    options.FaucetHolesSpacing !== '4"'
  );
};
