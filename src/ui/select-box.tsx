import type { JSX } from "solid-js";
import { Icon } from "./icons";

export interface SelectBoxProps {
  /** The native `select` the chevron is drawn over. */
  readonly children: JSX.Element;
}

/** Draws the app's chevron over a native `select`: the select itself stays native, so keyboard, screen readers and the phone's picker work as they do everywhere. */
export function SelectBox(props: SelectBoxProps) {
  return (
    <div class="select-box">
      {props.children}
      <Icon name="chevron" class="select-chevron" />
    </div>
  );
}
