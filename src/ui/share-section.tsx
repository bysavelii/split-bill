import { createEffect, createSignal, on } from "solid-js";
import type { Messages } from "../i18n/messages";
import { encodeBill } from "../sharing/bill-code";
import { buildShareUrl } from "./address";
import type { BillProps } from "./bill-props";
import { Field, MessageArea } from "./field";
import { useLocale } from "./locale-context";

const LINK_INPUT_ID = "share-link";

/** What the section tells about the link: nothing yet, that it is copied, or where to copy it from. */
type ShareState =
  | { readonly kind: "idle" }
  | { readonly kind: "copied" }
  | { readonly kind: "copyManually"; readonly link: string };

const IDLE_STATE: ShareState = { kind: "idle" };

const NO_MESSAGE = "";

function describeShareState(state: ShareState, messages: Messages): string {
  switch (state.kind) {
    case "idle":
      return NO_MESSAGE;
    case "copied":
      return messages.share.copied;
    case "copyManually":
      return messages.share.copyManually;
  }
}

export function ShareSection(props: BillProps) {
  const { messages } = useLocale();
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
    const link = buildShareUrl(encodeBill(props.bill, props.currency));
    const isClipboardAvailable = "clipboard" in navigator;
    if (!isClipboardAvailable) {
      showLinkField(link);
      return;
    }

    copyLink(link);
  }

  return (
    <section>
      <h2>{messages.share.heading}</h2>
      <p class="note">{messages.share.note}</p>
      <button class="button button-primary" type="button" onClick={shareLink}>
        {messages.share.button}
      </button>
      <MessageArea
        text={describeShareState(state(), messages)}
        isSuccess={isCopied()}
      />
      <Field
        label={messages.share.linkLabel}
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
