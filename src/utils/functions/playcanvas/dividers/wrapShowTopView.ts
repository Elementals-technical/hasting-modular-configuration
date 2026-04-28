export type DrawerType = "Top" | "TopFull" | "Bot";

type ShowTopView = (cabinetId: string, drawerType: DrawerType) => unknown;
type OpenDrawer = (cabinetId: string, drawerType: DrawerType) => unknown;
type ExitTopView = () => unknown;

type WrapShowTopViewOptions = {
  onSelect: (cabinetId: string, drawerType: DrawerType) => void;
  onAfterSelect?: (cabinetId: string, drawerType: DrawerType) => void;
};

type ConfiguratorApiWithDrawerView = {
  showTopView?: ShowTopView;
  exitTopView?: ExitTopView;
  openDrawer?: OpenDrawer;
  __wrappedShowTopView?: boolean;
  __originalShowTopView?: ShowTopView;
  __showTopViewOnSelect?: WrapShowTopViewOptions["onSelect"];
  __showTopViewOnAfterSelect?: WrapShowTopViewOptions["onAfterSelect"];
  __activeDrawerCabinetId?: string;
  __activeDrawerType?: DrawerType;
};

declare global {
  interface Window {
    containerRef?: {
      current?: {
        contentWindow?: (Window & { ConfiguratorAPI?: ConfiguratorApiWithDrawerView }) | null;
      } | null;
    };
  }
}

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> =>
  (typeof value === "object" || typeof value === "function") &&
  value !== null &&
  "then" in value &&
  typeof value.then === "function";

export function wrapShowTopView({ onSelect, onAfterSelect }: WrapShowTopViewOptions): boolean {
  const containerRef = window.containerRef;
  const api = containerRef?.current?.contentWindow?.ConfiguratorAPI;

  if (!api?.showTopView) return false;

  api.__showTopViewOnSelect = onSelect;
  api.__showTopViewOnAfterSelect = onAfterSelect;

  if (api.__wrappedShowTopView) return true;

  api.__originalShowTopView = api.showTopView.bind(api);
  api.showTopView = (cabinetId, drawerType) => {
    api.__activeDrawerCabinetId = cabinetId;
    api.__activeDrawerType = drawerType;
    api.__showTopViewOnSelect?.(cabinetId, drawerType);

    // Keep animation-first flow: wait until openDrawer animation finishes, then enter top view.
    const openResult = api.openDrawer?.(cabinetId, drawerType);

    const runShowTopView = () => {
      const result = api.__originalShowTopView?.(cabinetId, drawerType);
      api.__showTopViewOnAfterSelect?.(cabinetId, drawerType);
      return result;
    };

    if (isPromiseLike(openResult)) {
      return openResult.then(runShowTopView, runShowTopView);
    }

    return runShowTopView();
  };
  api.__wrappedShowTopView = true;
  return true;
}
