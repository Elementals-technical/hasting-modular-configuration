type DrawerType = "Top" | "TopFull" | "Bot";

export type DrawerWidgetInfo = {
  cabinetId: string;
  drawerType: DrawerType;
  hasOccupiedDividers: boolean;
  dividerCount: number;
  dividerTypes: string[];
};

type DrawerWidgetRenderCallback = (drawerInfo: DrawerWidgetInfo, parentEl: HTMLDivElement) => void;
type DrawerCloseWidgetRenderCallback = (drawerInfo: DrawerWidgetInfo, parentEl: HTMLDivElement) => void;

function getConfiguratorAPI() {
  // @ts-ignore
  const containerRef = window.containerRef;
  return containerRef?.current?.contentWindow?.ConfiguratorAPI as
    | {
        onDrawerWidgetRender?: ((callback: DrawerWidgetRenderCallback | null) => unknown) | null;
        onDrawerCloseWidgetRender?: ((callback: DrawerCloseWidgetRenderCallback | null) => unknown) | null;
      }
    | undefined;
}

export function onDrawerWidgetRender(callback: DrawerWidgetRenderCallback | null) {
  const api = getConfiguratorAPI();
  const apiMethod = api?.onDrawerWidgetRender;

  if (!apiMethod) {
    console.warn("[PlayCanvas] ConfiguratorAPI.onDrawerWidgetRender not ready");
    return null;
  }

  try {
    return apiMethod(callback);
  } catch (error) {
    console.error("[PlayCanvas] Failed to call onDrawerWidgetRender", error);
    return null;
  }
}

export function onDrawerCloseWidgetRender(callback: DrawerCloseWidgetRenderCallback | null) {
  const api = getConfiguratorAPI();
  const apiMethod = api?.onDrawerCloseWidgetRender;

  if (!apiMethod) {
    console.warn("[PlayCanvas] ConfiguratorAPI.onDrawerCloseWidgetRender not ready");
    return null;
  }

  try {
    return apiMethod(callback);
  } catch (error) {
    console.error("[PlayCanvas] Failed to call onDrawerCloseWidgetRender", error);
    return null;
  }
}

