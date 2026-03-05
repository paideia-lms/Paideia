import { describe, expect, it } from "bun:test";
import semver from "semver";
import { tryGetLatestVersion } from "../services/version-management";

describe("Version Management", () => {
	it("should return latest version info when Docker Hub is reachable", async () => {
		const result = await tryGetLatestVersion({ currentVersion: "0.0.0" });
		expect(result.ok).toBe(true);
		if (!result.ok) {
			return;
		}
		expect(semver.valid(result.value.latestVersion)).toBeTruthy();
		expect(result.value.currentVersion).toBe("0.0.0");
		expect(typeof result.value.isUpdateAvailable).toBe("boolean");
		expect(result.value.isUpdateAvailable).toBe(true);
	});

	it("should report no update when current version is higher than latest", async () => {
		const result = await tryGetLatestVersion({
			currentVersion: "999.999.999",
		});
		expect(result.ok).toBe(true);
		if (!result.ok) {
			return;
		}
		expect(result.value.isUpdateAvailable).toBe(false);
		expect(result.value.currentVersion).toBe("999.999.999");
	});
});
