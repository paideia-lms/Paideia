const ADMIN_EMAIL = "admin@example.com" as const;
const ADMIN_PASSWORD = "adminpassword123" as const;

export const devConstants = {
	ADMIN_EMAIL,
	ADMIN_PASSWORD,
};

/** Used as a large limit for "unbounded" queries in media usage checks. */
export const MOCK_INFINITY = 999999999999999;
