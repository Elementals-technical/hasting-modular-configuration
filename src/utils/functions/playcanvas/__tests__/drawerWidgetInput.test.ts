// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { renderDrawerCloseWidget } from "../drawerCloseWidget";

describe("drawer widget input", () => {
  it.each(["mousedown", "pointerdown", "touchstart"])("keeps the control alive through %s until click", (press) => {
    const parent = document.createElement("div");
    document.body.append(parent);
    const onClick = vi.fn();
    renderDrawerCloseWidget(parent, { onClick });
    const button = parent.querySelector("button")!;
    const selectScene = vi.fn(() => parent.replaceChildren());
    document.addEventListener(press, selectScene);
    try {
      button.dispatchEvent(new Event(press, { bubbles: true }));
      expect(selectScene).not.toHaveBeenCalled();
      expect(button.isConnected).toBe(true);
      button.click();
      expect(onClick).toHaveBeenCalledOnce();
    } finally {
      document.removeEventListener(press, selectScene);
      parent.remove();
    }
  });
});
