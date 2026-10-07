import { EMPTY_BILL, type Bill } from "../bill/bill";
import {
  decodeBill,
  encodeBill,
  type BillCodeError,
} from "../sharing/bill-code";
import { readBillCode, writeBillCode } from "./address";
import { createElement } from "./dom";
import { createExpensesSection } from "./expenses-section";
import { createLinkNotice, describeBillCodeError } from "./link-notice";
import { createParticipantsSection } from "./participants-section";
import { createShareSection } from "./share-section";
import { createSummarySection } from "./summary-section";

/** Возвращает функцию, которая снимает с окна обработчики приложения. */
export function mountApp(root: HTMLElement): () => void {
  let bill: Bill = EMPTY_BILL;

  const actions = {
    getBill: () => bill,
    changeBill: (nextBill: Bill) => {
      bill = nextBill;
      writeBillCode(encodeBill(nextBill));
      renderSections();
    },
  };
  const linkNotice = createLinkNotice();
  const sections = [
    createParticipantsSection(actions),
    createExpensesSection(actions),
    createSummarySection(),
    createShareSection(actions),
  ];

  function renderSections(): void {
    for (const section of sections) section.render(bill);
  }

  function showOpenedBill(openedBill: Bill): void {
    bill = openedBill;
    linkNotice.hide();
    renderSections();
  }

  function showRejectedLink(error: BillCodeError): void {
    bill = EMPTY_BILL;
    linkNotice.show(describeBillCodeError(error));
    renderSections();
  }

  /** Адрес при этом не пишется: он меняется только вместе со счётом. */
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

  const title = createElement("h1", { text: "Делим счёт" });
  root.replaceChildren(
    title,
    linkNotice.element,
    ...sections.map((section) => section.element),
  );
  openBillFromAddress();

  window.addEventListener("hashchange", openBillFromAddress);

  return () => {
    window.removeEventListener("hashchange", openBillFromAddress);
  };
}
