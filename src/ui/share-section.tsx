import { createEffect, createSignal, on } from "solid-js";
import { encodeBill } from "../sharing/bill-code";
import { buildShareUrl } from "./address";
import type { BillProps } from "./bill-props";
import { Field, MessageArea } from "./field";

const LINK_INPUT_ID = "share-link";
const COPIED_TEXT = "Ссылка скопирована";
const COPY_MANUALLY_TEXT = "Скопируйте ссылку из поля";

/** What the section tells about the link: nothing yet, that it is copied, or where to copy it from. */
type ShareState =
  | { readonly kind: "idle" }
  | { readonly kind: "copied" }
  | { readonly kind: "copyManually"; readonly link: string };

const IDLE_STATE: ShareState = { kind: "idle" };

function describeShareState(state: ShareState): string {
  switch (state.kind) {
    case "idle":
      return "";
    case "copied":
      return COPIED_TEXT;
    case "copyManually":
      return COPY_MANUALLY_TEXT;
  }
}

export function ShareSection(props: BillProps) {
  const [state, setState] = createSignal(IDLE_STATE);
  let linkInput: HTMLInputElement | undefined;

  // The clipboard answers later than the button is pressed: by then the bill may have changed,
  // and the answer about the old link must be discarded.
  let billGeneration = 0;

  createEffect(
    on(
      () => props.bill,
      () => {
        billGeneration += 1;
        setState(IDLE_STATE);
      },
      { defer: true },
    ),
  );

  const isCopied = () => state().kind === "copied";
  const isLinkFieldHidden = () => state().kind !== "copyManually";

  function readLink(): string {
    const currentState = state();
    if (currentState.kind !== "copyManually") return "";

    return currentState.link;
  }

  function showLinkField(link: string): void {
    setState({ kind: "copyManually", link });
    linkInput?.focus();
    linkInput?.select();
  }

  function copyLink(link: string): void {
    const generationOnClick = billGeneration;
    const isStale = (): boolean => billGeneration !== generationOnClick;

    navigator.clipboard.writeText(link).then(
      () => {
        if (isStale()) return;

        setState({ kind: "copied" });
      },
      () => {
        if (isStale()) return;

        showLinkField(link);
      },
    );
  }

  function shareLink(): void {
    const link = buildShareUrl(encodeBill(props.bill));
    const isClipboardAvailable = "clipboard" in navigator;
    if (!isClipboardAvailable) {
      showLinkField(link);
      return;
    }

    copyLink(link);
  }

  return (
    <section>
      <h2>Поделиться</h2>
      <p class="note">
        Счёт хранится в самой ссылке — без сервера и регистрации. Кто её
        откроет, увидит тот же счёт.
      </p>
      <button class="button button-primary" type="button" onClick={shareLink}>
        Поделиться
      </button>
      <MessageArea text={describeShareState(state())} isSuccess={isCopied()} />
      <Field
        label="Ссылка на счёт"
        inputId={LINK_INPUT_ID}
        hidden={isLinkFieldHidden()}
      >
        <input
          ref={(element) => {
            linkInput = element;
          }}
          id={LINK_INPUT_ID}
          type="text"
          readOnly
          value={readLink()}
        />
      </Field>
    </section>
  );
}
