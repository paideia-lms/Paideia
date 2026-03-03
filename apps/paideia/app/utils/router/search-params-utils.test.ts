import { describe, expect, test } from "bun:test";
import { getRouteUrl } from "./search-params-utils";

describe("getRouteUrl", () => {
	test("should generate URL for route with no params and no searchParams", () => {
		const url = getRouteUrl("/login", {});
		expect(url).toBe("/login");
	});

	test("should generate URL for route with params but no searchParams", () => {
		const url = getRouteUrl("/api/media/file/:mediaId", {
			params: { mediaId: "123" },
			searchParams: {
				download: true,
			},
		});
		expect(url).toBe("/api/media/file/123?download=true");
	});
});
