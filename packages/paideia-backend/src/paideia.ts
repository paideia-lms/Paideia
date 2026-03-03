import type { Migration, Payload } from "payload";
import { getPayload } from "payload";
import sanitizedConfig from "./payload.config";
import { testConnections } from "./health-check";
import { migrations } from "./migrations";
import { validateEnvVars } from "./env";

export type { Payload, Migration };

export { migrations };

export type SanitizedConfig = typeof sanitizedConfig;

/**
 * Paideia backend - encapsulates Payload CMS instance, config, migrations, and CLI.
 */
export class Paideia {
	private payload: Payload | null = null;
	private config = sanitizedConfig;

	constructor() {
		validateEnvVars();
	}

	async init(): Promise<Payload> {
		if (this.payload) {
			return this.payload;
		}
		this.payload = await getPayload({
			config: this.config,
			cron: true,
			key: "paideia",
		});
		await testConnections(this.payload);
		return this.payload;
	}

	getPayload(): Payload {
		if (!this.payload) {
			throw new Error(
				"Paideia not initialized. Call init() before getPayload().",
			);
		}
		return this.payload;
	}

	getConfig(): SanitizedConfig {
		return this.config;
	}

	getMigrations(): typeof migrations {
		return migrations;
	}

	async configureCommands(): Promise<import("commander").Command> {
		const { configureCommands } = await import("./cli/commands");
		return configureCommands(this.getPayload());
	}
}
