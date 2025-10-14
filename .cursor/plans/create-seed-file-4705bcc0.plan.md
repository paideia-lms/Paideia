<!-- 4705bcc0-6f8b-4cda-9b20-e3e92f814d27 690e5d4e-d1fc-42f4-94e8-8c7f8e9138f4 -->
# Create Development Seed File

## Overview

Move the first user registration logic from `server/index.ts` into a new `server/seed.ts` file and expand it to seed a complete development environment including users, a course, enrollment, and a page module.

## Implementation Steps

### 1. Create `server/seed.ts`

Create a new seed file with a main `runSeed` function that:

- Checks if the database is fresh (no users exist)
- If fresh, runs all seeding operations in sequence
- Uses `Result.wrap` pattern for error handling
- Logs progress at each step

### 2. Implement Seed Operations

The seed function will execute these steps when `tryCheckFirstUser` returns `true`:

1. **Register first admin user** using `tryRegisterFirstUser`:

   - Email: `devConstants.ADMIN_EMAIL` ("admin@example.com")
   - Password: `devConstants.ADMIN_PASSWORD` ("adminpassword123")
   - Role: "admin" (automatic in first user registration)

2. **Create second user (student)** using `tryCreateUser`:

   - Email: "student@example.com"
   - Password: "studentpassword123"
   - First name: "Student"
   - Last name: "User"
   - Role: "student"

3. **Create a course** using `tryCreateCourse`:

   - Title: "Introduction to Programming"
   - Description: "Learn the basics of programming"
   - Slug: "intro-to-programming"
   - Created by: admin user ID
   - Status: "published"

4. **Enroll student in course** using `tryCreateEnrollment`:

   - User: student user ID
   - Course: course ID
   - Role: "student"
   - Status: "active"

5. **Create page module** using `tryCreateActivityModule`:

   - Title: "Welcome to the Course"
   - Description: "Introduction and course overview"
   - Type: "page"
   - Status: "published"
   - Created by: admin user ID

6. **Link page module to course** using `tryCreateCourseActivityModuleLink`:

   - Course: course ID
   - Activity module: page module ID

### 3. Update `server/index.ts`

Replace the inline seeding logic (lines 43-61) with a call to the new seed function:

```typescript
if (process.env.NODE_ENV === "development") {
  await runSeed({ payload });
}
```

### 4. Add Imports

- Import `runSeed` from "./seed" in `server/index.ts`
- Import all necessary internal functions in `server/seed.ts`:
  - `tryCheckFirstUser` from "./internal/check-first-user"
  - `tryRegisterFirstUser`, `tryCreateUser` from "./internal/user-management"
  - `tryCreateCourse` from "./internal/course-management"
  - `tryCreateEnrollment` from "./internal/enrollment-management"
  - `tryCreateActivityModule` from "./internal/activity-module-management"
  - `tryCreateCourseActivityModuleLink` from "./internal/course-activity-module-link-management"
  - `devConstants` from "./utils/constants"

## Key Implementation Details

- Use `overrideAccess: true` for all seed operations since we're bypassing normal access control
- Create a mock `Request` object for functions that require it
- Handle all results using the `Result` pattern with proper error checking
- Log each step completion for visibility during development
- All operations should complete successfully or fail together (individual transactions per operation are already handled by the internal functions)

### To-dos

- [ ] Create server/seed.ts with runSeed function and all seeding logic
- [ ] Update server/index.ts to call runSeed instead of inline seeding