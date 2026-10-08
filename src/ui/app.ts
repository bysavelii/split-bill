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
import { createPageHeader } from "./page-header";
import { createParticipantsSection } from "./participants-section";
import { createShareSection } from "./share-section";
import { createSummarySection } from "./summary-section";

/** Returns a function that removes the app's handlers from the window. */
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
  const pageHeader = createPageHeader();
  const participantsSection = createParticipantsSection(actions);
  const expensesSection = createExpensesSection(actions);
  const summarySection = createSummarySection();
  const shareSection = createShareSection(actions);
  const sections = [
    participantsSection,
    expensesSection,
    summarySection,
    shareSection,
  ];

  function renderSections(): void {
    for (const part of [pageHeader, ...sections]) part.render(bill);
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

  const mainColumn = createElement("div", { className: "layout-main" }, [
    participantsSection.element,
    expensesSection.element,
  ]);
  const sideColumn = createElement("div", { className: "layout-side" }, [
    summarySection.element,
    shareSection.element,
  ]);
  const layout = createElement("div", { className: "layout" }, [
    mainColumn,
    sideColumn,
  ]);
  root.replaceChildren(pageHeader.element, linkNotice.element, layout);
  openBillFromAddress();

  window.addEventListener("hashchange", openBillFromAddress);

  return () => {
    window.removeEventListener("hashchange", openBillFromAddress);
  };
}
