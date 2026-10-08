import "solid-js";

declare module "solid-js" {
  namespace JSX {
    /** Old Edge and IE make an inline svg focusable by default; the typings of Solid do not know this attribute. */
    interface ExplicitAttributes {
      focusable: string;
    }
  }
}
