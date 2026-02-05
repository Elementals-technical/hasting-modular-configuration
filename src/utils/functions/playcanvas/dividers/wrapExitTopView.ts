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
        __wrappedExitTopView?: boolean;
      }
    | undefined;

  if (!api?.exitTopView) return null;

  if (!api.__wrappedExitTopView) {
    const originalExitTopView = api.exitTopView.bind(api);
    api.exitTopView = () => {
      if (onExit) onExit();
      return originalExitTopView();
    };
    api.__wrappedExitTopView = true;
  }

  return api.exitTopView.bind(api);
}
