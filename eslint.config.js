import js from "@eslint/js";
import prettierConfig from "eslint-config-prettier";
import solid from "eslint-plugin-solid/configs/typescript";
import tseslint from "typescript-eslint";

const DOM_GLOBALS = [
  "document",
  "window",
  "localStorage",
  "location",
  "navigator",
  "history",
  "sessionStorage",
  "fetch",
  "self",
  "globalThis",
];

export default tseslint.config(
  { ignores: ["dist", "coverage", ".astro", ".cyberzavod", ".claude"] },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true },
    },
    rules: {
      "@typescript-eslint/switch-exhaustiveness-check": "error",
    },
  },
  {
    files: ["**/*.js"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ["src/**/*.tsx"],
    ...solid,
  },
  {
    // Domain logic, link encoding, texts, number formatting and page metadata know nothing about the DOM and the interface.
    files: [
      "src/bill/**",
      "src/i18n/**",
      "src/seo/**",
      "src/settlement/**",
      "src/sharing/**",
    ],
    rules: {
      "no-restricted-globals": [
        "error",
        ...DOM_GLOBALS.map((name) => ({
          name,
          message: `Code without the DOM must not use ${name}`,
        })),
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/ui/**"],
              message: "Code without the DOM must not import the interface",
            },
            {
              group: ["solid-js*", "astro*"],
              message: "Code without the DOM must not import the frameworks",
            },
          ],
        },
      ],
    },
  },
  prettierConfig,
);
