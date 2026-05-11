import js from "@eslint/js";
import astro from "eslint-plugin-astro";
import astroParser from "astro-eslint-parser";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [".astro/**", "dist/**", "node_modules/**"]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs["flat/recommended"],
  {
    files: ["**/*.astro"],
    languageOptions: {
      parser: astroParser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: [".astro"]
      },
      globals: {
        window: "readonly",
        document: "readonly",
        CustomEvent: "readonly",
        HTMLElement: "readonly",
        HTMLButtonElement: "readonly",
        HTMLInputElement: "readonly"
      }
    }
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    languageOptions: {
      globals: {
        window: "readonly",
        document: "readonly",
        CustomEvent: "readonly",
        HTMLElement: "readonly",
        HTMLButtonElement: "readonly",
        HTMLInputElement: "readonly"
      }
    }
  },
  {
    rules: {
      "no-undef": "off"
    }
  }
];
