import {
  normalizeRuntimeProductType,
  withRuntimeProductType,
} from "@/entities/product/lib/resolveRuntimeProductType";
import { type PresetProduct } from "@/entities/product/types";

export async function addPreset(presetProducts: PresetProduct[] = [], globalConfig?: Record<string, unknown>) {
  // @ts-ignore
  const containerRef = window.containerRef;
  const canvasIframe = containerRef?.current?.contentWindow as any;

  const addPreset = canvasIframe?.ConfiguratorAPI?.presetProducts;
  const runtimePresetProducts = presetProducts.map((product) => {
    const runtimeName = normalizeRuntimeProductType(product.name);

    return {
      ...withRuntimeProductType(product, runtimeName),
      name: runtimeName,
    };
  });

  console.log("call addPreset", addPreset);
  console.log("presetProducts", runtimePresetProducts);
  console.log("config", globalConfig);

  if (!addPreset) {
    console.warn("[PlayCanvas] ConfiguratorAPI.addPreset not ready");
    return null;
  }

  try {
    await addPreset(runtimePresetProducts, globalConfig);
  } catch (error) {
    console.error("[PlayCanvas] Failed to set width", error);
    return null;
  }
}
