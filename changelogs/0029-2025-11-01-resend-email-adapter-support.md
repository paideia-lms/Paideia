# Changelog 0029: Resend Email Adapter Support

**Date**: November 1, 2025  
**Type**: Feature Enhancement  
**Impact**: Medium - Adds Resend email adapter as an alternative to SMTP, with shared configuration for both adapters

## Overview

This update adds support for the Resend email adapter in Payload CMS configuration, providing administrators with an alternative to SMTP for sending emails. The system now supports both Resend and SMTP (Nodemailer) email adapters, with Resend taking priority when configured. Additionally, both adapters now share common configuration values (from address and from name) through generic environment variables.

## Features Added

### 1. Resend Email Adapter Support

**Priority System**:
- Resend adapter is used when `RESEND_API_KEY` is set
- SMTP adapter (Nodemailer) is used as fallback when Resend is not configured
- Email adapter is disabled when neither is configured

**Configuration**:
- `RESEND_API_KEY`: Required for Resend adapter (optional, sensitive)
- `EMAIL_FROM_ADDRESS`: Shared between both adapters (optional, default: "info@paideialms.com")
- `EMAIL_FROM_NAME`: Shared between both adapters (optional, default: "Paideia LMS")

### 2. Shared Email Configuration

Both email adapters now use the same environment variables for from address and name:
- Previously: SMTP used hardcoded values ("info@payloadcms.com" and "Payload")
- Now: Both adapters use `EMAIL_FROM_ADDRESS` and `EMAIL_FROM_NAME` environment variables
- Provides consistency across email providers
- Easier configuration management

### 3. Enhanced Test Email Page

**Updated Features**:
- Detects and displays current email provider (Resend or SMTP)
- Shows Resend configuration status (API key set, from address, from name)
- Shows SMTP configuration status (host, user, from address, from name)
- Updated help text to mention both configuration options
- Clear visual indicators for which provider is active

## Technical Implementation

### Environment Variables

#### `server/env.ts`

Added new environment variable definitions:

```typescript
RESEND_API_KEY: {
  required: false,
  sensitive: true,
  value: process.env.RESEND_API_KEY,
},
EMAIL_FROM_ADDRESS: {
  required: false,
  sensitive: false,
  value: process.env.EMAIL_FROM_ADDRESS,
  default: "info@paideialms.com",
},
EMAIL_FROM_NAME: {
  required: false,
  sensitive: false,
  value: process.env.EMAIL_FROM_NAME,
  default: "Paideia LMS",
},
```

**Key Points**:
- `RESEND_API_KEY` is sensitive (not shown in UI)
- `EMAIL_FROM_ADDRESS` and `EMAIL_FROM_NAME` have defaults
- Generic naming reflects shared usage across adapters

### Payload Configuration

#### `server/payload.config.ts`

Updated email configuration with priority-based adapter selection:

```typescript
email: (() => {
  // Shared default values for both email adapters
  const defaultFromAddress =
    envVars.EMAIL_FROM_ADDRESS.value ??
    envVars.EMAIL_FROM_ADDRESS.default ??
    "info@paideialms.com";
  const defaultFromName =
    envVars.EMAIL_FROM_NAME.value ??
    envVars.EMAIL_FROM_NAME.default ??
    "Paideia LMS";

  if (envVars.RESEND_API_KEY.value) {
    return resendAdapter({
      apiKey: envVars.RESEND_API_KEY.value,
      defaultFromAddress,
      defaultFromName,
    });
  }

  if (
    envVars.SMTP_HOST.value &&
    envVars.SMTP_USER.value &&
    envVars.SMTP_PASS.value
  ) {
    return nodemailerAdapter({
      defaultFromAddress,
      defaultFromName,
      transportOptions: {
        host: envVars.SMTP_HOST.value,
        port: 587,
        auth: {
          user: envVars.SMTP_USER.value,
          pass: envVars.SMTP_PASS.value,
        },
      },
    });
  }

  return undefined;
})(),
```

**Implementation Details**:
- Uses IIFE (Immediately Invoked Function Expression) to compute shared values once
- Resend adapter has priority over SMTP
- Both adapters share the same `defaultFromAddress` and `defaultFromName`
- Returns `undefined` when neither adapter is configured

### Test Email Page Updates

#### `app/routes/admin/test-email.tsx`

**Loader Updates**:

```typescript
// Check if email is configured
const resendConfigured = !!envVars.RESEND_API_KEY.value;
const smtpConfigured =
  !!envVars.SMTP_HOST.value &&
  !!envVars.SMTP_USER.value &&
  !!envVars.SMTP_PASS.value;
const emailConfigured = resendConfigured || smtpConfigured;

return {
  emailProvider: resendConfigured ? "resend" : smtpConfigured ? "smtp" : null,
  resendApiKeySet: resendConfigured,
  fromAddress:
    envVars.EMAIL_FROM_ADDRESS.value ??
    envVars.EMAIL_FROM_ADDRESS.default ??
    "",
  fromName:
    envVars.EMAIL_FROM_NAME.value ?? envVars.EMAIL_FROM_NAME.default ?? "",
  smtpHost: envVars.SMTP_HOST.value || "",
  smtpUser: envVars.SMTP_USER.value || "",
  emailConfigured,
};
```

**UI Updates**:

1. **Configuration Display**:
   - Shows current provider (Resend, SMTP, or Not configured)
   - Displays provider-specific configuration details
   - Shows shared from address and name for both providers

2. **Help Text**:
   - Updated to mention both Resend and SMTP options
   - Clarifies that `EMAIL_FROM_ADDRESS` and `EMAIL_FROM_NAME` are optional for both providers

3. **Warning Messages**:
   - Includes instructions for both configuration methods
   - Clear explanation of environment variables needed

## Files Changed

### Modified Files

- `server/env.ts` - Added `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`, and `EMAIL_FROM_NAME` environment variables
- `server/payload.config.ts` - Added Resend adapter support with priority-based selection and shared configuration
- `app/routes/admin/test-email.tsx` - Updated to display Resend configuration status and shared email settings

### Dependencies

- `@payloadcms/email-resend` - Already included in `package.json` (version 3.62.0)

## Environment Variables

### Required for Resend

- `RESEND_API_KEY`: Resend API key (required for Resend adapter, sensitive)

### Optional for Both Adapters

- `EMAIL_FROM_ADDRESS`: Email address used as sender (default: "info@paideialms.com")
- `EMAIL_FROM_NAME`: Display name used as sender (default: "Paideia LMS")

### Required for SMTP (Fallback)

- `SMTP_HOST`: SMTP server hostname
- `SMTP_USER`: SMTP authentication username
- `SMTP_PASS`: SMTP authentication password

### Configuration Priority

1. **Resend**: If `RESEND_API_KEY` is set, Resend adapter is used
2. **SMTP**: If `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS` are all set, SMTP adapter is used
3. **None**: If neither is configured, email functionality is disabled

## Migration Path

### For Users Currently Using SMTP

No changes required. Existing SMTP configuration continues to work. The `EMAIL_FROM_ADDRESS` and `EMAIL_FROM_NAME` environment variables are optional and will use defaults if not set.

### For Users Wanting to Use Resend

1. Sign up for Resend account at https://resend.com
2. Obtain API key from Resend dashboard
3. Set `RESEND_API_KEY` environment variable
4. (Optional) Set `EMAIL_FROM_ADDRESS` if different from default
5. (Optional) Set `EMAIL_FROM_NAME` if different from default

### For Users Wanting to Customize From Address/Name

1. Set `EMAIL_FROM_ADDRESS` environment variable (applies to both adapters)
2. Set `EMAIL_FROM_NAME` environment variable (applies to both adapters)
3. These values will be used regardless of which adapter is active

## Benefits

### 1. Flexible Email Configuration

- **Multiple Providers**: Support for both Resend and SMTP
- **Easy Switching**: Change providers by setting/unsetting environment variables
- **Priority-Based**: Resend takes precedence when both are configured

### 2. Consistent Configuration

- **Shared Settings**: From address and name shared between adapters
- **Unified Interface**: Same configuration approach for both providers
- **Default Values**: Sensible defaults for common settings

### 3. Improved User Experience

- **Clear Status**: Test email page shows which provider is active
- **Better Instructions**: Updated help text for both configuration methods
- **Visual Indicators**: Clear display of configuration status

### 4. Developer Benefits

- **Type Safety**: Full TypeScript support
- **Error Handling**: Existing error handling works with both adapters
- **No Breaking Changes**: Existing SMTP configuration remains functional

## User Interface

### Test Email Page Updates

**Configuration Display Section**:

- **Provider**: Shows "Resend", "SMTP (Nodemailer)", or "Not configured"
- **Resend Configuration** (when using Resend):
  - Resend API Key: "✓ Set (hidden)" or "(not set)"
  - From Address: Configured value or "(default)"
  - From Name: Configured value or "(default)"
- **SMTP Configuration** (when using SMTP):
  - SMTP Host: Configured value or "(not set)"
  - SMTP User: Configured value or "(not set)"
  - From Address: Configured value or "(default)"
  - From Name: Configured value or "(default)"

**Help Text Updates**:

- Option 1 (Resend): Set `RESEND_API_KEY` (optionally `EMAIL_FROM_ADDRESS` and `EMAIL_FROM_NAME`)
- Option 2 (SMTP): Set `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS` (optionally `EMAIL_FROM_ADDRESS` and `EMAIL_FROM_NAME`)

## Testing

The existing test email functionality works with both adapters:

- Predefined test messages include system information
- Custom messages support user-defined content
- Email validation and error handling unchanged
- Test email page shows correct provider status

## Security Considerations

### API Key Management

- `RESEND_API_KEY` is marked as sensitive in environment variables
- API key is not displayed in UI (only shows "✓ Set (hidden)")
- Follows same security patterns as `SMTP_PASS`

### Configuration Access

- Test email page requires admin role (unchanged)
- Configuration details visible only to administrators
- Sensitive values hidden in UI

## Best Practices

### 1. Email Provider Selection

**When to use Resend**:
- Prefer managed email service
- Want simpler configuration (just API key)
- Need reliable delivery infrastructure
- Want detailed analytics and monitoring

**When to use SMTP**:
- Already have SMTP server infrastructure
- Prefer self-hosted email solution
- Need specific SMTP server features
- Want more control over email delivery

### 2. Configuration Management

**Environment Variables**:
- Use `.env` file for local development
- Use environment variables in production
- Never commit sensitive values to version control
- Use secrets management in CI/CD pipelines

**From Address/Name**:
- Set `EMAIL_FROM_ADDRESS` to your verified domain
- Use `EMAIL_FROM_NAME` for brand consistency
- These values apply to both adapters automatically

### 3. Testing

**Before Production**:
- Test email configuration using test email page
- Verify delivery with test email to real address
- Check spam folder to ensure proper delivery
- Verify from address matches expectations

## Future Enhancements

Potential improvements for future iterations:

1. **Additional Providers**: Support for other email services (SendGrid, Mailgun, etc.)
2. **Provider-Specific Settings**: Customizable settings per provider
3. **Email Templates**: Predefined templates for common scenarios
4. **Delivery Tracking**: Track email delivery status
5. **Analytics Integration**: Email open/click tracking
6. **Multi-Provider Failover**: Automatic failover between providers
7. **Configuration Wizard**: Guided setup for email configuration

## Troubleshooting

### Resend Not Working

1. Verify `RESEND_API_KEY` is set correctly
2. Check API key validity in Resend dashboard
3. Ensure from address domain is verified in Resend
4. Check Resend dashboard for error logs

### SMTP Still Used When Resend Configured

- Verify `RESEND_API_KEY` environment variable is actually set
- Check environment variable name (case-sensitive)
- Restart server after setting environment variables
- Verify in test email page which provider is detected

### From Address/Name Not Applied

- Check `EMAIL_FROM_ADDRESS` and `EMAIL_FROM_NAME` are set
- Verify environment variables are loaded correctly
- Default values used if variables not set
- Check test email page to see detected values

