import { envVars, validateEnvVars } from "./services/env";
import { Payload } from "payload";
import { testConnections } from "./services/health-check";
import { dumpDatabase } from "./services/dump";
import { JobQueue } from "./services/job-queue";
import { sandboxReset } from "./tasks/sandbox-reset";
import { PlatformDetectionResult as _PlatformDetectionResult , DeploymentPlatform as _DeploymentPlatform , PlatformInfo as _PlatformInfo  , detectPlatform, getPlatformOptimizations, logPlatformInfo, DeploymentPlatform, PlatformDetectionResult } from "./services/hosting-platform-detection"
// export * as HostingPlatformDetection from "./services/hosting-platform-detection";


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
    public static readonly envVars = envVars;
    public static readonly JobQueue = JobQueue;
    public static readonly Tasks = { 
        sandboxReset: sandboxReset,
    }

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

    async detectPlatform( env ?: Record<string, string>) {
        return detectPlatform(env);
    }

    async getPlatformOptimizations(platform: DeploymentPlatform) {
        return getPlatformOptimizations(platform);
    }

    async logPlatformInfo(result: PlatformDetectionResult) {
        return logPlatformInfo(result);
    }
}

