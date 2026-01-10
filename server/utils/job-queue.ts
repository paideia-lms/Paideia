/**
 * Queue names used for Payload job scheduling
 * These queues are configured in the jobs.autoRun section
 */
export enum JobQueue {
	/** Queue that runs every second - used for processing waitUntil jobs */
	SECONDLY = "secondly",
	/** Queue that runs every minute */
	MINUTE = "minute",
	/** Queue that runs every hour */
	HOURLY = "hourly",
	/** Queue that runs every 3 hours */
	THREE_HOURLY = "3-hourly",
	/** Queue that runs every 6 hours */
	SIX_HOURLY = "6-hourly",
	/** Queue that runs every 12 hours */
	TWELVE_HOURLY = "12-hourly",
	/** Queue that runs daily at midnight */
	NIGHTLY = "nightly",
	/** Default queue (not in autoRun, requires manual processing) */
	DEFAULT = "default",
}
