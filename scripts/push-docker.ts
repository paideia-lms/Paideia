#!/usr/bin/env bun

/**
 * Script to build and push Docker images to Docker Hub and GitHub Container Registry
 * 
 * Requirements:
 * - GITHUB_TOKEN environment variable
 * - DOCKERHUB_USERNAME environment variable
 * - DOCKERHUB_TOKEN environment variable
 * - Binaries must exist in dist/ directory:
 *   - dist/paideia-linux-arm64
 *   - dist/paideia-linux-amd64 (or dist/paideia-linux-x64 which will be renamed)
 * 
 * Usage:
 *   bun scripts/push-docker.ts
 */

import { existsSync } from "node:fs";
import { $ } from "bun";
import packageJson from "../package.json";

const version = packageJson.version;
const imageTag = `v${version}`;

console.log(`🐳 Building and pushing Docker images for version ${version}`);
console.log(`   Image tag: ${imageTag}`);
console.log("");

// Check required environment variables
const githubToken = process.env.GITHUB_TOKEN;
const dockerhubUsername = process.env.DOCKERHUB_USERNAME;
const dockerhubToken = process.env.DOCKERHUB_TOKEN;

if (!githubToken) {
    console.error("❌ GITHUB_TOKEN environment variable is not set");
    process.exit(1);
}

if (!dockerhubUsername) {
    console.error("❌ DOCKERHUB_USERNAME environment variable is not set");
    process.exit(1);
}

if (!dockerhubToken) {
    console.error("❌ DOCKERHUB_TOKEN environment variable is not set");
    process.exit(1);
}

// Ensure dist directory exists
if (!existsSync("dist")) {
    console.error("❌ dist/ directory does not exist. Please build binaries first.");
    process.exit(1);
}

// Check and prepare binaries
console.log("📦 Checking binaries...");

const arm64Binary = "dist/paideia-linux-arm64";
const x64Binary = "dist/paideia-linux-x64";
const amd64Binary = "dist/paideia-linux-amd64";

// Check ARM64 binary
if (!existsSync(arm64Binary)) {
    console.error(`❌ ARM64 binary not found: ${arm64Binary}`);
    console.error("   Please build binaries first: bun run build");
    process.exit(1);
}
console.log(`   ✅ Found ARM64 binary: ${arm64Binary}`);

// Check and prepare AMD64 binary
if (existsSync(amd64Binary)) {
    console.log(`   ✅ Found AMD64 binary: ${amd64Binary}`);
} else if (existsSync(x64Binary)) {
    console.log(`   📝 Renaming ${x64Binary} to ${amd64Binary}`);
    await $`mv ${x64Binary} ${amd64Binary}`;
    console.log(`   ✅ AMD64 binary ready: ${amd64Binary}`);
} else {
    console.error(`❌ AMD64/X64 binary not found: ${amd64Binary} or ${x64Binary}`);
    console.error("   Please build binaries first: bun run build");
    process.exit(1);
}

// Make binaries executable
await $`chmod +x ${arm64Binary} ${amd64Binary}`;
console.log("   ✅ Binaries are executable");
console.log("");

// Set up Docker Buildx
console.log("🔧 Setting up Docker Buildx...");
await $`docker buildx create --name paideia-builder --use --bootstrap || docker buildx use paideia-builder || true`;
console.log("   ✅ Docker Buildx ready");
console.log("");

// Login to GitHub Container Registry
console.log("🔐 Logging in to GitHub Container Registry...");
await $`echo ${githubToken} | docker login ghcr.io -u ${process.env.GITHUB_USERNAME || "paideia-lms"} --password-stdin`;
console.log("   ✅ Logged in to GitHub Container Registry");
console.log("");

// Login to Docker Hub
console.log("🔐 Logging in to Docker Hub...");
await $`echo ${dockerhubToken} | docker login -u ${dockerhubUsername} --password-stdin`;
console.log("   ✅ Logged in to Docker Hub");
console.log("");

// Build and push multi-platform image
console.log("🏗️  Building multi-platform Docker image...");
console.log(`   Platforms: linux/arm64, linux/amd64`);
console.log(`   Tags:`);
console.log(`     - ghcr.io/paideia-lms/paideia:${imageTag}`);
console.log(`     - ghcr.io/paideia-lms/paideia:latest`);
console.log(`     - ${dockerhubUsername}/paideia:${imageTag}`);
console.log(`     - ${dockerhubUsername}/paideia:latest`);
console.log("");

try {
    await $`docker buildx build --platform linux/arm64,linux/amd64 --file Dockerfile --tag ghcr.io/paideia-lms/paideia:${imageTag} --tag ghcr.io/paideia-lms/paideia:latest --tag ${dockerhubUsername}/paideia:${imageTag} --tag ${dockerhubUsername}/paideia:latest --push .`;

    console.log("");
    console.log("✅ Docker images built and pushed successfully!");
    console.log("");
    console.log("📦 Published images:");
    console.log(`   - ghcr.io/paideia-lms/paideia:${imageTag}`);
    console.log(`   - ghcr.io/paideia-lms/paideia:latest`);
    console.log(`   - ${dockerhubUsername}/paideia:${imageTag}`);
    console.log(`   - ${dockerhubUsername}/paideia:latest`);
} catch (error) {
    console.error("");
    console.error("❌ Failed to build and push Docker images");
    console.error(error);
    process.exit(1);
}

