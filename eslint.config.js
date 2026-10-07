import js from "@eslint/js";
import prettierConfig from "eslint-config-prettier";
import tseslint from "typescript-eslint";

const DOM_GLOBALS = [
  "document",
  "window",
  "localStorage",
  "location",
  "navigator",
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
    // Предметная логика не знает о DOM и интерфейсе.
    files: ["src/bill/**", "src/settlement/**"],
    rules: {
      "no-restricted-globals": [
        "error",
        ...DOM_GLOBALS.map((name) => ({
          name,
          message: `Предметная логика не должна обращаться к ${name}: она не знает о DOM`,
        })),
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/ui/**"],
              message: "Предметная логика не должна импортировать интерфейс",
            },
          ],
        },
      ],
    },
  },
  prettierConfig,
);
