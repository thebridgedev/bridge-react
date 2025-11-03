import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";

const packageJson = require("./package.json");

export default [
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
    external: [
      "react", 
      "react-dom", 
      "react/jsx-runtime",
      "jwt-decode",
      "zustand",
      "jose"
    ],
  },
];

