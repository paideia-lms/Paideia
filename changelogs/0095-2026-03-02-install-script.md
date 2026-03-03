# Install Script

**Date:** March 2, 2026  
**Type:** Developer Experience  
**Impact:** Medium - Adds convenient installation method for the latest release

## Overview

Added `scripts/install.sh` for easy installation of the latest Paideia release from GitHub. The script automatically detects the operating system and architecture, downloads the appropriate binary, and installs it to a directory in PATH.

## Features Added

### 1. Cross-Platform Binary Installation

**Features**:
- Supports Linux (amd64, arm64), macOS arm64 (Apple Silicon), and Windows (via Git Bash/MSYS2/WSL)
- Automatically detects OS and CPU architecture
- No authentication required for public repository
- Downloads from GitHub Releases API

**Implementation**:
- OS detection: `uname -s` mapped to lowercase (darwin, linux, mingw*)
- Architecture detection: `uname -m` mapped (x86_64/amd64, aarch64/arm64)
- Asset naming follows release format: `paideia-linux-amd64`, `paideia-linux-arm64`, `paideia-macos-arm64`, `paideia.exe`
- Uses GitHub Releases API to fetch latest release and download assets

### 2. Smart Install Location

**Features**:
- Prefers `~/.local/bin`, then `~/bin`, then `/usr/local/bin`
- Creates `~/.local/bin` if it doesn't exist
- Validates write permissions before installing

**Implementation**:
- Checks each directory in order for existence and write permissions
- Falls back to `~/.local/bin` and creates if needed
- Exits with clear error if no writable location found

### 3. PATH Management

**Features**:
- Detects if install directory is already in PATH
- Automatically adds to `.bashrc`, `.zshrc`, or `.profile` if needed
- Provides instructions if automatic addition fails

**Implementation**:
- Checks `:$PATH:` for install directory presence
- Appends export statement to first available shell config
- Prints manual instructions if no config file writable

## Technical Details

### Installation Flow

1. Detect OS and architecture
2. Map to appropriate asset name
3. Fetch latest release from GitHub API
4. Find asset ID by name (jq or python3 fallback)
5. Download binary to temp directory
6. Determine install location
7. Move binary to install directory
8. Update PATH in shell config if needed

### Dependencies

- `curl` - For API requests and downloads
- `jq` or `python3` - For parsing JSON (jq preferred)
- No external dependencies beyond standard Unix tools

## Files Added

- `scripts/install.sh` - Installation script (executable)

## Usage

### Quick Install

```sh
curl -sSL https://raw.githubusercontent.com/paideia-lms/paideia/main/scripts/install.sh | bash
```

### Manual Download

Alternatively, download binaries directly from [GitHub Releases](https://github.com/paideia-lms/paideia/releases).

## Impact

### Positive Impacts

- **Convenience**: Single command to install latest version
- **Cross-platform**: Works on Linux, macOS, and Windows
- **No token required**: Public repository, no GitHub authentication needed
- **PATH handling**: Automatically configures shell for new users

### User Experience

- Clear download progress
- Informative error messages for unsupported configurations
- Automatic PATH setup with instructions for manual configuration

## Related Changes

- README.md updated with install script instructions
- Release assets follow consistent naming convention
