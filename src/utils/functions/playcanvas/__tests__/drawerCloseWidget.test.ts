// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { clampDrawerCloseWidgetToViewport } from "../drawerCloseWidget";

const createWidget = (left: number, top: number, width: number, height: number): HTMLDivElement => {
  const element = document.createElement("div");
  element.style.left = `${left}px`;
  element.style.top = `${top}px`;

  vi.spyOn(element, "getBoundingClientRect").mockImplementation(() =>
    DOMRect.fromRect({ x: left, y: top, width, height }),
  );

  return element;
};

describe("clampDrawerCloseWidgetToViewport", () => {
  it("moves a bottom-overflowing close widget inside the viewport", () => {
    const element = createWidget(362, 933, 48, 20);

    clampDrawerCloseWidgetToViewport(element, 770, 900);

    expect(element.style.left).toBe("362px");
    expect(element.style.top).toBe("852px");
  });

  it("moves a right-overflowing close widget inside the viewport", () => {
    const element = createWidget(750, 100, 48, 20);

    clampDrawerCloseWidgetToViewport(element, 770, 900);

    expect(element.style.left).toBe("694px");
    expect(element.style.top).toBe("100px");
  });

  it("keeps an already visible close widget unchanged", () => {
    const element = createWidget(362, 737, 48, 20);

    clampDrawerCloseWidgetToViewport(element, 770, 900);

    expect(element.style.left).toBe("362px");
    expect(element.style.top).toBe("737px");
  });
});
