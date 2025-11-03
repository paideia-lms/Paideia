# Changelog 0031: Native Dependency Check and Sharp Removal

**Date**: November 3, 2025  
**Type**: Infrastructure Improvement  
**Impact**: Medium - Ensures pure JavaScript bundle and removes native dependency

## Overview

This update adds automated detection of native/binary dependencies in bundled code and removes the `sharp` dependency from the media collection to ensure the application can be bundled as a pure JavaScript executable. The build process now includes a pre-cleanup check that aborts if native dependencies are detected, preserving the build directory for inspection.

## Features Added

### 1. Native Dependency Detection Script

**New Script**: `scripts/check-native-deps.sh`

**Purpose**: Automatically scan bundled JavaScript files and detect packages with native/binary dependencies that would prevent creating a pure JavaScript executable.

**Features**:
- Extracts all imports from bundled code (`build/server/index.js`)
- Identifies packages with native dependencies through multiple detection methods:
  - `.node` files (native bindings)
  - Native binary files (`.so`, `.dylib`, `.dll`, `.a`, `.lib`)
  - `binding.gyp` files (node-gyp build configuration)
  - Native build tools in dependencies (`node-gyp`, `nan`, `node-addon-api`, etc.)
  - Optional dependencies with native binaries
  - Compiled native code in build directories
- Checks only production dependencies (ignores devDependencies)
- Provides detailed reporting of which packages have native dependencies and why

**Usage**:
```bash
# Check default build file
./scripts/check-native-deps.sh

# Check specific build file
./scripts/check-native-deps.sh build/server/index.js node_modules
```

**Output Example**:
```
📦 Checking: sharp
  ✅ NATIVE DEPENDENCIES FOUND:
     - Has native build tools in dependencies
     - Has optionalDependencies with native binaries

==================================================
SUMMARY
==================================================

Packages with native/binary dependencies: 1
  ❌ sharp

⚠️  WARNING: These packages contain native/binary dependencies!
   They may not work when bundled into a single pure JavaScript executable.
```

### 2. Build Process Integration

**Modified Files**: `scripts/build.ts`

**Changes**:
- Single build script now creates both macOS and Linux ARM64 binaries
- Added native dependency check before build cleanup
- Build process now automatically checks bundled code after `Bun.build()`
- If native dependencies detected:
  - Build aborts with error message
  - Build directory preserved for inspection
  - Exit code 1 (failure)
- If no native dependencies detected:
  - Build continues normally
  - Build directory cleaned up as before

**Benefits**:
- Single command builds both platforms (no Docker required for cross-compilation)
- With `sharp` removed, Linux binaries can be cross-compiled directly from macOS using Bun
- Simplified build process

**Implementation**:
```typescript
// Check for native dependencies before cleaning up build directory
console.log(`🔍 Checking for native dependencies in build/server/index.js...`);
const checkResult = await $`./scripts/check-native-deps.sh build/server/index.js node_modules`.nothrow();

if (checkResult.exitCode !== 0) {
	console.error(`❌ Build aborted: Native dependencies detected in bundled code!`);
	console.error(`   The build directory has been preserved for inspection.`);
	console.error(`   Please review the native dependencies and update your code to avoid bundling them.`);
	process.exit(1);
}

console.log(`✅ No native dependencies detected in bundled code.`);
```

## Changes Made

### 1. Removed Sharp Dependency

**File**: `server/collections/media.ts`

**Changes**:
- Removed `imageSizes` configuration from media upload settings
- Removed `adminThumbnail` configuration
- Added documentation comment explaining why sharp is not used
- Commented out image size configurations for future reference

**Before**:
```typescript
upload: {
	disableLocalStorage: true,
	imageSizes: [
		{
			name: "thumbnail",
			width: 400,
			height: 300,
			position: "centre",
		},
		// ... more sizes
	],
	adminThumbnail: "thumbnail",
}
```

**After**:
```typescript
/**
 * sharp is only required when you use these upload collection features:
 * - imageSizes - automatic image resizing to multiple sizes
 * - formatOptions - image format conversion
 * - resizeOptions - image resizing configuration
 * - crop - cropping functionality
 * - focalPoint - focal point selection
 */
upload: {
	disableLocalStorage: true,
	// ! we don't use image size for now because we don't want the sharp dependency
	// imageSizes: [ ... ]
}
```

**Impact**:
- Media collection no longer requires `sharp` package
- Image uploads still work, but automatic resizing is disabled
- Original images are stored and served as-is
- Future image processing features will need pure JavaScript alternatives

### 2. Detection Methods

The native dependency detection script uses multiple methods to identify packages with native dependencies:

1. **File-based Detection**:
   - `.node` files (V8 native bindings)
   - Native binaries (`.so`, `.dylib`, `.dll`, `.a`, `.lib`)
   - Compiled code in `build/Release` or `build/Default` directories

2. **Package.json Analysis**:
   - Native build tools in `dependencies` or `optionalDependencies`
   - Native keywords (`node-gyp`, `nan`, `node-addon-api`, `bindings`)
   - Pre-compiled binary packages (`prebuild`, `prebuild-install`)
   - Platform-specific optional dependencies

3. **Build Configuration**:
   - `binding.gyp` files (node-gyp build configuration)
   - Native build scripts in package.json

4. **Known Packages Whitelist**:
   - Hardcoded list of common native packages for reliability
   - Includes: `sharp`, `canvas`, `bcrypt`, `sqlite3`, `fsevents`, etc.

**Key Feature**: The script only checks production dependencies, ignoring devDependencies that don't affect the final bundle.

## Files Changed

### New Files
- `scripts/check-native-deps.sh`: Shell script for native dependency detection

### Modified Files
- `scripts/build.ts`: Added native dependency check before cleanup, now builds both macOS and Linux ARM64 binaries
- `server/collections/media.ts`: Removed `imageSizes` and `adminThumbnail` to eliminate sharp dependency
- `package.json`: Removed Docker-related build scripts (no longer needed since sharp removal enables direct cross-compilation)

## Technical Implementation

### Import Extraction

The script extracts imports from bundled JavaScript files using regex patterns:
- Handles `import ... from "package"` statements
- Handles side-effect imports `import "package"`
- Extracts package names from import paths (handles subpaths like `react/jsx-runtime` → `react`)
- Skips Node.js built-ins (`node:stream`, `node:fs`, etc.)

### Package Analysis

For each package found:
1. Check if package exists in `node_modules`
2. Scan for native binary files
3. Analyze `package.json` for native dependencies (production only)
4. Check for build directories with compiled code
5. Compare against known native packages list

### Build Integration

The check runs after `Bun.build()` completes:
- Checks the actual bundled output (`build/server/index.js`)
- Provides clear error messages if issues found
- Preserves build artifacts for debugging
- Non-blocking check (uses `.nothrow()` to capture exit code)

## Benefits

### For Pure JavaScript Bundle

1. **Executable Compatibility**: Ensures bundled executable works without platform-specific binaries
2. **Cross-Platform Support**: Single executable works across different operating systems
3. **Deployment Simplicity**: No need to include native dependencies in deployment

### For Development

1. **Early Detection**: Catches native dependencies before creating broken executables
2. **Clear Feedback**: Detailed reports about which packages are problematic
3. **Build Safety**: Build process fails fast with helpful error messages
4. **Simplified Build**: Single command builds both macOS and Linux binaries
5. **No Docker Required**: Cross-compilation works directly without container setup

### For Maintenance

1. **Automated Checking**: No manual review needed to catch native dependencies
2. **CI/CD Integration**: Can be used in continuous integration pipelines
3. **Documentation**: Script output serves as documentation of bundle composition
4. **Reduced Complexity**: Fewer build scripts and Docker configurations to maintain
5. **Faster Builds**: Direct cross-compilation is faster than Docker-based builds

## Migration Notes

### Media Collection Changes

**Impact**: Media uploads no longer generate multiple image sizes.

**Before**:
- Uploading an image automatically created thumbnail, card, and tablet sizes
- Admin UI showed thumbnail in media browser

**After**:
- Only original image is stored
- No automatic resizing or format conversion
- Original image displayed in admin UI

**Workarounds**:
- If image resizing is needed, use client-side libraries (e.g., browser-based canvas API)
- Use external image processing services
- Implement server-side resizing with pure JavaScript libraries (if available)

**Future Considerations**:
- Consider pure JavaScript image processing libraries
- Evaluate browser-based image manipulation for client-side resizing
- Assess need for automatic image sizes vs. on-demand resizing

## Testing Checklist

- [x] Native dependency script detects `sharp` correctly
- [x] Script ignores devDependencies
- [x] Script extracts imports correctly from bundled code
- [x] Script handles scoped packages correctly (`@mantine/core`)
- [x] Script handles subpath imports correctly (`react/jsx-runtime`)
- [x] Script skips Node.js built-ins (`node:stream`)
- [x] Build script aborts when native dependencies detected
- [x] Build script preserves build directory on failure
- [x] Build script continues normally when no native dependencies
- [x] Media collection works without imageSizes
- [x] Media uploads work correctly
- [x] No `sharp` import in bundled code

## Usage Examples

### Manual Check

```bash
# Check current build
./scripts/check-native-deps.sh

# Check specific file
./scripts/check-native-deps.sh build/server/index.js node_modules
```

### Build Process

```bash
# Single command builds both macOS and Linux ARM64 binaries
# Will check and abort if native deps found
bun scripts/build.ts

# Or use npm script
bun run build
```

**Output**: Creates both `dist/paideia` (macOS ARM64) and `dist/paideia-linux-arm64` (Linux ARM64) binaries in a single run.

### Expected Output on Failure

```
🔍 Checking for native dependencies in build/server/index.js...
📦 Checking: sharp
  ✅ NATIVE DEPENDENCIES FOUND:
     - Has native build tools in dependencies
     - Has optionalDependencies with native binaries

❌ Build aborted: Native dependencies detected in bundled code!
   The build directory has been preserved for inspection.
   Please review the native dependencies and update your code to avoid bundling them.
```

## Known Limitations

1. **Static Analysis**: The script checks imports in bundled code, but dynamic imports or runtime-loaded modules are not detected
2. **Transitive Dependencies**: If a pure JavaScript package depends on a native package, it won't be caught until runtime
3. **False Positives**: Some packages may be flagged incorrectly if they mention native tools in documentation or comments
4. **Package.json Only**: Analysis based on package.json may miss edge cases

## Related Features

This changelog builds on:
- **Changelog 0026**: Paideia CLI Mode (build script structure)
- **Changelog 0030**: CLI Database Dump Command (CLI command patterns)

## Future Improvements

1. **Runtime Detection**: Add runtime checks to catch dynamically loaded native modules
2. **Dependency Tree Analysis**: Check transitive dependencies recursively
3. **Whitelist Management**: Make known native packages list configurable
4. **Alternative Suggestions**: Suggest pure JavaScript alternatives when native packages detected

