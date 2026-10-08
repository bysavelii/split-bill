interface ElementOptions {
  readonly text?: string;
  readonly className?: string;
  readonly attributes?: Readonly<Record<string, string>>;
}

/** Text gets into an element only through textContent, so markup in it is not executed. */
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

/** A label tied to a field through `for`: the field must have an `id`. */
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

/** An area for messages: screen readers read them when they appear. */
export function createMessageArea(): HTMLParagraphElement {
  return createElement("p", {
    className: "message",
    attributes: { "aria-live": "polite" },
  });
}
