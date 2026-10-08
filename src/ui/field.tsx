import { Show, type JSX } from "solid-js";
import { NO_MESSAGE } from "./bill-message";
import { Icon } from "./icons";

const MESSAGE_CLASS = "message";
const SUCCESS_MESSAGE_CLASS = "message message-success";

export interface FieldProps {
  readonly label: string;
  /** The `id` of the field in `children`: the label is tied to it through `for`. */
  readonly inputId: string;
  readonly hidden?: boolean;
  readonly children: JSX.Element;
}

export interface FieldErrorProps {
  /** The `id` that the control points to through `aria-describedby`; see `fieldErrorId`. */
  readonly id: string;
  readonly text: string;
}

export interface MessageAreaProps {
  readonly text: string;
  readonly isSuccess?: boolean;
}

/** The `id` of the error of a control: the control refers to it through `aria-describedby`. */
export function fieldErrorId(controlId: string): string {
  return `${controlId}-error`;
}

export function Field(props: FieldProps) {
  return (
    <div class="field" hidden={props.hidden}>
      <label for={props.inputId}>{props.label}</label>
      {props.children}
    </div>
  );
}

/** The error of one field, shown right next to it. The element stays in the markup while empty, so the screen reader reads the text when it appears. */
export function FieldError(props: FieldErrorProps) {
  return (
    <p id={props.id} class="field-error" aria-live="polite">
      {props.text}
    </p>
  );
}

/** An area for messages: screen readers read them when they appear. A success has a check mark before the text. */
export function MessageArea(props: MessageAreaProps) {
  const className = () =>
    props.isSuccess === true ? SUCCESS_MESSAGE_CLASS : MESSAGE_CLASS;
  const isSuccessShown = () =>
    props.isSuccess === true && props.text !== NO_MESSAGE;

  return (
    <p class={className()} aria-live="polite">
      <Show when={isSuccessShown()}>
        <Icon name="check" class="message-icon" />
      </Show>
      {props.text}
    </p>
  );
}
