import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import firebaseRulesPlugin from "@firebase/eslint-plugin-security-rules";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  firebaseRulesPlugin.configs["flat/recommended"],
  globalIgnores([
    "dist/**/*",
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
    ".playwright-cli/**",
  ]),
]);

export default eslintConfig;
