import js from "@eslint/js";
import prettierConfig from "eslint-config-prettier";
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
  { ignores: ["dist", "coverage", ".cyberzavod", ".claude"] },
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
    // Предметная логика и кодирование ссылки не знают о DOM и интерфейсе.
    files: ["src/bill/**", "src/settlement/**", "src/sharing/**"],
    rules: {
      "no-restricted-globals": [
        "error",
        ...DOM_GLOBALS.map((name) => ({
          name,
          message: `Код без DOM не должен обращаться к ${name}`,
        })),
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/ui/**"],
              message: "Код без DOM не должен импортировать интерфейс",
            },
          ],
        },
      ],
    },
  },
  prettierConfig,
);
