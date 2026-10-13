import type { RootState } from "@/app/store";
import type { SceneLayout } from "@/entities/configuration";
import {
  getActiveCollectionId,
  getCabinetEntries,
  getConfigurationSnapshot,
} from "@/entities/configuration/model/store/selectors";
import type { SceneSnapshot } from "@/entities/history/model/store/slice";
import { getOrderedProductIds } from "@/utils/functions/playcanvas/getOrderedProductIds";
import { getConfig } from "@/utils/functions/playcanvas/getConfig";

import { getSceneLayoutCapture, type SceneLayoutCapture } from "./sceneLayoutCapture";

export type CaptureSnapshotDeps = {
  /** Reads where the products stand; null leaves the snapshot without a layout. */
  captureLayout?: SceneLayoutCapture | null;
};

/**
 * The layout of the products the snapshot holds. A layout of other products (the scene changed
 * between the two reads) is dropped: restoring it would put back another composition.
 */
const readLayout = async (
  captureLayout: SceneLayoutCapture | null,
  collectionId: string | null,
  ids: readonly string[],
): Promise<SceneLayout | null> => {
  if (!captureLayout || ids.length === 0) return null;

  try {
    const layout = await captureLayout(collectionId);
    if (!layout) return null;

    const captured = new Set(Object.values(layout.cabinetIds));
    return captured.size === ids.length && ids.every((id) => captured.has(id)) ? layout : null;
  } catch {
    return null;
  }
};

export async function captureSnapshot(
  getState: () => RootState,
  { captureLayout = getSceneLayoutCapture() }: CaptureSnapshotDeps = {},
): Promise<SceneSnapshot> {
  const state = getState().rootStateUI.product;

  const ids = getOrderedProductIds(state.productIds);

  const configs: Record<string, Record<string, unknown>> = {};
  for (const id of ids) {
    const config = await getConfig(id);
    if (config) {
      configs[id] = config;
    }
  }

  const sceneLayout = await readLayout(captureLayout, getActiveCollectionId(getState()), ids);

  return {
    productIds: ids,
    productConfigs: configs,
    ...(sceneLayout ? { sceneLayout } : {}),
    cabinetKeys: Object.fromEntries(
      getCabinetEntries(getState()).map(({ runtimeId, stableKey }) => [runtimeId, stableKey]),
    ),
    configuration: getConfigurationSnapshot(getState()),
    productsPresets: state.productsPresets.map((preset) => ({ ...preset })),
    productOptions: { ...state.productOptions },
    activeCabinetType: state.activeCabinetType,
    selectedDimensions: { ...state.selectedDimensions },
    placedDividers: [...state.placedDividers],
    selectedProductConfig: state.selectedProductConfig ? { ...state.selectedProductConfig } : null,
    placedCabinetStyles: { ...state.placedCabinetStyles },
  };
}
