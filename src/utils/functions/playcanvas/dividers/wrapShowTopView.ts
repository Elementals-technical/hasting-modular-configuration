export type DrawerType = "Top" | "Bot";

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
    if (onAfterSelect) {
      onAfterSelect(cabinetId, drawerType);
    }
    api.openDrawer?.(cabinetId, drawerType);
    return originalShowTopView(cabinetId, drawerType);
  };
  api.__wrappedShowTopView = true;
  return true;
}
