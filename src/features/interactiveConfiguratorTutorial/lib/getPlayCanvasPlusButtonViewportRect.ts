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

const getRightmostElement = (elements: HTMLElement[]): HTMLElement | null =>
  elements.reduce<HTMLElement | null>((rightmostElement, element) => {
    if (!rightmostElement) return element;

    return element.getBoundingClientRect().right > rightmostElement.getBoundingClientRect().right
      ? element
      : rightmostElement;
  }, null);

export const getPlayCanvasPlusButtonViewportRect = (): ViewportRect | null => {
  const containerRef = (window as WindowWithPlayCanvasContainer).containerRef;
  const iframe = containerRef?.current;
  const contentWindow = iframe?.contentWindow;
  const document = iframe?.contentDocument ?? contentWindow?.document;

  if (!iframe || !contentWindow || !document) return null;

  const visibleButtons = Array.from(document.querySelectorAll<HTMLElement>(PLAYCANVAS_PLUS_BUTTON_SELECTOR)).filter(
    (element) => isVisibleElement(element, contentWindow),
  );
  const button = getRightmostElement(visibleButtons);

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
