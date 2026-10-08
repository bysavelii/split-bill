import type { JSX } from "solid-js";

const MESSAGE_CLASS = "message";
const SUCCESS_MESSAGE_CLASS = "message message-success";

export interface FieldProps {
  readonly label: string;
  /** The `id` of the field in `children`: the label is tied to it through `for`. */
  readonly inputId: string;
  readonly hidden?: boolean;
  readonly children: JSX.Element;
}

export interface MessageAreaProps {
  readonly text: string;
  readonly isSuccess?: boolean;
}

export function Field(props: FieldProps) {
  return (
    <div class="field" hidden={props.hidden}>
      <label for={props.inputId}>{props.label}</label>
      {props.children}
    </div>
  );
}

/** An area for messages: screen readers read them when they appear. */
export function MessageArea(props: MessageAreaProps) {
  const className = () =>
    props.isSuccess === true ? SUCCESS_MESSAGE_CLASS : MESSAGE_CLASS;

  return (
    <p class={className()} aria-live="polite">
      {props.text}
    </p>
  );
}
