/** Единственное место, где приложение читает и меняет адрес страницы. */

const FRAGMENT_PREFIX_LENGTH = "#".length;

/** Код счёта из фрагмента адреса; `undefined`, если фрагмента нет. */
export function readBillCode(): string | undefined {
  const code = location.hash.slice(FRAGMENT_PREFIX_LENGTH);

  return code === "" ? undefined : code;
}

/** Заменяет фрагмент текущей записи истории: путь и query остаются, «Назад» не перебирает правки. */
export function writeBillCode(code: string): void {
  history.replaceState(history.state, "", buildShareUrl(code));
}

export function buildShareUrl(code: string): string {
  const url = new URL(location.href);
  url.hash = code;

  return url.href;
}
