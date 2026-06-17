import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";

const packageJson = require("./package.json");

const external = [
  "react",
  "react-dom",
  "react/jsx-runtime",
  "jwt-decode",
  "zustand",
  "jose",
  "@nebulr-group/bridge-auth-core",
  // Optional peer — dynamically imported by <PlanSelector> only for hosted
  // Stripe Checkout. Consumers install it themselves; keep it external.
  "@stripe/stripe-js",
];

export default [
  // Main entry — auth + payments + flags (full surface, backwards compatible)
  {
    input: "src/index.ts",
    output: [
      {
        file: packageJson.main,
        format: 'cjs',
      },
      {
        file: packageJson.module,
        format: 'es'
      },
    ],
    plugins: [
      typescript({
        tsconfig: "./tsconfig.json"
      }),
      terser()
    ],
    external,
  },
  // Flags-only entry — auth-free. Apps in standalone-FF mode import from
  // `@nebulr-group/bridge-react/flags` and the auth subtree is tree-shaken
  // out at bundle time. (TBP-200)
  {
    input: "src/flags/index.ts",
    output: [
      {
        file: "dist/flags/index.cjs.js",
        format: 'cjs',
      },
      {
        file: "dist/flags/index.esm.js",
        format: 'es'
      },
    ],
    plugins: [
      typescript({
        tsconfig: "./tsconfig.json"
      }),
      terser()
    ],
    external,
  },
];
