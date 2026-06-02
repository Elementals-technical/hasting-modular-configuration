type ViewportRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type WindowWithPlayCanvasContainer = Window & {
  containerRef?: {
    current?: HTMLIFrameElement | null;
  };
};

const PLAYCANVAS_PLUS_BUTTON_SELECTOR = ".ap-plus-btn";

const isVisibleElement = (element: HTMLElement, contentWindow: Window): boolean => {
  const style = contentWindow.getComputedStyle(element);
  const rect = element.getBoundingClientRect();

  return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
};

export const getPlayCanvasPlusButtonViewportRect = (): ViewportRect | null => {
  const containerRef = (window as WindowWithPlayCanvasContainer).containerRef;
  const iframe = containerRef?.current;
  const contentWindow = iframe?.contentWindow;
  const document = iframe?.contentDocument ?? contentWindow?.document;

  if (!iframe || !contentWindow || !document) return null;

  const button = Array.from(document.querySelectorAll<HTMLElement>(PLAYCANVAS_PLUS_BUTTON_SELECTOR)).find((element) =>
    isVisibleElement(element, contentWindow),
  );

  if (!button) return null;

  const iframeRect = iframe.getBoundingClientRect();
  const buttonRect = button.getBoundingClientRect();

  return {
    top: iframeRect.top + buttonRect.top,
    left: iframeRect.left + buttonRect.left,
    width: buttonRect.width,
    height: buttonRect.height,
  };
};
