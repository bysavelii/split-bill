import { Icon, type IconName } from "./icons";

export interface EmptyStateProps {
  readonly icon: IconName;
  readonly text: string;
  /** An extra class next to `empty-state`. */
  readonly class?: string;
  readonly hidden?: boolean;
}

/** A friendly hint with an icon instead of an empty space. */
export function EmptyState(props: EmptyStateProps) {
  const className = () => `empty-state ${props.class ?? ""}`.trim();

  return (
    <p class={className()} hidden={props.hidden}>
      <Icon name={props.icon} />
      <span>{props.text}</span>
    </p>
  );
}
