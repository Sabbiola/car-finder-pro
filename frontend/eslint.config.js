import path from "node:path";
import { fileURLToPath } from "node:url";

import js from "@eslint/js";
import globals from "globals";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default tseslint.config(
  {
    ignores: [
      "dist",
      "coverage",
      "playwright-report",
      "test-results",
      "node_modules",
      "vitest.config.ts.timestamp-*",
    ],
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  prettier,

  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.es2024,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      /**
       * Base quality
       */
      "curly": ["error", "all"],
      "eqeqeq": ["error", "always", { null: "ignore" }],
      "no-alert": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-debugger": "error",
      "no-duplicate-imports": "error",
      "prefer-const": "error",
      "object-shorthand": ["error", "always"],

      /**
       * React
       */
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "react-hooks/exhaustive-deps": "error",

      /**
       * TypeScript safety
       */
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports",
        },
      ],
      "@typescript-eslint/no-confusing-void-expression": [
        "error",
        { ignoreArrowShorthand: true },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": [
        "error",
        { ignoreVoid: true },
      ],
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          checksVoidReturn: {
            arguments: false,
            attributes: false,
          },
        },
      ],
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "@typescript-eslint/only-throw-error": "error",
      "@typescript-eslint/prefer-nullish-coalescing": [
        "error",
        {
          ignoreConditionalTests: true,
          ignorePrimitives: {
            boolean: true,
            number: true,
            string: true,
          },
        },
      ],
      "@typescript-eslint/prefer-optional-chain": "error",
      "@typescript-eslint/require-await": "error",
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        {
          allowBoolean: true,
          allowNumber: true,
          allowNullish: true,
        },
      ],
      "@typescript-eslint/switch-exhaustiveness-check": "error",

      /**
       * Architettura e boundary
       *
       * Queste regole evitano dipendenze ambigue e import poco chiari.
       */
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../*", "../../*", "../../../*"],
              message:
                "Preferisci alias `@/` o import locali espliciti. Evita deep relative imports fragili quando attraversi moduli.",
            },
          ],
        },
      ],
    },
  },

  /**
   * File di configurazione / toolchain
   */
  {
    files: [
      "*.config.{js,ts}",
      "vite.config.ts",
      "vitest.config.ts",
      "playwright.config.ts",
      "tailwind.config.ts",
      "postcss.config.js",
      "prettier.config.js",
    ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-var-requires": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  /**
   * Test unit/integration
   */
  {
    files: [
      "src/**/*.test.{ts,tsx}",
      "src/**/__tests__/**/*.{ts,tsx}",
      "src/test/**/*.{ts,tsx}",
      "src/tests/**/*.{ts,tsx}",
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/no-misused-promises": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/unbound-method": "off",
      "no-console": "off",
      "no-restricted-imports": "off",
    },
  },

  /**
   * Generated / infrastructure UI
   *
   * I componenti sotto src/components/ui possono essere più verbosi
   * o avere export pattern tipici di shadcn/ui.
   */
  {
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },

  /**
   * Integrazione Supabase e client tipizzati generati
   */
  {
    files: ["src/integrations/supabase/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  /**
   * Pagine legacy o ad alto churn:
   * eccezioni mirate e temporanee da rimuovere nel tempo.
   */
  {
    files: ["src/pages/Profile.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  }
);

