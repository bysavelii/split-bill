import type { BillCodeError } from "../sharing/bill-code";
import { createElement } from "./dom";

const MALFORMED_LINK_TEXT =
  "Не получилось открыть счёт по ссылке: она повреждена или скопирована не целиком. Попросите прислать её ещё раз, а пока можно начать новый счёт.";
const UNSUPPORTED_VERSION_TEXT =
  "Эта ссылка сделана в другой версии приложения, и открыть её здесь не получится. Попросите прислать новую ссылку, а пока можно начать новый счёт.";

export interface LinkNotice {
  readonly element: HTMLElement;
  readonly show: (text: string) => void;
  readonly hide: () => void;
}

export function describeBillCodeError(error: BillCodeError): string {
  switch (error.kind) {
    case "malformed":
    case "invalidBill":
      return MALFORMED_LINK_TEXT;
    case "unsupportedVersion":
      return UNSUPPORTED_VERSION_TEXT;
  }
}

/** Сообщение над секциями; «Закрыть» только прячет его. */
export function createLinkNotice(): LinkNotice {
  const text = createElement("p");
  const closeButton = createElement("button", {
    text: "Закрыть",
    attributes: { type: "button", "aria-label": "Закрыть сообщение" },
  });
  const element = createElement(
    "div",
    { className: "notice", attributes: { role: "alert" } },
    [text, closeButton],
  );
  element.hidden = true;

  function show(message: string): void {
    text.textContent = message;
    element.hidden = false;
  }

  function hide(): void {
    element.hidden = true;
  }

  closeButton.addEventListener("click", hide);

  return { element, show, hide };
}
