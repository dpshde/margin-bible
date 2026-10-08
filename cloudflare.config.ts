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
			// Workers Rate Limiting. Period is 10 or 60 seconds and counters are per location.
			// Namespace 73001 is shade-stage-charts; these ids are margin-bible only.
			// 30/60s per IP for Hidden Arrow search + suggest.
			HA_RATE_LIMIT: bindings.rateLimit({
				namespace: "91011",
				simple: { limit: 30, period: 60 },
			}),
			// 10/60s per session or IP for paid title suggestions.
			SUGGEST_RATE_LIMIT: bindings.rateLimit({
				namespace: "91012",
				simple: { limit: 10, period: 60 },
			}),
			// 120/60s per IP for the other public /api routes.
			PUBLIC_API_RATE_LIMIT: bindings.rateLimit({
				namespace: "91013",
				simple: { limit: 120, period: 60 },
			}),
		},
	},
});
