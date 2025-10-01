// 📄 eslint.config.js
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ✅ FlatCompat 사용
const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  // ✅ next/core-web-vitals 및 typescript 설정 확장
  ...compat.extends("next/core-web-vitals", "next"),

  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",   // any 허용
      "@typescript-eslint/ban-ts-comment": "off",    // ts-ignore 허용
      "@typescript-eslint/explicit-module-boundary-types": "off",
    },
  },
];
