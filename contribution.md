# Contributing to Paideia LMS

Thank you for your interest in contributing to Paideia LMS! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Git Workflow](#git-workflow)
- [Changelog Requirements](#changelog-requirements)
- [Pull Request Process](#pull-request-process)
- [Reporting Issues](#reporting-issues)
- [Proposing Features](#proposing-features)

## Code of Conduct

We are committed to providing a welcoming and inclusive environment for all contributors. Please be respectful, considerate, and constructive in all interactions.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```sh
   git clone https://github.com/YOUR_USERNAME/paideia.git
   cd paideia
   ```
3. **Set up the upstream remote**:
   ```sh
   git remote add upstream https://github.com/paideia-lms/paideia.git
   ```
4. **Install dependencies**:
   ```sh
   bun install
   ```
5. **Set up git hooks**:
   ```sh
   bun run lefthook:install
   ```

## Development Setup

### Prerequisites

- **Bun** (latest version recommended)
- **Docker** and **Docker Compose** (for infrastructure services)
- **PostgreSQL** (via Docker Compose)
- **MinIO** (via Docker Compose)

### Starting Development Environment

1. **Start infrastructure services**:
   ```sh
   docker compose up -d
   ```
   This starts PostgreSQL, MinIO, and Drizzle Gateway.

2. **Run the development server**:
   ```sh
   bun dev
   ```
   This starts both the frontend (port 3000) and backend (port 3001) servers with hot-reloading.

3. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend: http://localhost:3001
   - MinIO Console: http://localhost:9001

### Environment Variables

Create a `.env` file in the project root with the following variables:

```env
DATABASE_URL=postgresql://paideia:paideia_password@localhost:5432/paideia_db
S3_URL=http://localhost:9000/paideia-bucket
S3_ACCESS_KEY=paideia_minio
S3_SECRET_KEY=paideia_minio_secret
S3_ENDPOINT_URL=http://localhost:9000
S3_BUCKET=paideia-bucket
PAYLOAD_SECRET=your-secret-key-here
```

See `server/env.ts` for the complete list of environment variables.

### Database Migrations

When making changes to Payload CMS collections or globals:

1. **Create a migration**:
   ```sh
   bun run migrate:create optional-name-here
   ```

2. **Check migration status**:
   ```sh
   bun run migrate:status
   ```

3. **Apply migrations**:
   ```sh
   bun run migrate:up
   ```

4. **Refresh database** (development only):
   ```sh
   bun run migrate:refresh
   ```

**Important**: Database migrations should always be non-breaking and backward compatible.

### Type Generation

After making changes to Payload CMS collections, regenerate types:

```sh
bun run typegen
```

This generates:
- Payload types (`server/payload-types.ts`)
- Database schema types
- React Router type definitions

## Coding Standards

### General Principles

- **Functional React**: Always use functional components and hooks
- **TypeScript**: Strict type checking is enabled. Avoid `as` type assertions in internal functions
- **File Naming**: Use kebab-case for file names (e.g., `user-profile.tsx`)
- **Max Line Length**: 1000 characters per file. Split into multiple files when exceeding
- **Comments**: Add comments for complicated code to explain the logic

### Package Manager

**Always use Bun** as the package manager. Do not use npm, yarn, or pnpm.

### Frontend Guidelines

#### Component Library

- **Use Mantine components** exclusively for UI components
- **Use Mantine design tokens** for styling (colors, spacing, etc.)
- **Do NOT use Tailwind classes** - strictly prohibited
- **Do NOT use external CSS frameworks** - strictly prohibited

#### React Patterns

- **Keys in Arrays**: Never use array index as key. Use the item's `id` if available
- **Meta Tags**: Use `<meta>` tags in page components
- **Route Matching**: Use `matches` from `Route.ComponentProps` to check current route
- **Effects**: Use `useEffectEvent` instead of `useEffect`

#### Forms

- **Mantine Forms**: Always use Mantine form in **uncontrolled mode**
- **Never use `cascadeUpdates`** for Mantine forms

#### Styling

- Avoid hardcoding `bg` color in Mantine components unless absolutely necessary
- If hardcoding is necessary, provide a comment explaining why

### Backend Guidelines

#### Error Handling

- **Do NOT use try-catch** in internal functions that use TypeScript Result
- **Use TypeScript Result** for error handling with `Result.wrap` or `Result.try`
- **Function Naming**: Functions returning Result should be prefixed with `try` (e.g., `tryGetUser`, `tryCreateCourse`)
- **Error Classes**: Create error classes in `app/utils/error.ts` first
- **React Router Loaders**: Throw `ErrorResponse` rather than plain errors

#### Database Operations

- **Transactions**: Always use transactions when performing multiple database mutations
- **Migrations**: Must be non-breaking and backward compatible
- **Depth Handling**: Payload local API returns documents with unknown depth. Handle both depth 0 and 1 cases (value is either object or id/string)
- **Virtual Fields**: Prefer virtual fields over depth. Avoid depth > 2 to prevent infinite loops
- **Type Casting**: Strictly avoid using `as` operator in internal functions

#### Internal Functions

- When user ID is provided, assume the user exists
- Do not expose depth variable to args. Define output type instead
- Use `overrideAccess: false` and provide current user (`effectiveUser ?? authenticatedUser`) in loaders and actions

#### Permissions and Access Control

- **Check permissions in server loaders**, not in components
- Use `PermissionResult` from `server/utils/permissions.ts` for permission checks
- Do not check access in loaders/actions. Check access in internal functions and through access hooks in collections

#### Collections

- All global collections should be defined in a single `server/collections/globals.ts`

### Contexts

- React Router contexts should **not** import types from Payload types
- Create types for contexts to provide type stability for the frontend

### Code Organization

- **Max line length**: 1000 characters per file
- **Split complex code**: When exceeding max length, split into multiple files for readability
- **Complicated code**: Always add comments to explain the code

## Testing Guidelines

### Test Framework

- Use `bun:test` for all backend features
- Use Playwright for end-to-end testing

### Test Principles

- **Keep tests simple and readable**
- **Do not mock** - keep tests as simple as possible
- For complex tests, consider skipping and testing manually instead
- Each test file should have only one `describe` block
- Test files related to database, S3, Redis, or Payload should refresh using `beforeAll`

### Test Isolation

If you need a completely isolated test, create a new root `describe` block with its own `beforeAll` and `afterAll`.

### Testing Best Practices

- Use Payload local API only (not Next.js related APIs)
- Test should be simple and easy to read
- Focus on testing behavior, not implementation details

## Git Workflow

### Branch Naming

Use descriptive branch names:
- `feature/description-of-feature`
- `fix/description-of-bug`
- `refactor/description-of-refactor`
- `docs/description-of-docs`

### Commit Messages

Write clear, descriptive commit messages:

```
type: brief description

Optional longer explanation of what and why, not how.
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Pre-commit Hooks

Lefthook runs automatically on commit and checks:
- **Changelog**: At least one changelog file must be modified or added
- **Typecheck**: TypeScript type checking
- **Lint**: Biome linting with error-level diagnostics

Ensure all checks pass before committing.

## Changelog Requirements

### When to Create a Changelog

Every change that affects functionality, adds features, fixes bugs, or modifies behavior requires a changelog entry.

### Changelog Format

1. **File Naming**: `changelogs/XXXX-YYYY-MM-DD-feature-or-change-name.md`
   - `XXXX`: Sequential number (4 digits, zero-padded)
   - `YYYY-MM-DD`: Date of the changelog
   - `feature-or-change-name`: Kebab-case description

2. **Structure**: See `changelogs/0016-2025-10-29-assignment-grading-page.md` for a complete example

3. **Required Sections**:
   - Overview
   - Key Features (if applicable)
   - Technical Implementation
   - Database Integration (if applicable)
   - User Experience Improvements
   - Permissions and Access Control (if applicable)
   - Testing Considerations
   - Migration Notes (if applicable)

### Example

```markdown
# Feature Name

**Date**: YYYY-MM-DD  
**Type**: Feature Addition / Bug Fix / Refactoring  
**Impact**: High / Medium / Low

## Overview

Brief description of what was changed and why.

## Key Features

- Feature 1
- Feature 2

## Technical Implementation

### New Files Created
- `path/to/file.ts`

### Modified Files
- `path/to/file.ts`

## Testing Considerations

- Test case 1
- Test case 2
```

## Release Notes

Release notes aggregate changelogs for a release but focus on:
- **User impact** rather than technical details
- **Features and improvements** from a user perspective
- **User interface and experience** changes

Release notes are written in `release-notes/` folder with format: `VERSION-YYYY-MM-DD.md`

## Pull Request Process

### Before Submitting

1. **Update your branch**:
   ```sh
   git checkout main
   git pull upstream main
   git checkout your-branch
   git rebase upstream/main
   ```

2. **Run checks locally**:
   ```sh
   bun typecheck
   bun lint
   bun test:all
   ```

3. **Ensure changelog is created**:
   - At least one changelog file in `changelogs/` directory
   - Follows the naming convention and structure

4. **Test your changes**:
   - Test manually in development environment
   - Ensure no breaking changes
   - Verify migrations work correctly

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Related Changelog(s)
- changelogs/XXXX-YYYY-MM-DD-feature-name.md

## Testing
- [ ] Tests added/updated
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated (if needed)
- [ ] No new warnings generated
- [ ] Changelog created
```

### Review Process

1. **Automated Checks**: CI will run type checking, linting, and tests
2. **Code Review**: At least one maintainer will review your PR
3. **Feedback**: Address any feedback or questions
4. **Merge**: Once approved, your PR will be merged

## Reporting Issues

### Bug Reports

Use the GitHub issue template and include:

- **Description**: Clear description of the bug
- **Steps to Reproduce**: Detailed steps to reproduce
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Environment**: 
  - OS and version
  - Bun version
  - Docker version (if applicable)
- **Screenshots**: If applicable
- **Logs**: Relevant error messages or logs

### Security Issues

**Do NOT** create a public issue for security vulnerabilities. Instead, email the maintainers directly.

## Proposing Features

### Feature Requests

1. **Check existing issues**: Search for similar feature requests
2. **Create an issue**: Use the feature request template
3. **Provide context**: Explain the use case and benefits
4. **Discuss**: Engage in discussion with maintainers and community

### Implementation

1. **Get approval**: Wait for maintainer approval before starting implementation
2. **Create a branch**: Follow branch naming conventions
3. **Implement**: Follow coding standards and create changelog
4. **Submit PR**: Follow pull request process

## Additional Resources

- **Documentation**: https://docs.paideialms.com
- **Repository**: https://github.com/paideia-lms/paideia
- **Issues**: https://github.com/paideia-lms/paideia/issues

## Questions?

If you have questions or need help:

1. Check existing documentation and issues
2. Ask in GitHub Discussions
3. Create an issue with the "question" label

Thank you for contributing to Paideia LMS! 🎓
