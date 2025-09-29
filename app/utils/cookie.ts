export function setCookie(token: string, exp: number, domainUrl: string) {
	return `payload-token=${token}; Path=/; ${domainUrl}; HttpOnly; SameSite=Lax; Max-Age=${exp}`;
}

export function removeCookie(domainUrl: string) {
	return `payload-token=; Path=/; ${domainUrl}; HttpOnly; SameSite=Lax; Max-Age=0`;
}
