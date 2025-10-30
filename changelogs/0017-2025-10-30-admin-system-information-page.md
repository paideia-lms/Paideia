# Admin System Information Page

**Date:** October 30, 2025

## Overview

Implemented a comprehensive system information page for administrators that displays real-time platform detection and system resource monitoring. The page provides detailed insights into deployment platform, memory usage, CPU information, disk space, operating system details, and system uptime with automatic refresh capabilities.

## Changes

### Platform Detection Integration

#### `server/contexts/global-context.ts`
Added platform detection to global context for application-wide access:

```typescript
import type { PlatformDetectionResult } from "../utils/hosting-platform-detection";

export const globalContext = createContext<{
  // ... existing fields
  platformInfo: PlatformDetectionResult;
}>();
```

**Key Benefits:**
- **Single detection**: Platform info detected once at server startup
- **Performance optimization**: Avoids redundant platform detection calls
- **Global availability**: Accessible throughout the application
- **Type safety**: Full TypeScript support for platform metadata

#### `server/index.ts`
Integrated platform detection at application startup:

```typescript
import { detectPlatform } from "./utils/hosting-platform-detection";

// Detect platform info once at startup
const platformInfo = detectPlatform();
```

**Features:**
- Detects hosting platform (Coolify, Fly.io, Railway, Render, etc.)
- Provides confidence level (high, medium, low)
- Extracts platform-specific metadata (region, instance ID, app name)
- Makes info available to all routes via global context

### Page Information Tracking

#### `server/contexts/global-context.ts`
Added admin page tracking flags to `PageInfo` type:

```typescript
export type PageInfo = {
  // ... existing flags
  isAdminIndex: boolean;
  isAdminUsers: boolean;
  isAdminUserNew: boolean;
  isAdminCourses: boolean;
  isAdminSystem: boolean;
}
```

#### `app/root.tsx`
Updated middleware to track individual admin pages:

```typescript
let isAdminIndex = false;
let isAdminUsers = false;
let isAdminUserNew = false;
let isAdminCourses = false;
let isAdminSystem = false;

for (const route of routeHierarchy) {
  // ... existing checks
  else if (route.id === "routes/admin/index") isAdminIndex = true;
  else if (route.id === "routes/admin/users") isAdminUsers = true;
  else if (route.id === "routes/admin/new") isAdminUserNew = true;
  else if (route.id === "routes/admin/courses") isAdminCourses = true;
  else if (route.id === "routes/admin/system") isAdminSystem = true;
}
```

**Benefits:**
- Enables page-specific logic and UI states
- Supports conditional rendering based on current admin page
- Maintains consistency with existing page tracking pattern

### System Information Page

#### `app/routes/admin/system.tsx`
Created comprehensive system information page with real-time monitoring:

**Loader Implementation:**
```typescript
export const loader = async ({ context }: Route.LoaderArgs) => {
  // Get platform info from global context (static)
  const { platformInfo } = context.get(globalContextKey);
  
  // Detect system resources (dynamic, needs refresh)
  const systemResources = await detectSystemResources();
  
  return { platformInfo, systemResources };
};
```

**Auto-Refresh Feature:**
```typescript
const revalidator = useRevalidator();

// Auto-refresh data every 1 second
useInterval(
  () => {
    revalidator.revalidate();
  },
  1000,
  { autoInvoke: true }
);
```

**Platform Information Section:**
- Platform name and detection status
- Confidence level badge (high/medium/low)
- Region and instance ID
- Application name and version
- Platform-specific metadata (deployment info, git commit, etc.)

**System Resources Section:**
- **Memory**: Total, used, available with percentage and color-coded progress bar
- **CPU**: Core count, architecture, model name
- **Disk**: Total, used, available with percentage and progress bar (if available)
- **Operating System**: Platform, distribution, version, codename
- **Uptime**: Formatted display (days, hours, minutes, seconds)
- **Load Average**: 1-minute, 5-minute, and 15-minute averages (Unix systems only)

**UI Components:**
```typescript
<PlatformInfoSection platformInfo={platformInfo} />
<SystemResourcesSection systemResources={systemResources} />
```

**Resource Status Indicators:**
- 🟢 Green: < 70% usage (good)
- 🟡 Yellow: 70-85% usage (warning)
- 🔴 Red: > 85% usage (critical)

### Utility Functions

#### Client-Safe Utilities
Implemented browser-compatible utility functions:

```typescript
function formatBytes(bytes: number): string {
  // Formats bytes into human-readable format (B, KB, MB, GB, TB)
}

function getResourceStatus(percentage: number): "good" | "warning" | "error" {
  // Returns status based on resource usage percentage
}

function formatUptime(seconds: number): string {
  // Formats uptime into days, hours, minutes, seconds
}
```

### Navigation Integration

#### `app/routes/admin/index.tsx`
Added system information link to admin navigation:

```typescript
server: {
  title: "Server",
  items: [
    { title: "System information", href: href("/admin/system") },
    // ... other items
  ],
}
```

### Route Configuration

#### `app/routes.ts`
Registered new admin system route:

```typescript
layout("layouts/server-admin-layout.tsx", [
  route("admin/*", "routes/admin/index.tsx"),
  route("admin/users", "routes/admin/users.tsx"),
  route("admin/user/new", "routes/admin/new.tsx"),
  route("admin/courses", "routes/admin/courses.tsx"),
  route("admin/system", "routes/admin/system.tsx"),
]),
```

## Platform Detection Capabilities

### Supported Platforms

| Platform | Confidence | Detection Method |
|----------|-----------|------------------|
| Coolify | Medium | `COOLIFY_FQDN`, `COOLIFY_URL`, `COOLIFY_BRANCH` |
| Fly.io | High | `FLY_APP_NAME`, `FLY_MACHINE_ID`, `FLY_REGION` |
| Cloudflare | High | `CF_INSTANCE_ID`, `CF_RAY` |
| Google Cloud Run | High | `K_SERVICE`, `K_REVISION`, `K_CONFIGURATION` |
| Railway | High | `RAILWAY_ENVIRONMENT`, `RAILWAY_PROJECT_ID` |
| Render | High | `RENDER_SERVICE_ID`, `RENDER_SERVICE_NAME` |
| Vercel | High | `VERCEL_ENV`, `VERCEL_URL` |
| Netlify | High | `NETLIFY`, `DEPLOY_ID` |
| Kubernetes | Medium | `KUBERNETES_SERVICE_HOST`, `KUBERNETES_PORT` |
| Docker | Low | `DOCKER_CONTAINER`, `container` env var |

### Platform Metadata

Each platform provides specific metadata:
- **Region/Location**: Where the instance is deployed
- **Instance ID**: Unique identifier for the container/machine
- **App Name**: Application or service name
- **Version**: Deployment version or git commit
- **Environment**: Production, staging, or development
- **Git Information**: Branch, commit SHA, commit message

## System Resources Monitoring

### Memory Monitoring

**Detection Methods:**
1. **Linux**: `/proc/meminfo` parsing (most accurate)
2. **macOS**: `vm_stat` and `sysctl` commands
3. **Fallback**: Node.js `os.totalmem()` and `os.freemem()`

**Metrics:**
- Total RAM
- Used memory
- Available memory
- Usage percentage

### CPU Information

**Detected Information:**
- Core count (logical processors)
- CPU architecture (x64, arm64, etc.)
- CPU model name (when available)

**Detection Methods:**
- **Linux**: `/proc/cpuinfo` parsing
- **macOS**: `sysctl -n machdep.cpu.brand_string`
- **Fallback**: `navigator.hardwareConcurrency` or `os.cpus()`

### Disk Space Monitoring

**Detection Methods:**
- **Linux**: `df -B1` for byte-level precision
- **macOS**: `df -b` with 512-byte block conversion

**Metrics:**
- Total disk space
- Used space
- Available space
- Usage percentage

**Note:** Disk monitoring may not be available on all platforms

### Operating System Details

**Detected Information:**
- Platform (linux, darwin, win32)
- Distribution (ubuntu, debian, centos, macos)
- Version number
- Codename (focal, bullseye, monterey, etc.)

**Detection Methods:**
- **Linux**: `/etc/os-release` file parsing
- **macOS**: `sw_vers` command with version mapping

### Load Average

**Unix Systems Only:**
- 1-minute load average
- 5-minute load average
- 15-minute load average

**Note:** Not available on Windows systems

## Security Features

### Access Control

- **Admin-only access**: Requires `role === "admin"`
- **Authentication required**: Must be logged in
- **Forbidden response**: Non-admins receive 403 error

### Data Privacy

- **Server-side detection**: All system information gathered on server
- **No client exposure**: Node.js modules not bundled to browser
- **Secure transmission**: Data sent via HTTPS in production

## Performance Optimizations

### Platform Detection

- **Single detection**: Runs once at server startup
- **Cached result**: Stored in global context
- **Zero overhead**: No per-request detection cost

### System Resources

- **On-demand fetching**: Only when page is loaded
- **Auto-refresh**: Updates every 1 second for real-time monitoring
- **Efficient commands**: Uses native system calls

### Resource Usage

- **Minimal impact**: Lightweight system commands
- **No continuous polling**: Only refreshes when page is active
- **Efficient parsing**: Direct file reads and command execution

## Technical Implementation Details

### Type Safety

**Platform Types:**
```typescript
interface PlatformDetectionResult {
  detected: boolean;
  platform: DeploymentPlatform;
  confidence: "high" | "medium" | "low";
  info: PlatformInfo;
  environmentVariables: Record<string, string>;
}
```

**System Resource Types:**
```typescript
interface SystemResources {
  memory: { total, available, used, percentage };
  cpu: { cores, model?, architecture, usage? };
  disk?: { total, available, used, percentage } | null;
  os: { platform, distribution?, version?, codename? };
  uptime: number;
  loadAverage?: number[];
}
```

### Error Handling

- **Graceful degradation**: Missing data fields don't break UI
- **Fallback methods**: Multiple detection strategies for cross-platform support
- **Safe parsing**: Try-catch blocks prevent crashes
- **Null safety**: Optional fields properly typed

### UI/UX Features

- **Color-coded status**: Visual indication of resource health
- **Progress bars**: Intuitive visualization of usage
- **Auto-refresh**: Live updates without manual refresh
- **Responsive layout**: Works on all screen sizes
- **Mantine components**: Consistent design system

## Browser Compatibility

### Client-Side Safety

- **No Node.js modules**: Server-only imports kept separate
- **Type definitions**: Client-safe type definitions for UI
- **Utility functions**: Browser-compatible implementations
- **React Router**: Standard hooks and components

### Auto-Refresh Implementation

Uses browser-compatible APIs:
- `useRevalidator` from React Router
- `useInterval` from Mantine hooks
- Standard React hooks (`useEffect`, `useState`)

## Testing Recommendations

### Manual Testing Checklist

- ✅ Admin can access `/admin/system` page
- ✅ Non-admin users receive 403 error
- ✅ Platform information displays correctly
- ✅ System resources update automatically
- ✅ Progress bars show accurate percentages
- ✅ Color coding matches resource status
- ✅ All metrics are properly formatted
- ✅ Page performs well with auto-refresh

### Platform-Specific Testing

- Test on different hosting platforms
- Verify environment variable detection
- Confirm metadata extraction
- Check confidence levels

## Migration Notes

- **No database changes**: Uses existing authentication
- **Backward compatible**: Doesn't affect existing functionality
- **Auto-detection**: No configuration required
- **Global context expansion**: Non-breaking addition

## Breaking Changes

None. This is a purely additive feature that enhances admin capabilities.

## Future Enhancements

Potential improvements for future iterations:

### Monitoring Features
- **Historical data**: Track resource usage over time
- **Alerts**: Notifications for high resource usage
- **Graphs**: Visual charts for trends
- **Export**: Download system info as JSON/CSV

### Platform Features
- **Health checks**: Monitor service status
- **Deployment info**: Recent deployments and rollbacks
- **Environment variables**: View (safe) configuration
- **Container logs**: Access to recent logs

### System Features
- **Process monitoring**: Running processes and their resources
- **Network stats**: Bandwidth usage and connections
- **Database metrics**: Connection pool and query stats
- **Cache status**: Redis/memory cache statistics

### User Experience
- **Customizable refresh**: User-configurable interval
- **Pause/Resume**: Control auto-refresh
- **Dashboard widgets**: Mini system cards for dashboard
- **Mobile optimization**: Better mobile experience

## Dependencies

- **Payload CMS**: Authentication and context management
- **React Router**: Data loading and revalidation
- **Mantine UI**: UI components and hooks
- **Bun**: System resource detection utilities
- **Node.js**: System information APIs

## References

- Platform detection: `server/utils/hosting-platform-detection.ts`
- System resources: `server/utils/bun-system-resources.ts`
- React Router useRevalidator: https://reactrouter.com/7.9.5/api/hooks/useRevalidator
- Mantine useInterval: https://mantine.dev/hooks/use-interval/

