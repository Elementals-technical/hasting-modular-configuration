import type { ScreenBox } from "./screenGeometry";

type WindowWithSceneContainer = Window & {
  containerRef?: {
    current?: HTMLIFrameElement | null;
  };
};

/** The scene's `CountertopEditOverlay` button, drawn over a lifted top inside the iframe. */
const EDIT_SIZE_BUTTON_SELECTOR = ".countertop-edit-size-button";

// The scene hides the button through its own `display` or its layer's, which leaves the button 0 × 0.
const isVisibleElement = (element: HTMLElement, contentWindow: Window): boolean => {
  const style = contentWindow.getComputedStyle(element);
  const rect = element.getBoundingClientRect();

  return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
};

/**
 * The scene's Edit size button in iframe px, or `null` when the iframe, its document or a visible
 * button is missing. No iframe offset is added: the countertop overlay layer covers the iframe 1:1.
 */
export const readEditSizeButtonRect = (): ScreenBox | null => {
  const iframe = (window as WindowWithSceneContainer).containerRef?.current;
  const contentWindow = iframe?.contentWindow;
  const document = iframe?.contentDocument ?? contentWindow?.document;

  if (!contentWindow || !document) return null;

  const button = Array.from(document.querySelectorAll<HTMLElement>(EDIT_SIZE_BUTTON_SELECTOR)).find((element) =>
    isVisibleElement(element, contentWindow),
  );

  if (!button) return null;

  const { left, top, right, bottom } = button.getBoundingClientRect();
  return { left, top, right, bottom };
};
