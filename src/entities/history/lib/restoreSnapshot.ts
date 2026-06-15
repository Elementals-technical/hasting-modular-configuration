import type { AppDispatch } from "@/app/store";
import type { SceneSnapshot } from "@/entities/history/model/store/slice";
import { restoreProductState } from "@/entities/product/model/store/slice";
import { removeAllProducts } from "@/utils/functions/playcanvas/removeAllProducts";
import { addProduct } from "@/utils/functions/playcanvas/addProduct";
import { setConfig } from "@/utils/functions/playcanvas/setConfig";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";
import { restoreSidePanelState } from "@/features/sidePanel";
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

export async function restoreSnapshot(snapshot: SceneSnapshot, dispatch: AppDispatch): Promise<void> {
  await removeAllProducts();

  const newProductIds: string[] = [];
  const productIdMap: Record<string, string> = {};
  const restoredPlacedDividers: NonNullable<SceneSnapshot["placedDividers"]> = [];
  const restoredPlacedCabinetStyles: Record<string, string> = {};
  let restoredSelectedProductConfig: Record<string, unknown> | null = snapshot.selectedProductConfig ?? null;

  for (const oldId of snapshot.productIds) {
    const config = snapshot.productConfigs[oldId];
    if (!config) continue;

    const productType = resolveRuntimeProductType(oldId, config);
    const productConfig = withRuntimeProductType(config, productType);
    const newId = await addProduct(productType, productConfig);

    if (newId) {
      await setConfig(newId, productConfig);
      newProductIds.push(newId);
      productIdMap[oldId] = newId;
      restoredPlacedDividers.push(...collectPlacedDividersFromConfig(newId, productConfig));

      if (!restoredSelectedProductConfig) {
        restoredSelectedProductConfig = { ...productConfig };
      }

      const drawerRawValue = mapConfigToDrawerValue(productConfig.Drawers);
      if (drawerRawValue) {
        restoredPlacedCabinetStyles[newId] = drawerRawValue;
      }
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
}
