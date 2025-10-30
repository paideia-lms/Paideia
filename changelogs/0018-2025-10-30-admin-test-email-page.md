# Admin Test Email Page

**Date:** October 30, 2025

## Overview

Implemented a comprehensive test email page for administrators to verify SMTP configuration by sending test emails. The page supports both predefined test messages with system information and custom messages, with automatic detection of email configuration status and user-friendly warnings when email is not properly configured.

## Changes

### Internal Email Functions

#### `server/internal/email.ts`
Created a reusable email sending function following the typescript-result pattern:

```typescript
import type { BasePayload } from "payload";
import { Result } from "typescript-result";
import { EmailSendError } from "~/utils/error";
import type { User } from "../payload-types";

export type TrySendEmailArgs = {
  payload: BasePayload;
  to: string;
  subject: string;
  html: string;
  user: Omit<User, "avatar"> & { avatar?: string | null };
  overrideAccess: boolean;
};

export const trySendEmail = Result.wrap(
  async ({
    payload,
    to,
    subject,
    html,
    user,
    overrideAccess,
  }: TrySendEmailArgs): Promise<void> => {
    if (!to || to.trim() === "") {
      throw new Error("Recipient email is required");
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      throw new Error("Invalid email format");
    }

    if (!payload.email) {
      throw new Error("Email adapter is not configured");
    }

    // Send the email using Payload's email adapter
    await payload.sendEmail({
      to,
      subject,
      html,
      overrideAccess,
      user,
    });
  },
  (error) => {
    const message =
      error instanceof Error ? error.message : "Failed to send email";
    return new EmailSendError(message, { cause: error });
  },
);
```

**Key Features:**
- **Email validation**: Validates recipient format and required fields
- **Error handling**: Returns `Result<void, EmailSendError>` for safe error handling
- **Payload integration**: Uses Payload's built-in email adapter
- **Type safety**: Fully typed with TypeScript
- **Reusable**: Can be used across the application for any email sending needs

#### `server/internal/email.test.ts`
Comprehensive test suite for email functionality:

```typescript
test("should fail when recipient email is missing", async () => {
  const result = await trySendEmail({
    payload,
    to: "",
    subject: "Test Subject",
    html: "<p>Test Body</p>",
    user: { id: 1, email: "test@example.com", role: "admin", collection: "users", avatar: null },
    overrideAccess: true,
  });

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error.message).toContain("Recipient email is required");
  }
});

test("should fail when recipient email format is invalid", async () => {
  const result = await trySendEmail({
    payload,
    to: "invalid-email",
    subject: "Test Subject",
    html: "<p>Test Body</p>",
    user: { id: 1, email: "test@example.com", role: "admin", collection: "users", avatar: null },
    overrideAccess: true,
  });

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error.message).toContain("Invalid email format");
  }
});
```

**Test Coverage:**
- Missing recipient validation
- Invalid email format validation
- Email adapter configuration check
- Error message verification

### Error Handling

#### `app/utils/error.ts`
Added new error class for email sending failures:

```typescript
export class EmailSendError extends Error {
  static readonly type = "EmailSendError";
  get type() {
    return EmailSendError.type;
  }
}

export function transformError(error: unknown) {
  // ... existing error checks
  else if (error instanceof EmailSendError) return error;
  else return undefined;
}
```

**Benefits:**
- **Type identification**: Static type property for error discrimination
- **Consistent pattern**: Follows existing error handling conventions
- **Transformation support**: Integrated with error transformation pipeline

### Test Email Route

#### `app/routes/admin/test-email.tsx`
Comprehensive test email page with loader, actions, and UI:

**Loader:**
```typescript
export const loader = async ({ context }: Route.LoaderArgs) => {
  const { envVars } = context.get(globalContextKey);
  const userSession = context.get(userContextKey);

  if (!userSession?.isAuthenticated) {
    throw new ForbiddenResponse("You must be logged in");
  }

  const currentUser = userSession.effectiveUser || userSession.authenticatedUser;

  if (currentUser.role !== "admin") {
    throw new ForbiddenResponse("Only admins can access this page");
  }

  // Check if email is configured
  const emailConfigured =
    !!envVars.SMTP_HOST.value &&
    !!envVars.SMTP_USER.value &&
    !!envVars.SMTP_PASS.value;

  return {
    smtpHost: envVars.SMTP_HOST.value || "",
    smtpUser: envVars.SMTP_USER.value || "",
    fromAddress: "info@paideialms.com",
    emailConfigured,
  };
};
```

**Action Schema:**
```typescript
const predefinedSchema = z.object({
  messageType: z.literal("predefined"),
  recipient: z.email("Invalid email address"),
});

const customSchema = z.object({
  messageType: z.literal("custom"),
  recipient: z.email("Invalid email address"),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Body is required"),
});

const actionSchema = z.discriminatedUnion("messageType", [
  predefinedSchema,
  customSchema,
]);
```

**Predefined Message Generation:**
```typescript
if (parsed.data.messageType === "predefined") {
  const now = new Date().toISOString();
  subject = "Test email from Paideia LMS";
  body = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #2c5282;">Test Email from Paideia LMS</h2>
        <p>This is a test email to verify your email configuration.</p>
        <hr style="border: 1px solid #e2e8f0; margin: 20px 0;">
        <h3 style="color: #4a5568;">System Information</h3>
        <ul style="list-style: none; padding: 0;">
          <li><strong>Server Time:</strong> ${now}</li>
          <li><strong>Platform:</strong> ${platformInfo.platform}</li>
          <li><strong>Environment:</strong> ${process.env.NODE_ENV || "unknown"}</li>
          <li><strong>Sent By:</strong> ${currentUser.email}</li>
        </ul>
        <hr style="border: 1px solid #e2e8f0; margin: 20px 0;">
        <p style="color: #718096; font-size: 14px;">
          If you received this email, your SMTP configuration is working correctly.
        </p>
      </body>
    </html>
  `;
}
```

**Custom Hook:**
```typescript
export function useSendTestEmail() {
  const fetcher = useFetcher<typeof clientAction>();

  const sendTestEmail = (data: {
    messageType: "predefined" | "custom";
    recipient: string;
    subject?: string;
    body?: string;
  }) => {
    fetcher.submit(data, {
      method: "POST",
      encType: ContentType.JSON,
    });
  };

  return {
    sendTestEmail,
    isLoading: fetcher.state !== "idle",
    data: fetcher.data,
  };
}
```

**Email Configuration Warning:**
```typescript
const handleSubmit = (values: typeof form.values) => {
  // If email is not configured, show confirmation modal
  if (!emailConfigured) {
    modals.openConfirmModal({
      title: "Email Not Configured",
      children: (
        <Stack gap="sm">
          <Text size="sm">
            Email is not currently configured on this system. The test email will fail to send.
          </Text>
          <Text size="sm" fw={500}>
            Do you want to proceed anyway?
          </Text>
          <Alert color="orange" icon={<IconAlertTriangle size={16} />}>
            <Text size="xs">
              To configure email, set the following environment variables: SMTP_HOST, SMTP_USER, and SMTP_PASS
            </Text>
          </Alert>
        </Stack>
      ),
      labels: { confirm: "Proceed Anyway", cancel: "Cancel" },
      confirmProps: { color: "orange" },
      onConfirm: () => {
        sendTestEmail({...values});
      },
    });
    return;
  }

  // Email is configured, send directly
  sendTestEmail({...values});
};
```

**UI Components:**
```typescript
{/* Warning when email is not configured */}
{!emailConfigured && (
  <Alert
    icon={<IconAlertTriangle size={20} />}
    title="Email Not Configured"
    color="orange"
  >
    <Text size="sm">
      Email is not currently configured on this system. Any test emails will fail to send.
      To configure email, set the following environment variables: <strong>SMTP_HOST</strong>, <strong>SMTP_USER</strong>, and <strong>SMTP_PASS</strong>.
    </Text>
  </Alert>
)}

{/* SMTP Configuration Info */}
<Alert
  icon={<IconInfoCircle size={20} />}
  title="Current Email Configuration"
  color={emailConfigured ? "blue" : "gray"}
>
  <Stack gap="xs">
    <Text size="sm">
      <strong>SMTP Host:</strong> {smtpHost || "(not set)"}
    </Text>
    <Text size="sm">
      <strong>SMTP User:</strong> {smtpUser || "(not set)"}
    </Text>
    <Text size="sm">
      <strong>From Address:</strong> {fromAddress}
    </Text>
  </Stack>
</Alert>
```

**Key Features:**
- **Admin-only access**: Role-based authorization check
- **Configuration detection**: Automatically detects SMTP configuration status
- **Warning system**: Visual alerts when email is not configured
- **Confirmation modal**: Requires user confirmation before sending when not configured
- **Dual message modes**: Predefined with system info or custom content
- **Form validation**: Email format validation using Mantine's `isEmail`
- **Loading states**: Visual feedback during email sending
- **Notifications**: Success/error feedback after sending
- **Uncontrolled mode**: Uses Mantine form uncontrolled mode as per project standards

### Route Configuration

#### `app/routes.ts`
Added test email route to admin layout:

```typescript
layout("layouts/server-admin-layout.tsx", [
  route("admin/*", "routes/admin/index.tsx"),
  route("admin/users", "routes/admin/users.tsx"),
  route("admin/user/new", "routes/admin/new.tsx"),
  route("admin/courses", "routes/admin/courses.tsx"),
  route("admin/system", "routes/admin/system.tsx"),
  route("admin/test-email", "routes/admin/test-email.tsx"),
]),
```

### Page Information Tracking

#### `server/contexts/global-context.ts`
Added page tracking flag to `PageInfo` type:

```typescript
export type PageInfo = {
  // ... existing flags
  isAdminTestEmail: boolean;
  params: Record<string, string>;
};
```

#### `server/index.ts`
Initialized page flag in global context:

```typescript
pageInfo: {
  // ... existing flags
  isAdminTestEmail: false,
  params: {},
}
```

#### `app/root.tsx`
Added middleware detection for test email page:

```typescript
let isAdminTestEmail = false;

for (const route of routeHierarchy) {
  // ... existing checks
  else if (route.id === "routes/admin/test-email") isAdminTestEmail = true;
}

// Set in context
pageInfo: {
  // ... existing flags
  isAdminTestEmail,
  params: params as Record<string, string>,
}
```

### Navigation Integration

#### `app/routes/admin/index.tsx`
Added navigation link in Server section:

```typescript
server: {
  title: "Server",
  items: [
    { title: "System information", href: href("/admin/system") },
    { title: "System paths" },
    { title: "Support contact" },
    { title: "Session handling" },
    { title: "Statistics" },
    { title: "HTTP" },
    { title: "Maintenance mode" },
    { title: "Cleanup" },
    { title: "Environment" },
    { title: "Performance" },
    { title: "Update notifications" },
    { title: "Test email", href: href("/admin/test-email") },
  ],
},
```

## Features Summary

### Email Sending
- **Predefined messages**: Test emails with system information (time, platform, environment, sender)
- **Custom messages**: User-defined subject and body content
- **HTML formatting**: Properly formatted HTML emails with inline styles
- **Error handling**: Comprehensive error handling with Result types

### Configuration Management
- **Automatic detection**: Detects SMTP configuration at page load
- **Visual indicators**: Color-coded alerts based on configuration status
- **Configuration display**: Shows current SMTP host, user, and from address
- **Missing values**: Clearly indicates "(not set)" for unconfigured values

### User Experience
- **Warning system**: Prominent orange alerts when email is not configured
- **Confirmation dialog**: Modal confirmation required when attempting to send without configuration
- **Clear instructions**: Step-by-step guidance for configuring email
- **Real-time validation**: Client-side email format validation
- **Loading states**: Visual feedback during email sending
- **Success/error notifications**: Toast notifications for action results

### Security
- **Admin-only access**: Restricted to users with admin role
- **Authentication check**: Requires active authenticated session
- **Access control**: Leverages overrideAccess flag for internal functions

### Developer Experience
- **Reusable function**: `trySendEmail` can be used throughout the application
- **Type safety**: Full TypeScript support with proper types
- **Result pattern**: Follows project conventions for error handling
- **Comprehensive tests**: Test suite for email functionality
- **Clear documentation**: Inline comments and type definitions

## Testing

The implementation includes comprehensive test coverage in `server/internal/email.test.ts`:

- Missing recipient validation
- Invalid email format validation
- Email adapter configuration check
- Error message verification
- Database refresh before tests
- Proper cleanup after tests

## User Interface

The test email page includes:

1. **Header Section**
   - Page title and description
   - Breadcrumb navigation via admin layout

2. **Configuration Warning** (when email not configured)
   - Orange alert box
   - Clear explanation of the issue
   - Configuration instructions

3. **Configuration Display**
   - SMTP host, user, and from address
   - Color-coded based on configuration status
   - Shows "(not set)" for missing values

4. **Test Email Form**
   - Radio buttons for message type selection
   - Email recipient input with validation
   - Conditional subject/body fields for custom messages
   - Submit button with loading state

5. **Help Information**
   - Gray alert with guidance on interpreting results
   - Instructions for troubleshooting

## Migration Path

No database migrations required. The feature uses existing Payload email configuration and does not introduce new database tables or fields.

## Environment Variables

Required environment variables for email functionality:
- `SMTP_HOST`: SMTP server hostname
- `SMTP_USER`: SMTP authentication username
- `SMTP_PASS`: SMTP authentication password

These are already defined in the Payload configuration (`server/payload.config.ts`) and accessed via `envVars` in the global context.

## Benefits

1. **Email Verification**: Administrators can easily verify SMTP configuration
2. **Debugging Tool**: Helps troubleshoot email issues with detailed system info
3. **Configuration Visibility**: Clear display of current email settings
4. **Safe Testing**: Confirmation dialogs prevent accidental sends when not configured
5. **Reusable Infrastructure**: `trySendEmail` function can be used for other email needs
6. **User-Friendly**: Clear warnings and instructions for configuration
7. **Professional**: Well-formatted HTML emails with system information
8. **Flexible**: Supports both predefined and custom test messages

## Future Enhancements

Potential improvements for future iterations:

1. **Email history**: Log of sent test emails with timestamps and recipients
2. **Multiple recipients**: Support for sending to multiple email addresses
3. **Attachments**: Ability to test email attachments
4. **Templates**: Pre-defined email templates for different scenarios
5. **SMTP test**: Separate SMTP connection test without sending email
6. **Configuration wizard**: Step-by-step guide for setting up email
7. **Email preview**: Visual preview of email before sending
8. **Batch testing**: Send test emails to multiple addresses at once

