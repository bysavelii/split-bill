import { createElement } from "./dom";
import { createIcon } from "./icons";

/** A cross button without text: `ariaLabel` gives it its meaning. */
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
