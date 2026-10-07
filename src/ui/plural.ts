/** Формы слова для чисел вроде 1, 2 и 5. */
export interface PluralForms {
  readonly one: string;
  readonly few: string;
  readonly many: string;
}

const pluralRules = new Intl.PluralRules("ru-RU");

/** Число со словом в нужной форме: «2 перевода», «5 человек». */
export function formatCount(count: number, forms: PluralForms): string {
  return `${String(count)} ${selectForm(count, forms)}`;
}

function selectForm(count: number, forms: PluralForms): string {
  const category = pluralRules.select(count);
  if (category === "one") return forms.one;
  if (category === "few") return forms.few;

  return forms.many;
}
