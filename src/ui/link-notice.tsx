import type { BillCodeError } from "../sharing/bill-code";
import type { Messages } from "../i18n/messages";
import { useLocale } from "./locale-context";

export interface LinkNoticeProps {
  readonly text: string;
  readonly isHidden: boolean;
  readonly onClose: () => void;
}

export function describeBillCodeError(
  error: BillCodeError,
  messages: Messages,
): string {
  switch (error.kind) {
    case "malformed":
    case "invalidBill":
      return messages.linkNotice.malformed;
    case "unsupportedVersion":
      return messages.linkNotice.unsupportedVersion;
  }
}

/** A message above the sections; the close button only hides it. */
export function LinkNotice(props: LinkNoticeProps) {
  const { messages } = useLocale();

  return (
    <div class="notice" role="alert" hidden={props.isHidden}>
      <p>{props.text}</p>
      <button
        type="button"
        class="button button-secondary"
        aria-label={messages.linkNotice.closeLabel}
        onClick={() => {
          props.onClose();
        }}
      >
        {messages.linkNotice.close}
      </button>
    </div>
  );
}
