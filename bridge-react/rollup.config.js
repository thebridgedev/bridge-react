import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";

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

// ONE build with both entries (TBP-665). The main entry (auth + payments +
// flags, full surface) and the flags-only entry
// (`@nebulr-group/bridge-react/flags`, auth-free, TBP-200) used to be two
// separate rollup configs, so each bundle inlined its own copy of every module
// they share — including the flag registry and the runtime's status stores.
// `<BridgeProvider>` registered the flag instance in the main copy, and a
// `useFlag` imported from `/flags` read the other copy and returned the
// default forever. Built together, shared modules land in `dist/chunks/` and
// both entries import the same instance. The `/flags` entry still pulls in
// only the modules it reaches, so it stays auth-free.
//
// Entry file names are unchanged, so package.json `main` / `module` /
// `exports` resolve exactly as before.
export default {
  input: {
    index: "src/index.ts",
    "flags/index": "src/flags/index.ts",
  },
  output: [
    {
      dir: "dist",
      format: "cjs",
      entryFileNames: "[name].cjs.js",
      chunkFileNames: "chunks/[name]-[hash].cjs.js",
      exports: "named",
    },
    {
      dir: "dist",
      format: "es",
      entryFileNames: "[name].esm.js",
      chunkFileNames: "chunks/[name]-[hash].esm.js",
    },
  ],
  plugins: [
    typescript({
      tsconfig: "./tsconfig.json",
    }),
    terser(),
  ],
  external,
};
