import { Result } from "typescript-result";
import semver from "semver";
import { transformError, UnknownError } from "~/utils/error";
import type { BaseInternalFunctionArgs } from "./utils/internal-function-utils";

// Docker Hub API configuration
const DOCKER_HUB_USER = "hananoshikayomaru";
const DOCKER_HUB_REPO = "paideia";
const API_URL = `https://hub.docker.com/v2/repositories/${DOCKER_HUB_USER}/${DOCKER_HUB_REPO}/tags/?page_size=100`;

export interface GetLatestVersionArgs extends BaseInternalFunctionArgs {}

export interface LatestVersionResult {
	latestVersion: string;
	currentVersion: string;
	isUpdateAvailable: boolean;
}

/**
 * Fetches the latest semantic version tag from Docker Hub and compares it with the current version.
 * @returns Result with LatestVersionResult on success, error on failure
 */
export function tryGetLatestVersion(args: GetLatestVersionArgs & { currentVersion: string }) {
	return Result.try(
		async () => {
			const { currentVersion } = args;

					// Fetch tags from Docker Hub API
					const response = await fetch(API_URL);

					if (!response.ok) {
						throw new Error(
							`Failed to fetch Docker Hub tags: ${response.status} ${response.statusText}`,
						);
					}

					const json = (await response.json()) as {
						results?: Array<{ name: string }>;
					};

					const tags = json.results;

					if (!tags || tags.length === 0) {
						throw new Error("No tags found for this repository");
					}

					// Filter for valid semantic versions
					const versionTags = tags
						.map((tag) => tag.name)
						.filter((tag) => semver.valid(tag));

					if (versionTags.length === 0) {
						throw new Error("No valid semantic version tags found");
					}

					// Sort versions from highest to lowest
					const sortedVersions = semver.rsort(versionTags);
					const latestVersion = sortedVersions[0];

					if (!latestVersion) {
						throw new Error("Could not determine latest version");
					}

					// Compare with current version
					const isUpdateAvailable = semver.gt(latestVersion, currentVersion);

					return {
						latestVersion,
						currentVersion,
						isUpdateAvailable,
					};
		},
		(error) =>
		transformError(error) ??
		new UnknownError("Failed to get latest version from Docker Hub", {
			cause: error,
		})
	);
}
