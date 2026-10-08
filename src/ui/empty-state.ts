import { createElement } from "./dom";
import { createIcon, type IconName } from "./icons";

/** A friendly hint with an icon instead of an empty space. */
export function createEmptyState(
  iconName: IconName,
  text: string,
  extraClassName = "",
): HTMLParagraphElement {
  const className = `empty-state ${extraClassName}`.trim();

  return createElement("p", { className }, [
    createIcon(iconName),
    createElement("span", { text }),
  ]);
}
