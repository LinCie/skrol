import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import turboPlugin from "eslint-plugin-turbo";
import tseslint from "typescript-eslint";

const config = [
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  {
    plugins: {
      turbo: turboPlugin,
    },
    rules: {
      "turbo/no-undeclared-env-vars": "warn",
    },
  },
  {
    ignores: ["dist/**", "src/modules/**/__fixtures__/**"],
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["src/modules/**/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/modules/**/application/**",
                "@/modules/**/infrastructure/**",
                "@/modules/**/presentation/**",
              ],
              message:
                "Domain layer cannot import application, infrastructure, or presentation.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/modules/**/application/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/modules/**/infrastructure/**",
                "@/modules/**/presentation/**",
                "@/shared/infrastructure/**",
              ],
              message:
                "Application layer cannot import infrastructure/presentation or shared infrastructure.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/modules/**/infrastructure/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/modules/**/presentation/**"],
              message: "Infrastructure layer cannot import presentation layer.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/modules/**/presentation/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/modules/**/infrastructure/**"],
              message:
                "Presentation layer cannot import infrastructure directly; use application contracts.",
            },
          ],
        },
      ],
    },
  },
];

export default config;
