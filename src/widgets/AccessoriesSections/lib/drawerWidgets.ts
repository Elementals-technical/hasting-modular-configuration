import { renderDrawerCloseWidget } from "@/utils/functions/playcanvas/drawerCloseWidget";
import { onDrawerCloseWidgetRender, onDrawerWidgetRender } from "@/utils/functions/playcanvas/drawerWidgetRenderers";

const configuratorApi = () => window.containerRef?.current?.contentWindow?.ConfiguratorAPI;

/** Installs the "Open Drawer" and close widgets the scene draws over drawers; returns the uninstall. */
export const installDrawerWidgets = () => {
  onDrawerWidgetRender((drawerInfo, parentEl) => {
    const isMobile = parentEl.ownerDocument.defaultView?.matchMedia("(max-width: 1024px)").matches ?? false;
    parentEl.innerHTML = "";
    Object.assign(parentEl.style, {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: isMobile ? "3px" : "6px",
      pointerEvents: "auto",
    });

    if (drawerInfo.hasOccupiedDividers) {
      const indicator = document.createElement("div");
      const iconSize = isMobile ? 12 : 16;
      indicator.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${iconSize}" height="${iconSize}" viewBox="0 0 20 20" fill="none"><path d="M16.6667 5L7.50001 14.1667L3.33334 10" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      Object.assign(indicator.style, {
        background: "#262b31",
        color: "#fff",
        borderRadius: "999px",
        width: isMobile ? "24px" : "42px",
        height: isMobile ? "24px" : "42px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
      });
      parentEl.appendChild(indicator);
    }

    const button = document.createElement("button");
    button.type = "button";
    const label = document.createElement("span");
    label.textContent = "Open Drawer";
    const plus = document.createElement("span");
    plus.textContent = "+";
    plus.setAttribute("aria-hidden", "true");
    Object.assign(plus.style, {
      width: isMobile ? "10px" : "14px",
      height: isMobile ? "10px" : "14px",
      borderRadius: "999px",
      background: "rgba(255,255,255,0.22)",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: isMobile ? "8px" : "11px",
      fontWeight: "700",
      lineHeight: "1",
    });
    Object.assign(button.style, {
      background: "#A05535",
      color: "#fff",
      border: "none",
      borderRadius: "999px",
      padding: isMobile ? "3px 5px 3px 7px" : "5px 8px 5px 12px",
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: isMobile ? "3px" : "5px",
      fontSize: isMobile ? "8px" : "11px",
      lineHeight: "1.1",
      fontFamily: "Poppins, sans-serif",
      whiteSpace: "nowrap",
    });
    button.append(label, plus);
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      configuratorApi()?.showTopView?.(drawerInfo.cabinetId, drawerInfo.drawerType);
    });
    parentEl.appendChild(button);
  });

  onDrawerCloseWidgetRender((_, parentEl) => {
    renderDrawerCloseWidget(parentEl, {
      onClick: (event) => {
        event.stopPropagation();
        configuratorApi()?.exitTopView?.();
      },
    });
  });

  return () => {
    onDrawerWidgetRender(null);
    onDrawerCloseWidgetRender(null);
  };
};
