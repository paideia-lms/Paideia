/**
 * Seed logger utility
 * Provides consistent logging for seed operations
 */
export const seedLogger = {
	info: (message: string) => console.log(message),
	success: (message: string) => console.log(`✅ ${message}`),
	warning: (message: string) => console.log(`⚠️  ${message}`),
	error: (message: string) => console.error(`❌ ${message}`),
	section: (title: string) => console.log(`\n📦 ${title}`),
};
