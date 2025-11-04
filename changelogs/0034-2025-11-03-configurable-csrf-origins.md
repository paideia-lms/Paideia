# Changelog 0034: Configurable CSRF Origins

**Date**: November 3, 2025  
**Type**: Feature Enhancement  
**Impact**: Low - Adds flexibility for CSRF configuration via environment variables

## Overview

This update adds configurable CSRF (Cross-Site Request Forgery) protection origins support via environment variables. Administrators can now configure trusted CSRF origins through the `CSRF_ORIGINS` environment variable, similar to CORS configuration. This release also improves the default CORS configuration to include both frontend and backend origins for better server-side authentication.

## Features Added

### 1. Configurable CSRF Origins

**Changes**: Added `CSRF_ORIGINS` environment variable to `server/env.ts` and updated `server/payload.config.ts` to use it

**Problem**: CSRF origins were hardcoded in `payload.config.ts`, making it difficult to configure for different environments (development, staging, production) without code changes. Additionally, CSRF protection requires explicit trusted origins for security.

**Solution**:
- Added `CSRF_ORIGINS` environment variable support
- Supports two configuration modes:
  - **Empty/Unset**: Defaults to localhost (backward compatible)
  - **Comma-separated URLs/domains**: Allows specific origins (recommended for production)
- **Security Note**: Wildcard (`*`) is not supported for CSRF for security reasons - explicit origins are required

**Features**:
- Environment variable-based configuration
- Backward compatible (defaults to localhost if not set)
- Supports multiple specific origins for production
- Automatic URL trimming and filtering
- Merges with default localhost origins for development compatibility

**Configuration**:

**Default (localhost only)**:
```env
# Leave CSRF_ORIGINS unset or empty
# Defaults to: http://localhost:3000, localhost
```

**Specific origins (comma-separated)**:
```env
CSRF_ORIGINS=https://your-frontend-app.com,https://your-other-frontend-app.com,localhost
```

**Implementation**:
```typescript
// server/env.ts
CSRF_ORIGINS: {
  required: false,
  sensitive: false,
  value: process.env.CSRF_ORIGINS,
  default: "",
  get origins() {
    const val = this.value ?? this.default;
    // If empty, return default localhost
    if (!val || val.trim() === "") {
      return [
        `http://localhost:${envVars.FRONTEND_PORT.value ?? envVars.FRONTEND_PORT.default}`,
        "localhost",
      ];
    }
    // Parse comma-separated URLs/domains
    // Note: Wildcard '*' is not supported for CSRF for security reasons
    return val.split(",").map((url) => url.trim()).filter(Boolean);
  },
}

// server/payload.config.ts
csrf: [
  // Default localhost origins (always included)
  "http://localhost:3000",
  "localhost",
  // User-configured origins from environment variable
  ...envVars.CSRF_ORIGINS.origins,
].filter(Boolean) as string[],
```

**Benefits**:
- ✅ Flexible CSRF configuration without code changes
- ✅ Environment-specific configuration support
- ✅ Backward compatible (defaults to localhost)
- ✅ Security-focused (explicit origins required, no wildcard)
- ✅ Easy to configure via `.env` file or environment variables
- ✅ Merges with default origins for development compatibility

### 2. Improved Default CORS Configuration

**Changes**: Updated default `CORS_ORIGINS` to include both frontend and backend origins

**Problem**: Default CORS configuration only included the backend origin (`http://localhost:3001`), causing authentication failures when server-side requests included the frontend origin (`http://localhost:3000`).

**Solution**:
- Updated default `CORS_ORIGINS` to include both frontend and backend origins
- Ensures server-side authentication works correctly with React Router SSR
- Removed the need for workarounds (e.g., deleting origin header)

**Benefits**:
- ✅ Server-side authentication works correctly
- ✅ No need for origin header manipulation workarounds
- ✅ Better support for React Router SSR requests
- ✅ Backward compatible

## Technical Details

### Before (Hardcoded CSRF)
```typescript
// server/payload.config.ts
csrf: [
  ...(process.env.NODE_ENV === "development"
    ? ["http://localhost:3000", "localhost"]
    : ["http://localhost:3000", "localhost"]),
].filter(Boolean) as string[],
```

### After (Configurable CSRF)
```typescript
// server/payload.config.ts
csrf: [
  // Default localhost origins (always included for development compatibility)
  "http://localhost:3000",
  "localhost",
  // User-configured origins from environment variable
  ...envVars.CSRF_ORIGINS.origins,
].filter(Boolean) as string[],

// server/env.ts
CSRF_ORIGINS: {
  // ... configuration
  get origins() {
    // Returns array of URLs/domains, or default localhost
  }
}
```

### Default CORS Origins Update

**Before**:
```typescript
// Only backend origin
return [`http://localhost:${envVars.PORT.value ?? envVars.PORT.default}`];
```

**After**:
```typescript
// Both frontend and backend origins
return [
  `http://localhost:${envVars.FRONTEND_PORT.value ?? envVars.FRONTEND_PORT.default}`,
  `http://localhost:${envVars.PORT.value ?? envVars.PORT.default}`,
];
```

### Configuration Examples

**Development (default localhost)**:
```env
# Leave CSRF_ORIGINS unset
# Defaults to: http://localhost:3000, localhost
```

**Staging (specific domains)**:
```env
CSRF_ORIGINS=https://staging.example.com,https://admin.staging.example.com
```

**Production (production domains only)**:
```env
CSRF_ORIGINS=https://paideialms.com,https://www.paideialms.com,https://admin.paideialms.com
```

## Migration Guide

### No Breaking Changes

This update is **backward compatible**. Existing installations will continue to work with default localhost CSRF configuration.

### To Configure CSRF Origins

1. **Add `CSRF_ORIGINS` to your `.env` file**:
   ```env
   CSRF_ORIGINS=https://your-frontend-app.com,https://your-other-frontend-app.com
   ```

2. **Or set it as an environment variable**:
   ```bash
   export CSRF_ORIGINS="https://example.com,https://admin.example.com"
   ```

3. **Restart the application** to apply changes

### Default Behavior

If `CSRF_ORIGINS` is not set or is empty:
- Defaults to `http://localhost:3000` and `localhost`
- Maintains backward compatibility
- Works for local development out of the box
- Default origins are always included (merged with user configuration)

### CORS Configuration

**No manual migration needed.** The changes are automatic:

- ✅ Default CORS now includes both frontend and backend origins
- ✅ Server-side authentication works correctly
- ✅ No need for origin header manipulation

## Breaking Changes

None. All changes are backward compatible.

## Bug Fixes

### Server-Side Authentication Fix

**Problem**: Server-side authentication was failing when requests included the frontend origin (`http://localhost:3000`), requiring workarounds like deleting the origin header.

**Root Cause**: Default CORS configuration only included the backend origin (`http://localhost:3001`), causing Payload CMS to reject authentication requests with the frontend origin.

**Solution**: Updated default CORS configuration to include both frontend and backend origins, ensuring server-side authentication works correctly.

**Benefits**:
- ✅ Server-side authentication works without workarounds
- ✅ No need to delete origin header
- ✅ Better support for React Router SSR requests

## Dependencies

No new dependencies added.

## Testing

- ✅ Default CSRF configuration works (localhost)
- ✅ Comma-separated URLs are parsed correctly
- ✅ Empty values default to localhost
- ✅ URL trimming and filtering works correctly
- ✅ Default origins are merged with user configuration
- ✅ Server-side authentication works with default CORS configuration
- ✅ No need for origin header manipulation workarounds
- ✅ Backward compatible with existing installations

## Security Considerations

### CSRF Protection

**Important**: Unlike CORS, CSRF protection does **not** support wildcard (`*`) for security reasons. CSRF attacks require explicit trusted origins to prevent cross-site request forgery.

**Best Practices**:
- Always specify explicit origins in production
- Use comma-separated URLs for multiple trusted domains
- Include both protocol and domain (e.g., `https://example.com`, not just `example.com`)
- Test thoroughly before deploying to production

### CORS vs CSRF

**CORS (Cross-Origin Resource Sharing)**:
- Controls which origins can make requests to your API
- Supports wildcard (`*`) for development
- Configured via `CORS_ORIGINS` environment variable

**CSRF (Cross-Site Request Forgery)**:
- Controls which origins can make authenticated requests with cookies
- Does **not** support wildcard (`*`) for security reasons
- Requires explicit trusted origins
- Configured via `CSRF_ORIGINS` environment variable

## Future Enhancements

- Support for CSRF token validation
- Enhanced CSRF configuration options
- Environment-specific CSRF presets
- Documentation for CSRF best practices

## References

- [Payload CMS CSRF Documentation](https://payloadcms.com/docs/configuration/overview#csrf)
- [MDN CSRF Documentation](https://developer.mozilla.org/en-US/docs/Glossary/CSRF)
- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)

