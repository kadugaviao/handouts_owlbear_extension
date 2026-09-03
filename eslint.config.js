// @ts-check
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "coverage"] },

  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },

  // As páginas em `src/pages/` são pontos de ENTRADA: montam no DOM e não são
  // importadas por ninguém. Fast Refresh não se aplica a elas, então a regra
  // aponta um problema que não existe aqui.
  {
    files: ["src/pages/*.{ts,tsx}"],
    rules: { "react-refresh/only-export-components": "off" },
  },

  // Os testes rodam no Node: precisam dos globais dele (process, __dirname).
  {
    files: ["**/*.test.ts", "**/*.test.tsx"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },

  // O arquivo de configuração do Vite também é Node.
  {
    files: ["vite.config.ts", "eslint.config.js"],
    languageOptions: { globals: globals.node },
  },
);
