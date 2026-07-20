import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.turbo/**",
      "**/coverage/**",
      "**/release/**"
    ]
  },
  {
    files: ["**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}"],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: "latest",
      sourceType: "module"
    },
    rules: {}
  },
  {
    files: ["**/*.cjs"],
    languageOptions: {
      sourceType: "commonjs"
    }
  }
);
