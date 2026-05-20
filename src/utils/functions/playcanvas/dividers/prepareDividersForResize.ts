import {
  sanitizePlayCanvasMeshInstances,
  watchPlayCanvasMeshInstancesDuringRender,
} from "@/utils/functions/playcanvas/sanitizeMeshInstances";

type DrawerType = "Top" | "TopFull" | "Bot";

type EmptyDividerZones = {
  zones: Record<string, never>;
};

export type ResetDividersConfig = {
  TopDrawerDividers: EmptyDividerZones;
  BotDrawerDividers: EmptyDividerZones;
};

type ConfiguratorApi = {
  closeDrawer?: (cabinetId: string, drawerType: DrawerType) => unknown;
  exitTopView?: () => unknown;
  setVisibleDividerSlotButtons?: (visible: boolean) => unknown;
  setVisibleDrawerButtons?: (visible: boolean) => unknown;
  __activeDrawerCabinetId?: string;
  __activeDrawerType?: DrawerType;
  dividers?: {
    showIconDividerSlots?: (cabinetId: string, drawerType: DrawerType, show?: boolean) => unknown;
  };
};

type WindowWithContainerRef = Window & {
  containerRef?: {
    current?: HTMLIFrameElement | null;
  };
};

type PlayCanvasWindow = Window & {
  ConfiguratorAPI?: ConfiguratorApi;
};

const DRAWER_TYPES: DrawerType[] = ["Top", "TopFull", "Bot"];
const RENDER_SETTLE_FRAME_COUNT = 2;

const getConfiguratorApi = (): ConfiguratorApi | null => {
  const containerRef = (window as WindowWithContainerRef).containerRef;
  const contentWindow = containerRef?.current?.contentWindow as PlayCanvasWindow | null | undefined;
  return contentWindow?.ConfiguratorAPI ?? null;
};

const waitForRenderFrame = (): Promise<void> =>
  new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });

const waitForRenderSettlement = async (): Promise<void> => {
  for (let frame = 0; frame < RENDER_SETTLE_FRAME_COUNT; frame += 1) {
    await waitForRenderFrame();
  }
};

export const buildResetDividersConfig = (): ResetDividersConfig => ({
  TopDrawerDividers: { zones: {} },
  BotDrawerDividers: { zones: {} },
});

export const prepareCabinetDividersForResize = async (cabinetId: string): Promise<void> => {
  const api = getConfiguratorApi();
  if (!api) return;

  watchPlayCanvasMeshInstancesDuringRender();

  const activeDrawerType = api.__activeDrawerCabinetId === cabinetId ? api.__activeDrawerType : undefined;

  await Promise.resolve(api.setVisibleDividerSlotButtons?.(false));
  await Promise.resolve(api.setVisibleDrawerButtons?.(false));

  for (const drawerType of DRAWER_TYPES) {
    await Promise.resolve(api.dividers?.showIconDividerSlots?.(cabinetId, drawerType, false));
  }

  sanitizePlayCanvasMeshInstances();

  await Promise.resolve(api.exitTopView?.());
  sanitizePlayCanvasMeshInstances();

  for (const drawerType of DRAWER_TYPES) {
    if (drawerType === activeDrawerType) continue;
    await Promise.resolve(api.closeDrawer?.(cabinetId, drawerType));
    sanitizePlayCanvasMeshInstances();
  }

  await waitForRenderSettlement();
  sanitizePlayCanvasMeshInstances();
};
