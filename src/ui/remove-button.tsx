import { Icon } from "./icons";

export interface RemoveButtonProps {
  readonly ariaLabel: string;
  readonly onClick: () => void;
}

/** A cross button without text: `ariaLabel` gives it its meaning. */
export function RemoveButton(props: RemoveButtonProps) {
  return (
    <button
      type="button"
      class="icon-button"
      aria-label={props.ariaLabel}
      onClick={() => {
        props.onClick();
      }}
    >
      <Icon name="close" />
    </button>
  );
}
