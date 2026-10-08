export type IconName =
  "close" | "check" | "arrow" | "people" | "receipt" | "chevron";

export interface IconProps {
  readonly name: IconName;
  readonly class?: string;
}

/** Icon outlines on a 24×24 grid; drawn with a line in the text color. */
const ICON_PATHS: Record<IconName, string> = {
  close: "M6 6l12 12M18 6L6 18",
  check: "M5 12.5l4.5 4.5L19 7.5",
  arrow: "M5 12h14M13 6l6 6-6 6",
  people:
    "M16 19v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM20 19v-1a4 4 0 0 0-3-3.87M15 4.13a3.5 3.5 0 0 1 0 6.74",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2V3zM9 8h6M9 12h6",
  chevron: "M6 9l6 6 6-6",
};

/** The icon is hidden from the screen reader: the meaning is always conveyed by the text or `aria-label` next to it. */
export function Icon(props: IconProps) {
  return (
    <svg
      class={props.class}
      viewBox="0 0 24 24"
      aria-hidden="true"
      attr:focusable="false"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d={ICON_PATHS[props.name]} />
    </svg>
  );
}
