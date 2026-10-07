interface ElementOptions {
  readonly text?: string;
  readonly className?: string;
  readonly attributes?: Readonly<Record<string, string>>;
}

/** Текст попадает в элемент только через textContent, поэтому разметка из него не исполняется. */
export function createElement<Tag extends keyof HTMLElementTagNameMap>(
  tag: Tag,
  options: ElementOptions = {},
  children: readonly Node[] = [],
): HTMLElementTagNameMap[Tag] {
  const element = document.createElement(tag);
  if (options.text !== undefined) element.textContent = options.text;
  if (options.className !== undefined) element.className = options.className;
  for (const [name, value] of Object.entries(options.attributes ?? {})) {
    element.setAttribute(name, value);
  }
  element.append(...children);

  return element;
}

/** Подпись, связанная с полем через `for`: у поля должен быть задан `id`. */
export function createField(
  labelText: string,
  control: HTMLElement,
): HTMLDivElement {
  const label = createElement("label", {
    text: labelText,
    attributes: { for: control.id },
  });

  return createElement("div", { className: "field" }, [label, control]);
}

/** Область для сообщений: экранные дикторы читают их при появлении. */
export function createMessageArea(): HTMLParagraphElement {
  return createElement("p", {
    className: "message",
    attributes: { "aria-live": "polite" },
  });
}
