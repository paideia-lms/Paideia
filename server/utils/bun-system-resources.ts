/**
 * System Resources Detection Utility
 * Detects available RAM, CPU, and other system resources
 */

import { cpus, freemem, loadavg, totalmem } from "node:os";
import { $ } from "bun";


/**
 * Parse memory information from /proc/meminfo (Linux)
 */
async function parseMemInfoLinux(): Promise<SystemResources["memory"] | null> {
    try {
        const meminfo = await Bun.file("/proc/meminfo").text();
        const lines = meminfo.split("\n");

        let totalKb = 0;
        let availableKb = 0;
        let freeKb = 0;
        let buffersKb = 0;
        let cachedKb = 0;

        for (const line of lines) {
            const [key, valueStr] = line.split(":");
            if (!valueStr) continue;

            const value = parseInt(valueStr.trim().split(" ")[0]!, 10);
            if (Number.isNaN(value)) continue;

            switch (key) {
                case "MemTotal":
                    totalKb = value;
                    break;
                case "MemAvailable":
                    availableKb = value;
                    break;
                case "MemFree":
                    freeKb = value;
                    break;
                case "Buffers":
                    buffersKb = value;
                    break;
                case "Cached":
                    cachedKb = value;
                    break;
            }
        }

        const total = totalKb * 1024;
        const available =
            availableKb > 0
                ? availableKb * 1024
                : (freeKb + buffersKb + cachedKb) * 1024;
        const used = total - available;
        const percentage = total > 0 ? (used / total) * 100 : 0;

        return {
            total,
            available,
            used,
            percentage: Math.round(percentage * 100) / 100,
        };
    } catch {
        // /proc/meminfo doesn't exist on non-Linux systems - this is expected
        return null;
    }
}

/**
 * Get memory information using system commands (fallback)
 */
async function getMemoryInfoFallback(): Promise<
    SystemResources["memory"] | null
> {
    try {
        // Try different approaches based on platform
        const platform = process.platform;

        if (platform === "darwin") {
            // macOS - use vm_stat and sysctl
            const [vmStat, hwMemsize] = await Promise.all([
                $`vm_stat`.text(),
                $`sysctl -n hw.memsize`.text(),
            ]);

            const totalBytes = parseInt(hwMemsize.trim(), 10);
            const vmLines = vmStat.split("\n");

            let freePages = 0;
            let inactivePages = 0;
            let speculativePages = 0;
            let pageSize = 4096; // Default page size

            for (const line of vmLines) {
                if (line.includes("page size of")) {
                    const match = line.match(/page size of (\d+) bytes/);
                    if (match) pageSize = parseInt(match[1]!, 10);
                } else if (line.includes("Pages free:")) {
                    const match = line.match(/Pages free:\s+(\d+)/);
                    if (match) freePages = parseInt(match[1]!, 10);
                } else if (line.includes("Pages inactive:")) {
                    const match = line.match(/Pages inactive:\s+(\d+)/);
                    if (match) inactivePages = parseInt(match[1]!, 10);
                } else if (line.includes("Pages speculative:")) {
                    const match = line.match(/Pages speculative:\s+(\d+)/);
                    if (match) speculativePages = parseInt(match[1]!, 10);
                }
            }

            const availableBytes =
                (freePages + inactivePages + speculativePages) * pageSize;
            const usedBytes = totalBytes - availableBytes;
            const percentage = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;

            return {
                total: totalBytes,
                available: availableBytes,
                used: usedBytes,
                percentage: Math.round(percentage * 100) / 100,
            };
        } else if (platform === "linux") {
            // Linux - try free command as fallback
            const freeOutput = await $`free -b`.text();
            const lines = freeOutput.split("\n");
            const memLine = lines.find((line) => line.startsWith("Mem:"));

            if (memLine) {
                const parts = memLine.split(/\s+/);
                const total = parseInt(parts[1]!, 10);
                const used = parseInt(parts[2]!, 10);
                const available = parseInt(parts[6]! || parts[3]!, 10); // available or free
                const percentage = total > 0 ? (used / total) * 100 : 0;

                return {
                    total,
                    available,
                    used,
                    percentage: Math.round(percentage * 100) / 100,
                };
            }
        }

        return null;
    } catch {
        // System commands may not be available or have different syntax - this is expected
        return null;
    }
}

/**
 * Get CPU information
 */
async function getCpuInfo(): Promise<SystemResources["cpu"]> {
    const cores = navigator?.hardwareConcurrency || cpus().length;
    const architecture = process.arch;

    let model: string | undefined;

    try {
        const platform = process.platform;

        if (platform === "linux") {
            // Try to read CPU info from /proc/cpuinfo
            const cpuinfo = await Bun.file("/proc/cpuinfo").text();
            const modelMatch = cpuinfo.match(/model name\s*:\s*(.+)/);
            if (modelMatch) {
                model = modelMatch[1]!.trim();
            }
        } else if (platform === "darwin") {
            // macOS - use sysctl
            const brandString = await $`sysctl -n machdep.cpu.brand_string`.text();
            model = brandString.trim();
        }
    } catch {
        // CPU model detection may fail on some systems - this is expected
    }

    return {
        cores,
        model,
        architecture,
    };
}

/**
 * Get disk information for the current working directory
 */
async function getDiskInfo(): Promise<SystemResources["disk"] | null> {
    try {
        const platform = process.platform;

        if (platform === "linux") {
            // Linux - use df with -B1 for byte output
            const dfOutput = await $`df -B1 .`.text();
            const lines = dfOutput.split("\n");
            const dataLine = lines[1]; // First line is header

            if (dataLine) {
                const parts = dataLine.split(/\s+/);
                const total = parseInt(parts[1]!, 10);
                const used = parseInt(parts[2]!, 10);
                const available = parseInt(parts[3]!, 10);
                const percentage = total > 0 ? (used / total) * 100 : 0;

                return {
                    total,
                    used,
                    available,
                    percentage: Math.round(percentage * 100) / 100,
                };
            }
        } else if (platform === "darwin") {
            // macOS - use df with -b for 512-byte blocks, then convert to bytes
            const dfOutput = await $`df -b .`.text();
            const lines = dfOutput.split("\n");
            const dataLine = lines[1]; // First line is header

            if (dataLine) {
                const parts = dataLine.split(/\s+/);
                const total = parseInt(parts[1]!, 10) * 512; // Convert 512-byte blocks to bytes
                const used = parseInt(parts[2]!, 10) * 512;
                const available = parseInt(parts[3]!, 10) * 512;
                const percentage = total > 0 ? (used / total) * 100 : 0;

                return {
                    total,
                    used,
                    available,
                    percentage: Math.round(percentage * 100) / 100,
                };
            }
        }

        return null;
    } catch {
        // Disk info detection may fail on some systems - this is expected
        return null;
    }
}

/**
 * Get load average (Unix systems only)
 */
function getLoadAverage(): number[] | undefined {
    try {
        if (process.platform !== "win32") {
            return loadavg();
        }
        return undefined;
    } catch {
        // Load average is not available on all systems - this is expected
        return undefined;
    }
}

/**
 * Get OS distribution information for Linux systems
 */
async function getLinuxDistribution(): Promise<{ distribution?: string, version?: string, codename?: string } | null> {
    try {
        const osRelease = await Bun.file("/etc/os-release").text();
        const lines = osRelease.split("\n");

        let distribution: string | undefined;
        let version: string | undefined;
        let codename: string | undefined;

        for (const line of lines) {
            const [key, value] = line.split("=");
            if (!value) continue;

            const cleanValue = value.replace(/"/g, "");

            switch (key) {
                case "ID":
                    distribution = cleanValue;
                    break;
                case "VERSION_ID":
                    version = cleanValue;
                    break;
                case "VERSION_CODENAME":
                    codename = cleanValue;
                    break;
            }
        }

        return { distribution, version, codename };
    } catch {
        // /etc/os-release doesn't exist or is not readable
        return null;
    }
}

/**
 * Get OS information for macOS systems
 */
async function getMacOSInfo(): Promise<{ distribution?: string, version?: string, codename?: string } | null> {
    try {
        const swVers = await $`sw_vers`.text();
        const lines = swVers.split("\n");

        let productName: string | undefined;
        let productVersion: string | undefined;
        let productVersionExtra: string | undefined;

        for (const line of lines) {
            const [key, value] = line.split(":");
            if (!key || !value) continue;

            const cleanValue = value.trim();

            switch (key.trim()) {
                case "ProductName":
                    productName = cleanValue;
                    break;
                case "ProductVersion":
                    productVersion = cleanValue;
                    break;
                case "ProductVersionExtra":
                    productVersionExtra = cleanValue;
                    break;
            }
        }

        // Determine codename based on version
        let codename: string | undefined;
        if (productVersion) {
            const majorVersion = productVersion.split(".")[0];
            const minorVersion = productVersion.split(".")[1];

            switch (majorVersion) {
                case "14":
                    codename = minorVersion === "0" ? "sonoma" : "sonoma";
                    break;
                case "13":
                    codename = "ventura";
                    break;
                case "12":
                    codename = "monterey";
                    break;
                case "11":
                    codename = "bigsur";
                    break;
                case "10":
                    if (minorVersion === "15") codename = "catalina";
                    else if (minorVersion === "14") codename = "mojave";
                    else if (minorVersion === "13") codename = "highsierra";
                    break;
            }
        }

        return {
            distribution: productName?.toLowerCase().replace(" ", ""),
            version: productVersion,
            codename
        };
    } catch {
        // sw_vers command failed
        return null;
    }
}

/**
 * Detect system resources
 */
export async function detectSystemResources(): Promise<SystemResources> {
    // Get memory information - try Linux /proc/meminfo first, then fallback
    let memory: SystemResources["memory"];
    const linuxMemory = await parseMemInfoLinux();
    if (linuxMemory) {
        memory = linuxMemory;
    } else {
        const fallbackMemory = await getMemoryInfoFallback();
        if (fallbackMemory) {
            memory = fallbackMemory;
        } else {
            // Ultimate fallback using Node.js os module
            const total = totalmem();
            const free = freemem();
            const used = total - free;
            const percentage = total > 0 ? (used / total) * 100 : 0;

            memory = {
                total,
                available: free,
                used,
                percentage: Math.round(percentage * 100) / 100,
            };
        }
    }

    // Get CPU information
    const cpu = await getCpuInfo();

    // Get disk information
    const disk = await getDiskInfo();

    // Get OS information
    const platform = process.platform;
    let osInfo: { distribution?: string, version?: string, codename?: string } | null = null;

    if (platform === "linux") {
        osInfo = await getLinuxDistribution();
    } else if (platform === "darwin") {
        osInfo = await getMacOSInfo();
    }

    const os = {
        platform,
        distribution: osInfo?.distribution,
        version: osInfo?.version,
        codename: osInfo?.codename,
    };

    // Get system uptime
    const uptime = process.uptime();

    // Get load average
    const loadAverage = getLoadAverage();

    return {
        memory,
        cpu,
        disk,
        os,
        uptime,
        loadAverage,
    };
}

/**
 * Format bytes to human readable format
 */
export function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

/**
 * Format percentage with color coding
 */
export function getResourceStatus(
    percentage: number,
): "good" | "warning" | "error" {
    if (percentage < 70) return "good";
    if (percentage < 85) return "warning";
    return "error";
}

// System Resources Types
export interface SystemResources {
    memory: {
        total: number; // Total RAM in bytes
        available: number; // Available RAM in bytes
        used: number; // Used RAM in bytes
        percentage: number; // Used percentage (0-100)
    };
    cpu: {
        cores: number; // Number of CPU cores
        model?: string; // CPU model name
        architecture: string; // CPU architecture (x64, arm64, etc.)
        usage?: number; // CPU usage percentage (0-100) - optional, requires monitoring
    };
    disk?: {
        total: number; // Total disk space in bytes
        available: number; // Available disk space in bytes
        used: number; // Used disk space in bytes
        percentage: number; // Used percentage (0-100)
    } | null;
    os: {
        platform: string; // Platform (linux, darwin, win32)
        distribution?: string; // Distribution name (ubuntu, debian, centos, macos)
        version?: string; // Version string
        codename?: string; // Codename (focal, bullseye, monterey)
    };
    uptime: number; // System uptime in seconds
    loadAverage?: number[]; // Load average [1min, 5min, 15min] - Unix only
}