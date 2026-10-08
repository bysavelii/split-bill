import { createElement } from "./dom";
import { createIcon } from "./icons";

/** Кнопка-крестик без текста: смысл ей даёт `ariaLabel`. */
export function createRemoveButton(ariaLabel: string): HTMLButtonElement {
  return createElement(
    "button",
    {
      className: "icon-button",
      attributes: { type: "button", "aria-label": ariaLabel },
    },
    [createIcon("close")],
  );
}
