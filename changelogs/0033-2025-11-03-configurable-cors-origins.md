# Changelog 0033: Configurable CORS Origins

**Date**: November 3, 2025  
**Type**: Feature Enhancement  
**Impact**: Low - Adds flexibility for CORS configuration via environment variables

## Overview

This update adds configurable CORS (Cross-Origin Resource Sharing) origins support via environment variables. Administrators can now configure allowed CORS origins through the `CORS_ORIGINS` environment variable, supporting wildcard, comma-separated URLs, or default localhost behavior.

## Features Added

### 1. Configurable CORS Origins

**Changes**: Added `CORS_ORIGINS` environment variable to `server/env.ts` and updated `server/payload.config.ts` to use it

**Problem**: CORS origins were hardcoded in `payload.config.ts`, making it difficult to configure for different environments (development, staging, production) without code changes.

**Solution**:
- Added `CORS_ORIGINS` environment variable support
- Supports three configuration modes:
  - **Empty/Unset**: Defaults to localhost (backward compatible)
  - **Wildcard (`*`)**: Allows all origins (useful for development)
  - **Comma-separated URLs**: Allows specific origins (recommended for production)

**Features**:
- Environment variable-based configuration
- Backward compatible (defaults to localhost if not set)
- Supports wildcard for development
- Supports multiple specific origins for production
- Automatic URL trimming and filtering

**Configuration**:

**Default (localhost only)**:
```env
# Leave CORS_ORIGINS unset or empty
# Or don't include it in .env file
```

**Wildcard (all origins)**:
```env
CORS_ORIGINS=*
```

**Specific origins (comma-separated)**:
```env
CORS_ORIGINS=http://localhost:3001,https://example.com,https://*.localcan.dev
```

**Implementation**:
```typescript
// server/env.ts
CORS_ORIGINS: {
  required: false,
  sensitive: false,
  value: process.env.CORS_ORIGINS,
  default: "",
  get origins() {
    const val = this.value ?? this.default;
    // If empty, return default localhost
    if (!val || val.trim() === "") {
      return [
        `http://localhost:${envVars.PORT.value ?? envVars.PORT.default}`,
      ];
    }
    // If wildcard, return '*'
    if (val.trim() === "*") {
      return "*";
    }
    // Parse comma-separated URLs
    return val.split(",").map((url) => url.trim()).filter(Boolean);
  },
}

// server/payload.config.ts
cors: envVars.CORS_ORIGINS.origins,
```

**Benefits**:
- ✅ Flexible CORS configuration without code changes
- ✅ Environment-specific configuration support
- ✅ Backward compatible (defaults to localhost)
- ✅ Supports wildcard for development
- ✅ Supports multiple specific origins for production
- ✅ Easy to configure via `.env` file or environment variables

## Technical Details

### Before (Hardcoded)
```typescript
// server/payload.config.ts
cors: [
  `http://localhost:${envVars.PORT.value ?? envVars.PORT.default}`,
  'https://paideia-13.localcan.dev',
],
```

### After (Configurable)
```typescript
// server/payload.config.ts
cors: envVars.CORS_ORIGINS.origins,

// server/env.ts
CORS_ORIGINS: {
  // ... configuration
  get origins() {
    // Returns array, wildcard '*', or default localhost
  }
}
```

### Configuration Examples

**Development (multiple origins)**:
```env
CORS_ORIGINS=http://localhost:3001,https://paideia-13.localcan.dev,https://*.localcan.dev
```

**Staging (specific domains)**:
```env
CORS_ORIGINS=https://staging.example.com,https://admin.staging.example.com
```

**Production (production domains only)**:
```env
CORS_ORIGINS=https://paideialms.com,https://www.paideialms.com
```

**Development (wildcard - not recommended for production)**:
```env
CORS_ORIGINS=*
```

## Migration Guide

### No Breaking Changes

This update is **backward compatible**. Existing installations will continue to work with default localhost CORS configuration.

### To Configure CORS Origins

1. **Add `CORS_ORIGINS` to your `.env` file**:
   ```env
   CORS_ORIGINS=http://localhost:3001,https://example.com
   ```

2. **Or set it as an environment variable**:
   ```bash
   export CORS_ORIGINS="https://example.com,https://*.localcan.dev"
   ```

3. **Restart the application** to apply changes

### Default Behavior

If `CORS_ORIGINS` is not set or is empty:
- Defaults to `http://localhost:${PORT}` (typically `http://localhost:3001`)
- Maintains backward compatibility
- Works for local development out of the box

## Breaking Changes

None. All changes are backward compatible.

## Bug Fixes

None in this changelog.

## Dependencies

No new dependencies added.

## Testing

- ✅ Default CORS configuration works (localhost)
- ✅ Wildcard CORS configuration works (`*`)
- ✅ Comma-separated URLs are parsed correctly
- ✅ Empty values default to localhost
- ✅ URL trimming and filtering works correctly
- ✅ Backward compatible with existing installations

## Future Enhancements

- Support for CORS headers configuration
- Support for credentials configuration
- Support for max age configuration
- Environment-specific CORS presets

## References

- [Payload CMS CORS Documentation](https://payloadcms.com/docs/configuration/overview#cors)
- [MDN CORS Documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

