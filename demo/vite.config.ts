import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const plugin = (path: string) => fileURLToPath(new URL(`../bridge-react/src/${path}`, import.meta.url));

/**
 * A stand-in for the app's own API, so the demo needs no server: it refuses
 * an export at a plan limit with the 402 a server plugin answers at the cap.
 * The browser's side (the upgrade dialog) is what the demo shows.
 */
function demoApi(): Plugin {
	const limit = { code: 'QUOTA_EXCEEDED', message: 'Your plan allows 10 exports this month.', metric: 'exports', used: 10, limit: 10, fix: '/subscription' };
	return {
		name: 'demo-api',
		configureServer(server) {
			server.middlewares.use('/api/exports', (request, response) => {
				response.statusCode = request.method === 'POST' ? 402 : 405;
				response.setHeader('content-type', 'application/json');
				response.end(JSON.stringify(limit));
			});
		},
	};
}

export default defineConfig({
	plugins: [react(), demoApi()],
	// The demo imports the plugin from source, with one copy of React and auth-core for both.
	resolve: {
		alias: [
			{ find: /^@nebulr-group\/bridge-react\/styles$/, replacement: plugin('styles.css') },
			{ find: /^@nebulr-group\/bridge-react$/, replacement: plugin('index.ts') },
		],
		dedupe: ['react', 'react-dom', '@nebulr-group/bridge-auth-core'],
	},
	server: {
		host: '0.0.0.0',
		port: 3001,
		strictPort: true,
		fs: { allow: ['..'] },
	},
	preview: {
		host: '0.0.0.0',
		port: 3001,
		strictPort: true,
	},
});
