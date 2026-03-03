import type { Config } from "@react-router/dev/config";

export default {
	ssr: true,
	future: {
		v8_middleware: true,
	},
	// Note: allowedActionOrigins is intentionally not set here because:
	// 1. It's evaluated at build time, but CSRF_ORIGINS is a runtime env var
	// 2. We already have CSRF protection via Payload (server/env.ts)
	// 3. React Router defaults to same-origin only when not set, which is secure
	// If you need to configure this, set it at build time with the correct env vars
} satisfies Config;
