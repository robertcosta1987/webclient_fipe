import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // LGPD (Art. 6º III): never write personal data to logs. Flags console.* calls
  // that reference identifiers/properties whose name denotes PII. Scoped to the
  // runtime app (src); operational scripts log non-PII diagnostics.
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.object.name='console'] MemberExpression[property.name=/^(email|cpf|cnpj|telefone|phone|senha|password|placa|ip|userAgent|user_agent|endereco|address)$/]",
          message: "LGPD: não registre dados pessoais em logs (Art. 6º III).",
        },
        {
          selector:
            "CallExpression[callee.object.name='console'] Identifier[name=/^(email|cpf|cnpj|telefone|phone|senha|password|placa|ip|userAgent|endereco|address)$/]",
          message: "LGPD: não registre dados pessoais em logs (Art. 6º III).",
        },
      ],
    },
  },
]);

export default eslintConfig;
