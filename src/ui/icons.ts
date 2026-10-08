export type IconName = "close" | "check" | "arrow" | "people" | "receipt";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const ICON_VIEW_BOX = "0 0 24 24";
const ICON_STROKE_WIDTH = "2";

/** Контуры значков в сетке 24×24; рисуются линией цвета текста. */
const ICON_PATHS: Record<IconName, string> = {
  close: "M6 6l12 12M18 6L6 18",
  check: "M5 12.5l4.5 4.5L19 7.5",
  arrow: "M5 12h14M13 6l6 6-6 6",
  people:
    "M16 19v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM20 19v-1a4 4 0 0 0-3-3.87M15 4.13a3.5 3.5 0 0 1 0 6.74",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2V3zM9 8h6M9 12h6",
};

/** Значок скрыт от диктора: смысл всегда передаёт текст или `aria-label` рядом. */
export function createIcon(name: IconName): SVGSVGElement {
  const icon = document.createElementNS(SVG_NAMESPACE, "svg");
  icon.setAttribute("viewBox", ICON_VIEW_BOX);
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("focusable", "false");
  icon.setAttribute("fill", "none");
  icon.setAttribute("stroke", "currentColor");
  icon.setAttribute("stroke-width", ICON_STROKE_WIDTH);
  icon.setAttribute("stroke-linecap", "round");
  icon.setAttribute("stroke-linejoin", "round");

  const path = document.createElementNS(SVG_NAMESPACE, "path");
  path.setAttribute("d", ICON_PATHS[name]);
  icon.append(path);

  return icon;
}
