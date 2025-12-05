import { setProducts } from "./setProducts";

export const removeAllProducts = () => {
  const api = setProducts();

  if (!api?.removeAllProduct) {
    console.warn("[PlayCanvas] ConfiguratorAPI.removeAllProduct not ready");
    return;
  }

  try {
    api.removeAllProduct();
  } catch (error) {
    console.error("[PlayCanvas] Failed to remove all products", error);
  }
};
