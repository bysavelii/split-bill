import type { BillCodeError } from "../sharing/bill-code";

const MALFORMED_LINK_TEXT =
  "Не получилось открыть счёт по ссылке: она повреждена или скопирована не целиком. Попросите прислать её ещё раз, а пока можно начать новый счёт.";
const UNSUPPORTED_VERSION_TEXT =
  "Эта ссылка сделана в другой версии приложения, и открыть её здесь не получится. Попросите прислать новую ссылку, а пока можно начать новый счёт.";

export interface LinkNoticeProps {
  readonly text: string;
  readonly isHidden: boolean;
  readonly onClose: () => void;
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

/** A message above the sections; "Закрыть" only hides it. */
export function LinkNotice(props: LinkNoticeProps) {
  return (
    <div class="notice" role="alert" hidden={props.isHidden}>
      <p>{props.text}</p>
      <button
        type="button"
        class="button button-secondary"
        aria-label="Закрыть сообщение"
        onClick={() => {
          props.onClose();
        }}
      >
        Закрыть
      </button>
    </div>
  );
}
