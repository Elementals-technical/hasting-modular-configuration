type ShouldUsePresetProductsParams = {
  productsPresetsCount: number;
  productIdsCount: number;
  sceneConfigsCount: number;
  hasBootstrappedCabinetBuilder: boolean;
};

export const shouldUsePresetProducts = ({
  productsPresetsCount,
  productIdsCount,
  sceneConfigsCount,
  hasBootstrappedCabinetBuilder,
}: ShouldUsePresetProductsParams) => {
  const hasPresets = productsPresetsCount > 0;
  if (!hasPresets) return false;

  const presetsStale = productIdsCount > 0 && productIdsCount < productsPresetsCount;
  if (presetsStale) return false;

  // In bootstrapped custom flow the live scene becomes the authoritative source
  // as soon as PlayCanvas configs are available.
  if (hasBootstrappedCabinetBuilder && sceneConfigsCount > 0) {
    return false;
  }

  return true;
};
