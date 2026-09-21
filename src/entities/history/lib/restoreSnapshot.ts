import type { AppDispatch, RootState } from "@/app/store";
import type {
  AttributeValue,
  ConfigurationSceneRestorer,
  SceneRestoreRequest,
  SceneRestoreResult,
} from "@/entities/configuration";
import type { RuntimeBindingSet } from "@/entities/collection";
import { getCabinetEntries } from "@/entities/configuration/model/store/selectors";
import { dropValuesForCabinet, restoreCabinets } from "@/entities/configuration/model/store/slice";
import type { SceneSnapshot } from "@/entities/history/model/store/slice";
import { restoreProductState } from "@/entities/product/model/store/slice";
import { restoreSidePanelState } from "@/features/sidePanel";
import { createSceneRestorer } from "@/features/playCanvasAdapter/lib/createSceneRestorer";
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
  /** Runtime bindings of the active collection, for the default restorer's preflight. */
  getBindings: () => RuntimeBindingSet | null;
  /** Tests pass a stand-in; the app rebuilds the scene through the PlayCanvas adapter. */
  restorer?: ConfigurationSceneRestorer;
  /**
   * Shows the snapshot's configuration values on the rebuilt products. The command service
   * sends them through the runtime port (C06); the state already holds them, so they are
   * not recorded again.
   */
  replay: (values: Readonly<Record<string, AttributeValue>>) => Promise<unknown>;
};

/** Configuration values a product's own config may not carry, so the scene is given them again. */
const REPLAYED_OPTIONS = [
  "CabinetColor",
  "CountertopColor",
  "HandleGrooveColor",
  "sinkType",
  "CountertopStyle",
  "GrainDirection",
  "DrawerPanelFluting",
  "Thickness",
  "TowelBarColor",
  "VesselColor",
] as const;

/**
 * The values to show on the rebuilt scene. An empty value is left out, as the products keep
 * their own; the towel bar is always sent, since it is a scene add-on no product config carries.
 */
export const buildSnapshotReplayValues = (snapshot: SceneSnapshot): Record<string, AttributeValue> => {
  const options = snapshot.productOptions;
  const values: Record<string, AttributeValue> = {};

  for (const attributeId of REPLAYED_OPTIONS) {
    const value = options[attributeId];
    if (typeof value === "string" && value) values[attributeId] = value;
  }

  values.TowelBarOption = options.TowelBarOption || "None";
  return values;
};

/** The products of a snapshot in composition order. A product without a config stays in, so preflight rejects it. */
export const buildSnapshotRestoreRequest = (snapshot: SceneSnapshot): SceneRestoreRequest => ({
  products: snapshot.productIds.map((sourceId) => {
    const config = snapshot.productConfigs[sourceId] ?? null;
    return { sourceId, productType: resolveRuntimeProductType(sourceId, config ?? undefined), config };
  }),
});

/**
 * Rebuilds the scene from a history snapshot and records what the scene actually holds.
 *
 * A snapshot the restorer rejects, or a scene that is not ready, changes nothing: neither the
 * scene nor the state. The caller moves the history only when the scene was rebuilt.
 */
export async function restoreSnapshot(
  snapshot: SceneSnapshot,
  { dispatch, getState, getBindings, restorer = createSceneRestorer({ getBindings }), replay }: RestoreSnapshotDeps,
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

  // Per-product configs may not carry every configuration value, so they are shown again.
  await replay(buildSnapshotReplayValues(snapshot));

  // Re-apply SidePanel state to PlayCanvas (per-side).
  const { SidePanels, SidePanelLeft, SidePanelRight } = snapshot.productOptions;
  await restoreSidePanelState(SidePanels, SidePanelLeft, SidePanelRight, newProductIds.length);

  return result;
}
