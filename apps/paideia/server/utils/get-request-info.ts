import { UAParser } from "ua-parser-js";
import { getDomainUrl } from "./get-domain-url.js";
import { getIpFromRequest } from "./get-ip-from-request.js";

export const getRequestInfo = (request: Request) => {
	// Parse User-Agent
	const userAgent = request.headers.get("user-agent") as string;
	const uaParser = new UAParser(userAgent);
	const browser = uaParser.getBrowser(); // { name: 'Chrome', version: '107.0.0.0' }
	const os = uaParser.getOS(); // { name: 'Windows', version: '10' }
	const device = uaParser.getDevice(); // { model: undefined, type: undefined, vendor: undefined }
	const domainUrl = getDomainUrl(request);
	const ip = getIpFromRequest(request);

	return { browser, os, device, domainUrl, ip };
};

export type RequestInfo = ReturnType<typeof getRequestInfo>;
