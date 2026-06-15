const DRAWER_CLOSE_VIEWPORT_PADDING_PX = 28;

type DrawerCloseWidgetOptions = {
  onClick: (event: MouseEvent) => void;
};

const closeWidgetCleanups = new WeakMap<HTMLDivElement, () => void>();

const toFinitePx = (value: string): number | null => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const clampDrawerCloseWidgetToViewport = (
  parentEl: HTMLDivElement,
  viewportWidth: number,
  viewportHeight: number,
  viewportPadding = DRAWER_CLOSE_VIEWPORT_PADDING_PX,
): void => {
  const rect = parentEl.getBoundingClientRect();

  if (rect.width <= 0 || rect.height <= 0) return;

  const currentLeft = toFinitePx(parentEl.style.left);
  const currentTop = toFinitePx(parentEl.style.top);

  if (currentLeft === null || currentTop === null) return;

  let deltaX = 0;
  let deltaY = 0;

  if (rect.left < viewportPadding) {
    deltaX = viewportPadding - rect.left;
  } else if (rect.right > viewportWidth - viewportPadding) {
    deltaX = viewportWidth - viewportPadding - rect.right;
  }

  if (rect.top < viewportPadding) {
    deltaY = viewportPadding - rect.top;
  } else if (rect.bottom > viewportHeight - viewportPadding) {
    deltaY = viewportHeight - viewportPadding - rect.bottom;
  }

  if (deltaX !== 0) {
    parentEl.style.left = `${currentLeft + deltaX}px`;
  }

  if (deltaY !== 0) {
    parentEl.style.top = `${currentTop + deltaY}px`;
  }
};

const keepDrawerCloseWidgetInViewport = (parentEl: HTMLDivElement): void => {
  closeWidgetCleanups.get(parentEl)?.();

  const ownerWindow = parentEl.ownerDocument.defaultView;
  if (!ownerWindow) return;

  let animationFrameId: number | null = null;
  let observer: MutationObserver | null = null;

  const cleanup = () => {
    ownerWindow.removeEventListener("resize", scheduleClamp);
    if (animationFrameId !== null) {
      ownerWindow.cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    observer?.disconnect();
    observer = null;
  };

  const scheduleClamp = () => {
    if (animationFrameId !== null) return;

    animationFrameId = ownerWindow.requestAnimationFrame(() => {
      animationFrameId = null;

      if (!parentEl.isConnected) {
        cleanup();
        closeWidgetCleanups.delete(parentEl);
        return;
      }

      clampDrawerCloseWidgetToViewport(parentEl, ownerWindow.innerWidth, ownerWindow.innerHeight);
    });
  };

  observer = new MutationObserver(scheduleClamp);
  observer.observe(parentEl, { attributes: true, attributeFilter: ["style", "class"] });
  ownerWindow.addEventListener("resize", scheduleClamp);

  closeWidgetCleanups.set(parentEl, cleanup);

  scheduleClamp();
};

export function renderDrawerCloseWidget(parentEl: HTMLDivElement, { onClick }: DrawerCloseWidgetOptions): void {
  parentEl.innerHTML = "";
  parentEl.style.pointerEvents = "auto";

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Close";
  button.style.background = "#282828";
  button.style.color = "#fff";
  button.style.border = "none";
  button.style.borderRadius = "12px";
  button.style.padding = "4px 10px";
  button.style.cursor = "pointer";
  button.style.fontSize = "11px";
  button.addEventListener("click", onClick);

  parentEl.appendChild(button);
  keepDrawerCloseWidgetInViewport(parentEl);
}
