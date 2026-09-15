import type { AppDispatch, RootState } from "@/app/store";
import type { ConfigurationSceneRestorer, SceneRestoreRequest, SceneRestoreResult } from "@/entities/configuration";
import { getActiveCollectionId, getCabinetEntries } from "@/entities/configuration/model/store/selectors";
import { dropValuesForCabinet, restoreCabinets } from "@/entities/configuration/model/store/slice";
import type { SceneSnapshot } from "@/entities/history/model/store/slice";
import { restoreProductState } from "@/entities/product/model/store/slice";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";
import { restoreSidePanelState } from "@/features/sidePanel";
import { createSceneRestorer } from "@/features/playCanvasAdapter/lib/createSceneRestorer";
import { getLoadedRuntimeBindings } from "@/features/playCanvasAdapter/lib/runtimeBindingsCache";
import {
  resolveRuntimeProductType,
  withRuntimeProductType,
} from "@/entities/product/lib/resolveRuntimeProductType";
import { collectPlacedDividersFromConfig } from "@/utils/functions/playcanvas/dividers";

function mapConfigToDrawerValue(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const normalized = value.trim();
  if (normalized === "1D" || normalized === "1") return "1";
  if (normalized === "2D" || normalized === "2") return "2";
  if (normalized === "1DWID" || normalized === "1+inner") return "1+inner";

  return null;
}

export type RestoreSnapshotDeps = {
  dispatch: AppDispatch;
  getState: () => RootState;
  /** Tests pass a stand-in; the app rebuilds the scene through the PlayCanvas adapter. */
  restorer?: ConfigurationSceneRestorer;
};

/** The products of a snapshot in composition order. A product without a config stays in, so preflight rejects it. */
export const buildSnapshotRestoreRequest = (snapshot: SceneSnapshot): SceneRestoreRequest => ({
  products: snapshot.productIds.map((sourceId) => {
    const config = snapshot.productConfigs[sourceId] ?? null;
    return { sourceId, productType: resolveRuntimeProductType(sourceId, config ?? undefined), config };
  }),
});

const createDefaultRestorer = (getState: () => RootState): ConfigurationSceneRestorer =>
  createSceneRestorer({
    getBindings: () => {
      const collectionId = getActiveCollectionId(getState());
      return collectionId ? getLoadedRuntimeBindings(collectionId) : null;
    },
  });

/**
 * Rebuilds the scene from a history snapshot and records what the scene actually holds.
 *
 * A snapshot the restorer rejects, or a scene that is not ready, changes nothing: neither the
 * scene nor the state. The caller moves the history only when the scene was rebuilt.
 */
export async function restoreSnapshot(
  snapshot: SceneSnapshot,
  { dispatch, getState, restorer = createDefaultRestorer(getState) }: RestoreSnapshotDeps,
): Promise<SceneRestoreResult> {
  const result = await restorer.restore(buildSnapshotRestoreRequest(snapshot));
  if (result.status === "not-ready" || result.status === "rejected") return result;

  const newProductIds = result.matches.map(({ runtimeId }) => runtimeId);
  const productIdMap = Object.fromEntries(result.matches.map(({ sourceId, runtimeId }) => [sourceId, runtimeId]));

  // Give the rebuilt products their stable keys back before the product ids change, so the
  // cabinet sync keeps the keys and the values addressed to them.
  const stableKeys = result.matches.map(({ sourceId }) => snapshot.cabinetKeys?.[sourceId]);
  if (newProductIds.length > 0 && stableKeys.every((key): key is string => typeof key === "string")) {
    // Values of a cabinet the rebuilt composition does not contain must not outlive it.
    const restoredKeys = new Set(stableKeys);
    getCabinetEntries(getState())
      .filter(({ stableKey }) => !restoredKeys.has(stableKey))
      .forEach(({ stableKey }) => dispatch(dropValuesForCabinet(stableKey)));

    dispatch(restoreCabinets({ stableKeys, runtimeIds: newProductIds }));
  }

  const restoredPlacedDividers: NonNullable<SceneSnapshot["placedDividers"]> = [];
  const restoredPlacedCabinetStyles: Record<string, string> = {};
  let restoredSelectedProductConfig: Record<string, unknown> | null = snapshot.selectedProductConfig ?? null;

  for (const { sourceId, runtimeId } of result.matches) {
    const config = snapshot.productConfigs[sourceId];
    if (!config) continue;

    const productConfig = withRuntimeProductType(config, resolveRuntimeProductType(sourceId, config));
    restoredPlacedDividers.push(...collectPlacedDividersFromConfig(runtimeId, productConfig));

    if (!restoredSelectedProductConfig) {
      restoredSelectedProductConfig = { ...productConfig };
    }

    const drawerRawValue = mapConfigToDrawerValue(productConfig.Drawers);
    if (drawerRawValue) {
      restoredPlacedCabinetStyles[runtimeId] = drawerRawValue;
    }
  }

  const placedDividers =
    restoredPlacedDividers.length > 0
      ? restoredPlacedDividers
      : snapshot.placedDividers?.flatMap((divider) => {
          const cabinetId = productIdMap[divider.cabinetId];
          return cabinetId ? [{ ...divider, cabinetId }] : [];
        });
  const productOptions = {
    ...snapshot.productOptions,
    VesselColor: snapshot.productOptions?.VesselColor ?? "",
  };

  dispatch(
    restoreProductState({
      productIds: newProductIds,
      productsPresets: snapshot.productsPresets?.map((preset) => ({ ...preset })),
      productOptions,
      activeCabinetType: snapshot.activeCabinetType,
      selectedDimensions: snapshot.selectedDimensions,
      placedDividers,
      selectedProductConfig: restoredSelectedProductConfig,
      placedCabinetStyles:
        Object.keys(restoredPlacedCabinetStyles).length > 0
          ? restoredPlacedCabinetStyles
          : (snapshot.placedCabinetStyles ?? {}),
    }),
  );

  // Re-apply global options to PlayCanvas since per-product getConfig may not include all settings
  const opts = snapshot.productOptions;
  const batchConfig: Record<string, unknown> = {};
  if (opts.CabinetColor) batchConfig.CabinetColor = opts.CabinetColor;
  if (opts.CountertopColor) batchConfig.CountertopColor = opts.CountertopColor;
  if (opts.HandleGrooveColor) batchConfig.HandleGrooveColor = opts.HandleGrooveColor;
  if (opts.sinkType) batchConfig.sinkType = opts.sinkType;
  if (opts.CountertopStyle) batchConfig.CountertopStyle = opts.CountertopStyle;
  if (opts.GrainDirection) batchConfig.GrainDirection = opts.GrainDirection;
  if (opts.DrawerPanelFluting) batchConfig.DrawerPanelFluting = opts.DrawerPanelFluting;

  if (newProductIds.length && Object.keys(batchConfig).length) {
    await setConfigBatch(newProductIds, batchConfig);
  }

  if (opts.Thickness) {
    await setConfigBatch({}, { Thickness: opts.Thickness });
  }

  // Re-apply TowelBar state to PlayCanvas.
  // TowelBars are global scene addons (not per-product), synced via
  // clear-then-add pattern (same as handleRemoveProducts/handleTowelBarChange).
  const towelOption = opts.TowelBarOption;
  await setConfigBatch({}, { TowelBar: "None", TowelBarSide: "both" });
  if (towelOption && towelOption !== "None") {
    await setConfigBatch({}, {
      TowelBar: "TowelBar40_R",
      TowelBarSide: towelOption.toLowerCase(),
    });
  }
  if (opts.TowelBarColor) {
    await setConfigBatch({}, { TowelBarColor: opts.TowelBarColor });
  }

  // Re-apply VesselColor to PlayCanvas (Sink-Base only).
  if (opts.VesselColor) {
    await setConfigBatch({ productType: "Sink-Base" }, { VesselColor: opts.VesselColor });
  }

  // Re-apply SidePanel state to PlayCanvas (per-side).
  await restoreSidePanelState(opts.SidePanels, opts.SidePanelLeft, opts.SidePanelRight, newProductIds.length);

  return result;
}
