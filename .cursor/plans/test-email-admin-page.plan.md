<!-- 7ec1ea94-53e2-4888-89ce-cbe34739301a 958bba5a-cd82-4be1-b3f2-14dbab59eb0f -->
# Test Email Admin Page Implementation

## 1. Create Internal Email Functions

**File: `server/internal/email.ts`**

- Create `trySendEmail` function that:
- Takes payload, recipient email, subject, body (HTML), and user as parameters
- Uses `payload.sendEmail()` to send email
- Returns `Result<void, Error>` using `Result.wrap`
- Includes proper error handling for email failures

**File: `server/internal/email.test.ts`**

- Test successful email sending (if SMTP is configured)
- Test with missing recipient
- Test with invalid email format
- Use `describe` and `beforeAll` for setup

## 2. Create Test Email Route

**File: `app/routes/admin/test-email.tsx`**

Create a new route with the following structure:

**Loader:**

- Check admin authentication (similar to other admin routes)
- Return email configuration info from `envVars` (SMTP host, from addresses)
- Return `NotFoundResponse` if email is not configured

**Action Schema:**

- Use Zod discriminated union with `messageType` field
- Two schemas: `predefinedSchema` (just recipient) and `customSchema` (recipient, subject, body)
- Validate email format

**Action:**

- Parse request data using `getDataAndContentTypeFromRequest`
- Validate with Zod schema
- Call `trySendEmail` with appropriate content:
- Predefined: Use default subject "Test email from Paideia LMS" and body with system info
- Custom: Use user-provided subject and body
- Return `ok()` or `badRequest()` response

**Client Action:**

- Show notifications based on response status
- Similar pattern to `edit-access.tsx` lines 169-186

**useSendTestEmail Hook:**

- Use `useFetcher` typed with `clientAction`
- Provide `sendTestEmail` function that submits form data
- Return loading state and data

**Component:**

- Use Mantine `useForm` in uncontrolled mode
- Form fields:
- Radio group for message type (predefined/custom)
- Text input for recipient email (required, email validation)
- Text input for subject (shown only when custom selected)
- Textarea for body (shown only when custom selected)
- Display current SMTP configuration (host, from address) from loader data
- Submit button with loading state
- Add meta tags for SEO

## 3. Update Route Configuration

**File: `app/routes.ts`**

- Add route inside `server-admin-layout`: `route("admin/test-email", "routes/admin/test-email.tsx")`
- Place it after the existing admin routes (around line 86)

## 4. Update Global Context Type

**File: `server/contexts/global-context.ts`**

- Add `isAdminTestEmail: boolean` to `PageInfo` type (around line 59)

**File: `server/index.ts`**

- Initialize `isAdminTestEmail: false` in pageInfo object (around line 126)

## 5. Update Root Middleware

**File: `app/root.tsx`**

- Add variable declaration: `let isAdminTestEmail = false;` (around line 116)
- Add condition in loop: `else if (route.id === "routes/admin/test-email") isAdminTestEmail = true;` (around line 175)
- Add to pageInfo object: `isAdminTestEmail` (around line 227)

## 6. Update Admin Index Page (Optional)

**File: `app/routes/admin/index.tsx`**

- Consider adding a link/card to the test email page in the Development tab
- Can be done by adding a navigation item similar to existing admin sections

## Key Implementation Details

- Email content for predefined message should include: server time, SMTP host, from address
- Use `ContentType.JSON` for form submission
- Follow the pattern from `edit-access.tsx` for action/clientAction structure
- Ensure proper error messages for email configuration issues
- Show SMTP configuration status prominently in the UI

### To-dos

- [x] Create server/internal/email.ts with trySendEmail function and email.test.ts with comprehensive tests
- [ ] Create app/routes/admin/test-email.tsx with loader, action, clientAction, hook, and form component
- [ ] Add test-email route to app/routes.ts in admin section
- [ ] Add isAdminTestEmail to PageInfo in global-context.ts and initialize in server/index.ts
- [ ] Update root.tsx middleware to detect and set isAdminTestEmail page flag
- [ ] Add navigation link/card to test email page in admin/index.tsx Development tab