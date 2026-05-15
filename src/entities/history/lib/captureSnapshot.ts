import type { RootState } from "@/app/store";
import type { SceneSnapshot } from "@/entities/history/model/store/slice";
import { getOrderedProductIds } from "@/utils/functions/playcanvas/getOrderedProductIds";
import { getConfig } from "@/utils/functions/playcanvas/getConfig";

export async function captureSnapshot(getState: () => RootState): Promise<SceneSnapshot> {
  const state = getState().rootStateUI.product;

  const ids = getOrderedProductIds(state.productIds);

  const configs: Record<string, Record<string, unknown>> = {};
  for (const id of ids) {
    const config = await getConfig(id);
    if (config) {
      configs[id] = config;
    }
  }

  return {
    productIds: ids,
    productConfigs: configs,
    productsPresets: state.productsPresets.map((preset) => ({ ...preset })),
    productOptions: { ...state.productOptions },
    activeCabinetType: state.activeCabinetType,
    selectedDimensions: { ...state.selectedDimensions },
    placedDividers: [...state.placedDividers],
    selectedProductConfig: state.selectedProductConfig ? { ...state.selectedProductConfig } : null,
    placedCabinetStyles: { ...state.placedCabinetStyles },
  };
}
