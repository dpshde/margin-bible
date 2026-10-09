import { defineWranglerConfig } from "wrangler/experimental-config";

export default defineWranglerConfig({
	// Upload source maps with each version so Workers Issues stack traces and
	// on-demand CPU/memory profiles (`mise run profile`) show TypeScript names.
	uploadSourceMaps: true,
	types: {
		generate: false,
	},
	assetsDirectory: "./assets",
});
