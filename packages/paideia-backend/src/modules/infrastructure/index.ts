import { envVars, validateEnvVars } from "./services/env";
import { Payload } from "payload";
import { testConnections } from "./services/health-check";
import { dumpDatabase } from "./services/dump";
import { sandboxReset } from "./tasks/sandbox-reset";
import { PlatformDetectionResult as _PlatformDetectionResult, DeploymentPlatform as _DeploymentPlatform, PlatformInfo as _PlatformInfo, detectPlatform, getPlatformOptimizations, logPlatformInfo, DeploymentPlatform, PlatformDetectionResult } from "./services/hosting-platform-detection"
import { s3Client } from "./services/s3-client";
import { commands as sandboxCommands } from "./cli/sandbox";
import { commands as migrateCommands } from "./cli/migrate";
import { trySendEmail, TrySendEmailArgs } from "./services/email";
// export * as HostingPlatformDetection from "./services/hosting-platform-detection";

// enum JobQueue {
//     /** Queue that runs every second - used for processing waitUntil jobs */
//     SECONDLY = "secondly",
//     /** Queue that runs every minute */
//     MINUTE = "minute",
//     /** Queue that runs every hour */
//     HOURLY = "hourly",
//     /** Queue that runs every 3 hours */
//     THREE_HOURLY = "3-hourly",
//     /** Queue that runs every 6 hours */
//     SIX_HOURLY = "6-hourly",
//     /** Queue that runs every 12 hours */
//     TWELVE_HOURLY = "12-hourly",
//     /** Queue that runs daily at midnight */
//     NIGHTLY = "nightly",
//     /** Default queue (not in autoRun, requires manual processing) */
//     DEFAULT = "default",
// }


export namespace InfrastructureModule {
    export type TestConnectionsResult = Awaited<ReturnType<typeof testConnections>>;
    export type PlatformDetectionResult = _PlatformDetectionResult;
    export type DeploymentPlatform = _DeploymentPlatform;
    export type PlatformInfo = _PlatformInfo;

}

/**
 * Infrastructure Module - responsible for infrastructure services
 * 
 * this is the single point of export for the infrastructure module.
 */
export class InfrastructureModule {
    private readonly payload: Payload;
    public static readonly s3Client = s3Client;
    public static readonly envVars = envVars;
    public static readonly tasks = [sandboxReset]
    public static readonly cli = {
        ...sandboxCommands,
        ...migrateCommands,
    }
    public static readonly collections = []
    public static readonly search = []
    public static readonly queues = [{
        //     ┌───────────── (optional) second (0 - 59)
        //     │ ┌───────────── minute (0 - 59)
        // 	   │ │ ┌───────────── hour (0 - 23)
        // 	   │ │ │ ┌───────────── day of the month (1 - 31)
        // 	   │ │ │ │ ┌───────────── month (1 - 12)
        // 	   │ │ │ │ │ ┌───────────── day of the week (0 - 6) (Sunday to Saturday)
        // 	   │ │ │ │ │ │
        // 	   │ │ │ │ │ │
        //  - '* 0 * * * *' every hour at minute 0
        //  - '* 0 0 * * *' daily at midnight
        //  - '* 0 0 * * 0' weekly at midnight on Sundays
        //  - '* 0 0 1 * *' monthly at midnight on the 1st day of the month
        //  - '* 0/5 * * * *' every 5 minutes
        //  - '* * * * * *' every second
        cron: `0 0 * * *`, // Every day at midnight
        queue: "nightly",
    },
    {
        cron: `* * * * * *`, // every second
        queue: "secondly",
    },
    {
        cron: `* * * * *`, // every minute
        queue: "minute",
    },
    {
        cron: `0 * * * *`, // every hour
        queue: "hourly",
    },
    {
        cron: "0 */3 * * *", // every 3 hours
        queue: "3-hourly",
    },
    {
        cron: "0 */6 * * *", // every 6 hours
        queue: "6-hourly",
    },
    {
        cron: "0 */12 * * *", // every 12 hours
        queue: "12-hourly",
    },]

    constructor(payload: Payload) {
        this.payload = payload;
    }

    /** 
     * this function is dangerous in a way that if fail, it will exit the process.
     */
    async validateEnvVars() {
        return validateEnvVars();
    }

    async testConnections() {
        return testConnections(this.payload);
    }

    async dumpDatabase(opts?: { outputPath?: string }) {
        return dumpDatabase({ payload: this.payload, outputPath: opts?.outputPath });
    }

    async detectPlatform(env?: Record<string, string>) {
        return detectPlatform(env);
    }

    async getPlatformOptimizations(platform: DeploymentPlatform) {
        return getPlatformOptimizations(platform);
    }

    async logPlatformInfo(result: PlatformDetectionResult) {
        return logPlatformInfo(result);
    }

    async sendEmail(args: Omit<TrySendEmailArgs, "payload">) {
        return trySendEmail({
            payload: this.payload,
            ...args,
        });
    }
}

