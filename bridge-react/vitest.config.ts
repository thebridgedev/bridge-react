import { defineConfig } from 'vitest/config';

/**
 * Unit tests run against auth-core's fake issuer. Plain modules run in Node;
 * component tests (`*.test.tsx`) say `@vitest-environment jsdom` at the top. Test files live next to the
 * code and are kept out of the npm tarball by the build's excludes.
 */
export default defineConfig({
	test: {
		include: ['src/**/*.{spec,test}.{ts,tsx}'],
		environment: 'node',
		globals: false,
		testTimeout: 10000,
	},
});
