import type { AppDispatch } from "@/app/store";
import type { SceneSnapshot } from "@/entities/history/model/store/slice";
import { restoreProductState } from "@/entities/product/model/store/slice";
import { removeAllProducts } from "@/utils/functions/playcanvas/removeAllProducts";
import { addProduct } from "@/utils/functions/playcanvas/addProduct";
import { setConfig } from "@/utils/functions/playcanvas/setConfig";

function resolveProductType(productId: string, config: Record<string, unknown>): string {
  const configProductType = typeof config?.productType === "string" ? config.productType : null;
  if (configProductType) return normalizeProductType(configProductType, productId);

  const configEntityName = typeof config?.entityName === "string" ? config.entityName : null;
  if (configEntityName) return normalizeProductType(configEntityName, productId);

  const lastDash = productId.lastIndexOf("-");
  if (lastDash > 0) {
    return productId.slice(0, lastDash);
  }

  return productId;
}

function normalizeProductType(value: string, productId: string): string {
  const lastDash = value.lastIndexOf("-");
  if (lastDash > 0) {
    const suffix = value.slice(lastDash + 1);
    if (suffix.length >= 6) {
      return value.slice(0, lastDash);
    }
  }

  if (value === productId) {
    const idLastDash = productId.lastIndexOf("-");
    if (idLastDash > 0) {
      const idSuffix = productId.slice(idLastDash + 1);
      if (idSuffix.length >= 6) {
        return productId.slice(0, idLastDash);
      }
    }
  }

  return value;
}

export async function restoreSnapshot(snapshot: SceneSnapshot, dispatch: AppDispatch): Promise<void> {
  await removeAllProducts();

  const newProductIds: string[] = [];

  for (const oldId of snapshot.productIds) {
    const config = snapshot.productConfigs[oldId];
    if (!config) continue;

    const productType = resolveProductType(oldId, config);
    const newId = await addProduct(productType, config as any);

    if (newId) {
      await setConfig(newId, config);
      newProductIds.push(newId);
    }
  }

  dispatch(
    restoreProductState({
      productIds: newProductIds,
      productOptions: snapshot.productOptions,
      activeCabinetType: snapshot.activeCabinetType,
      selectedDimensions: snapshot.selectedDimensions,
    }),
  );
}
