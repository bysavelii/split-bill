import { createElement } from "./dom";
import { createIcon, type IconName } from "./icons";

/** Дружелюбная подсказка с иконкой вместо пустого места. */
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
