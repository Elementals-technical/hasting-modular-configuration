import type { DrawerType } from "./wrapShowTopView";

type WrapExitTopViewOptions = {
  onExit?: () => void;
};

type ExitTopView = () => unknown;

export function wrapExitTopView({ onExit }: WrapExitTopViewOptions): ExitTopView | null {
  // @ts-ignore
  const containerRef = window.containerRef;
  const api = containerRef?.current?.contentWindow?.ConfiguratorAPI as
    | {
        exitTopView?: ExitTopView;
        closeDrawer?: (cabinetId: string, drawerType: DrawerType) => unknown;
        __wrappedExitTopView?: boolean;
        __exitTopViewOnExit?: (() => void) | null;
        __activeDrawerCabinetId?: string;
        __activeDrawerType?: DrawerType;
      }
    | undefined;

  if (!api?.exitTopView) return null;

  if (onExit) {
    api.__exitTopViewOnExit = onExit;
  }

  if (!api.__wrappedExitTopView) {
    const originalExitTopView = api.exitTopView.bind(api);
    api.exitTopView = () => {
      const cabinetId = api.__activeDrawerCabinetId;
      const drawerType = api.__activeDrawerType;
      api.__activeDrawerCabinetId = undefined;
      api.__activeDrawerType = undefined;
      if (cabinetId && drawerType) {
        api.closeDrawer?.(cabinetId, drawerType);
      }
      api.__exitTopViewOnExit?.();
      return originalExitTopView();
    };
    api.__wrappedExitTopView = true;
  }

  return api.exitTopView.bind(api);
}
