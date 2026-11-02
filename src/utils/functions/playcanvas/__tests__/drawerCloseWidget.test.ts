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

  it("keeps Close above the parent canvas toolbar that overlaps the iframe", () => {
    const frame = document.createElement("iframe");
    const toolbar = document.createElement("div");
    toolbar.dataset.canvasToolbar = "";
    document.body.append(frame, toolbar);
    vi.spyOn(frame, "getBoundingClientRect").mockReturnValue(
      DOMRect.fromRect({ x: 0, y: 58, width: 770, height: 720 }),
    );
    vi.spyOn(toolbar, "getBoundingClientRect").mockReturnValue(
      DOMRect.fromRect({ x: 20, y: 704, width: 430, height: 50 }),
    );
    const widget = frame.contentDocument!.createElement("div");
    widget.style.left = "362px";
    widget.style.top = "640px";
    vi.spyOn(widget, "getBoundingClientRect").mockReturnValue(
      DOMRect.fromRect({ x: 362, y: 640, width: 48, height: 20 }),
    );
    try {
      clampDrawerCloseWidgetToViewport(widget, 770, 720);
      expect(widget.style.top).toBe("598px");
    } finally {
      frame.remove();
      toolbar.remove();
    }
  });
});
