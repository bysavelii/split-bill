import { createSignal, onCleanup, onMount } from "solid-js";
import { EMPTY_BILL, type Bill } from "../bill/bill";
import {
  decodeBill,
  encodeBill,
  type BillCodeError,
} from "../sharing/bill-code";
import { readBillCode, writeBillCode } from "./address";
import { ExpensesSection } from "./expenses-section";
import { describeBillCodeError, LinkNotice } from "./link-notice";
import { PageHeader } from "./page-header";
import { ParticipantsSection } from "./participants-section";
import { ShareSection } from "./share-section";
import { SummarySection } from "./summary-section";

interface NoticeState {
  readonly text: string;
  readonly isHidden: boolean;
}

const HIDDEN_NOTICE: NoticeState = { text: "", isHidden: true };

export function App() {
  // Any write redraws the sections, even of the same bill: messages and the link field are cleared.
  const [bill, setBill] = createSignal<Bill>(EMPTY_BILL, { equals: false });
  const [notice, setNotice] = createSignal(HIDDEN_NOTICE);

  function changeBill(changedBill: Bill): void {
    setBill(changedBill);
    writeBillCode(encodeBill(changedBill));
  }

  function showOpenedBill(openedBill: Bill): void {
    setBill(openedBill);
    setNotice(HIDDEN_NOTICE);
  }

  function showRejectedLink(error: BillCodeError): void {
    setBill(EMPTY_BILL);
    setNotice({ text: describeBillCodeError(error), isHidden: false });
  }

  function hideNotice(): void {
    setNotice((current) => ({ ...current, isHidden: true }));
  }

  /** The address is not written here: it changes only together with the bill. */
  function openBillFromAddress(): void {
    const code = readBillCode();
    if (code === undefined) {
      showOpenedBill(EMPTY_BILL);
      return;
    }

    const result = decodeBill(code);
    if (result.kind === "failed") {
      showRejectedLink(result.error);
      return;
    }

    showOpenedBill(result.bill);
  }

  // The address does not exist while the page is rendered on the server and while it is hydrated,
  // so it is read only after mounting.
  onMount(() => {
    openBillFromAddress();
    window.addEventListener("hashchange", openBillFromAddress);

    onCleanup(() => {
      window.removeEventListener("hashchange", openBillFromAddress);
    });
  });

  return (
    <>
      <PageHeader bill={bill()} />
      <LinkNotice
        text={notice().text}
        isHidden={notice().isHidden}
        onClose={hideNotice}
      />
      <div class="layout">
        <div class="layout-main">
          <ParticipantsSection bill={bill()} onBillChange={changeBill} />
          <ExpensesSection bill={bill()} onBillChange={changeBill} />
        </div>
        <div class="layout-side">
          <SummarySection bill={bill()} />
          <ShareSection bill={bill()} onBillChange={changeBill} />
        </div>
      </div>
    </>
  );
}
