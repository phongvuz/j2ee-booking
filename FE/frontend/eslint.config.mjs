import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["tests/**/*.cjs", "scripts/**/*.cjs", "prisma/seed.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { varsIgnorePattern: "^_" }],
    },
  },
  globalIgnores([
    ".next/**",
    ".next-demo/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".local-backups/**",
    "docs/**",
  ]),
]);

export default eslintConfig;
