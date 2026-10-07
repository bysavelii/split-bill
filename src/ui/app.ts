import { EMPTY_BILL, type Bill } from "../bill/bill";
import { createElement } from "./dom";
import { createExpensesSection } from "./expenses-section";
import { createParticipantsSection } from "./participants-section";
import { createSummarySection } from "./summary-section";

export function mountApp(root: HTMLElement): void {
  let bill: Bill = EMPTY_BILL;

  const actions = {
    getBill: () => bill,
    changeBill: (nextBill: Bill) => {
      bill = nextBill;
      renderSections();
    },
  };
  const sections = [
    createParticipantsSection(actions),
    createExpensesSection(actions),
    createSummarySection(),
  ];

  function renderSections(): void {
    for (const section of sections) section.render(bill);
  }

  const title = createElement("h1", { text: "Делим счёт" });
  root.replaceChildren(title, ...sections.map((section) => section.element));
  renderSections();
}
