import { getIconStrokeWidth } from "./iconStroke";

// Lucide check and plus geometry (ISC): https://lucide.dev/icons/check, https://lucide.dev/icons/plus.
const SCENE_ICON_PATHS = {
  check: ["M20 6 9 17l-5-5"],
  plus: ["M5 12h14", "M12 5v14"],
};

/** Lucide SVG for DOM widgets inside the player iframe, where app CSS is unavailable. */
export function createSceneIcon(document: Document, name: keyof typeof SCENE_ICON_PATHS, size: number) {
  if (!document.getElementById("scene-icon-strokes")) {
    const style = document.createElement("style");
    style.id = "scene-icon-strokes";
    style.textContent = "@media (max-width: 1024px) { svg[data-scene-icon] { stroke-width: 1; } }";
    document.head.appendChild(style);
  }
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const attributes = {
    width: String(size),
    height: String(size),
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": String(getIconStrokeWidth(size)),
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
    "data-scene-icon": name,
    class: `lucide lucide-${name} scene-${name}-icon`,
  };
  Object.entries(attributes).forEach(([key, value]) => svg.setAttribute(key, value));
  SCENE_ICON_PATHS[name].forEach((d) => {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    path.setAttribute("vector-effect", "non-scaling-stroke");
    svg.appendChild(path);
  });
  return svg;
}
