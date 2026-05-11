import {
  normalizeRuntimeProductType,
  withRuntimeProductType,
} from "@/entities/product/lib/resolveRuntimeProductType";

export interface addProductConfigI {
  Height: number;
  Depth: number;
  CabinetColor: string;
  Width: number;
  SidePanel?: string;
  sinkType?: string;
  [key: string]: unknown;
}

// Return product and its ID
export async function addProduct(name: string, config?: Record<string, unknown>) {
  // @ts-ignore
  const containerRef = window.containerRef;
  const canvasIframe = containerRef?.current?.contentWindow as any;

  const addProduct = canvasIframe?.ConfiguratorAPI?.addProduct;
  const runtimeName = normalizeRuntimeProductType(name);
  const runtimeConfig = config ? withRuntimeProductType(config, runtimeName) : undefined;

  console.log("call addProduct", addProduct);
  console.log("name", runtimeName);

  if (!addProduct) {
    console.warn("[PlayCanvas] ConfiguratorAPI.addProduct not ready");
    return null;
  }

  try {
    const productId = await addProduct(runtimeName, runtimeConfig);
    console.log(productId);

    return productId;
  } catch (error) {
    console.error("[PlayCanvas] Failed to set width", error);
    return null;
  }
}
