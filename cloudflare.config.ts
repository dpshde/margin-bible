import { bindings, defineConfig } from "cf/config";

// migrations_dir ("migrations") is applied with `cf d1 migrations apply --dir migrations`.
export default defineConfig({
	accountId: "91ff2c2b757414041aeaa00896a8a43f",
	worker: {
		name: "margin-bible",
		compatibilityDate: "2026-09-01",
		entrypoint: "src/index.ts",
		workersDev: true,
		observability: {
			enabled: true,
			redactQueryString: true,
			issues: {
				enabled: true,
			},
			logs: {
				enabled: true,
			},
			traces: {
				enabled: true,
			},
		},
		assets: {
			runWorkerFirst: true,
		},
		env: {
			DB: bindings.d1({
				name: "margin-bible",
				id: "0f48d232-f2d8-46c2-a8a3-3b36c4279feb",
			}),
			ASSETS: bindings.assets(),
		},
	},
});
