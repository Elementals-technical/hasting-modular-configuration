export type DrawerType = "Top" | "TopFull" | "Bot";

type ShowTopView = (cabinetId: string, drawerType: DrawerType) => unknown;

type WrapShowTopViewOptions = {
  onSelect: (cabinetId: string, drawerType: DrawerType) => void;
  onAfterSelect?: (cabinetId: string, drawerType: DrawerType) => void;
};

export function wrapShowTopView({ onSelect, onAfterSelect }: WrapShowTopViewOptions): boolean {
  // @ts-ignore
  const containerRef = window.containerRef;
  const api = containerRef?.current?.contentWindow?.ConfiguratorAPI as
    | {
        showTopView?: ShowTopView;
        openDrawer?: (cabinetId: string, drawerType: DrawerType) => unknown;
        __wrappedShowTopView?: boolean;
        __activeDrawerCabinetId?: string;
        __activeDrawerType?: DrawerType;
      }
    | undefined;

  if (!api?.showTopView || api.__wrappedShowTopView) return false;

  const originalShowTopView = api.showTopView.bind(api);
  api.showTopView = (cabinetId, drawerType) => {
    api.__activeDrawerCabinetId = cabinetId;
    api.__activeDrawerType = drawerType;
    onSelect(cabinetId, drawerType);
    // Keep animation-first flow: wait until openDrawer animation finishes, then enter top view.
    const openResult = api.openDrawer?.(cabinetId, drawerType) as unknown;
    const maybePromise = openResult as Promise<unknown> | undefined;
    const isThenable = !!maybePromise && typeof maybePromise.then === "function";

    const runShowTopView = () => {
      const result = originalShowTopView(cabinetId, drawerType);
      if (onAfterSelect) {
        onAfterSelect(cabinetId, drawerType);
      }
      return result;
    };

    if (isThenable) {
      return maybePromise.catch(() => null).then(runShowTopView);
    }

    return runShowTopView();
  };
  api.__wrappedShowTopView = true;
  return true;
}
