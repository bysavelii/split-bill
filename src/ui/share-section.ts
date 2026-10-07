import { encodeBill } from "../sharing/bill-code";
import { buildShareUrl } from "./address";
import { createElement, createField, createMessageArea } from "./dom";
import type { BillActions, Section } from "./section";

const LINK_INPUT_ID = "share-link";
const COPIED_TEXT = "Ссылка скопирована";
const SUCCESS_CLASS = "message-success";
const COPY_MANUALLY_TEXT = "Скопируйте ссылку из поля";

export function createShareSection(actions: BillActions): Section {
  const shareButton = createElement("button", {
    text: "Поделиться",
    attributes: { type: "button" },
  });
  const message = createMessageArea();
  const linkInput = createElement("input", {
    attributes: { id: LINK_INPUT_ID, type: "text", readonly: "" },
  });
  const linkField = createField("Ссылка на счёт", linkInput);
  const element = createElement("section", {}, [
    createElement("h2", { text: "Поделиться" }),
    createElement("p", {
      className: "note",
      text: "Счёт хранится в самой ссылке — без сервера и регистрации. Кто её откроет, увидит тот же счёт.",
    }),
    shareButton,
    message,
    linkField,
  ]);
  linkField.hidden = true;

  // Буфер отвечает позже, чем нажата кнопка: к этому времени счёт мог измениться,
  // и ответ про старую ссылку надо отбросить.
  let renderGeneration = 0;

  shareButton.addEventListener("click", shareLink);

  function shareLink(): void {
    const link = buildShareUrl(encodeBill(actions.getBill()));
    const isClipboardAvailable = "clipboard" in navigator;
    if (!isClipboardAvailable) {
      showLinkField(link);
      return;
    }

    copyLink(link);
  }

  function copyLink(link: string): void {
    const generationOnClick = renderGeneration;
    const isStale = (): boolean => renderGeneration !== generationOnClick;

    navigator.clipboard.writeText(link).then(
      () => {
        if (isStale()) return;

        message.classList.add(SUCCESS_CLASS);
        message.textContent = COPIED_TEXT;
      },
      () => {
        if (isStale()) return;

        showLinkField(link);
      },
    );
  }

  function showLinkField(link: string): void {
    message.classList.remove(SUCCESS_CLASS);
    message.textContent = COPY_MANUALLY_TEXT;
    linkInput.value = link;
    linkField.hidden = false;
    linkInput.focus();
    linkInput.select();
  }

  function render(): void {
    renderGeneration += 1;
    message.classList.remove(SUCCESS_CLASS);
    message.textContent = "";
    linkField.hidden = true;
  }

  return { element, render };
}
