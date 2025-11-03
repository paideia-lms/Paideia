# 🌿 Paideia LMS

> [!IMPORTANT] 
> This project is in active development and is not yet ready for production use.

> [!NOTE] 
> We're actively looking for **contributors** and **sponsors** to help build and maintain Paideia LMS. Whether you're a developer, educator, or organization interested in supporting open-source education technology, we'd love to hear from you.

A modern, lightweight Learning Management System (LMS) built with [Bun](https://bun.sh) and [React Router v7](https://reactrouter.com/). Designed for extreme ease of management and deployment as a single executable.

## 🎯 Vision

Paideia LMS aims to be the modern alternative to traditional LMS platforms like Moodle. Built from the ground up with modern web technologies, it focuses on simplicity, performance, and developer experience while maintaining powerful LMS capabilities.

### Core Features

- **📚 Course Management**: Create and manage courses with assignments, quizzes, content, and grading
- **👥 User Management**: Comprehensive user creation and role-based access control
- **🔐 Access Control**: Fine-grained permissions and security
- **💳 Payment Integration**: Built-in payment processing capabilities
- **📊 Telemetry & Observability**: Advanced monitoring and analytics
- **🔄 Version Control**: Track changes and maintain course history
- **🔌 API**: RESTful API for integrations and extensions
- **📦 Single Executable**: Extremely easy deployment and management
- **🔄 LMS Import**: Import courses and data from Moodle, Canvas, and other LMS platforms
- **🔗 Integrations**: Connect with external tools and services

### Architecture Principles

- **🚀 Single Executable**: Package and deploy as one binary for maximum portability
- **🐰 Lightweight**: Minimal resource usage with fast startup times
- **🛡️ No Dynamic Plugins**: Built-in functionality without complex plugin management
- **🏢 Organization-Hosted**: Designed for server-based deployments, not serverless
- **⚡ Modern Stack**: Bun runtime + React Router v7 + TypeScript

## 💝 Free and Non-Profit

Paideia LMS will remain **free and non-profit forever** to benefit all organizations, educational institutions, and communities worldwide. We welcome sponsors and donations to support ongoing development and maintenance.

## 📚 Documentation

Complete documentation is available at [docs.paideialms.com](https://docs.paideialms.com)

## Development

### Docker Compose Setup

The project uses two separate docker-compose files to separate infrastructure services from the Paideia application:

- **`docker-compose.yml`**: Contains infrastructure services (PostgreSQL, MinIO, Drizzle Gateway)
- **`docker-compose.paideia.yml`**: Contains the Paideia application service

This separation prevents accidentally starting the Paideia Docker container during development.

### App Only Development

Start only the infrastructure services for development:

```sh
docker-compose up -d
```

Or use the dev script which starts infrastructure services and runs the app locally:

```sh
bun dev
```

This starts:
- **PostgreSQL**: localhost:5432 (paideia/paideia_password)
- **MinIO**: http://localhost:9000 (API) / http://localhost:9001 (Web UI)
  - Access Key: paideia_minio
  - Secret Key: paideia_minio_secret
- **Drizzle Gateway**: localhost:4983
  - Master Password: your_master_password
  - Database URL: postgresql://paideia:paideia_password@postgres:5432/paideia_db
- **App** (via `bun dev`): http://localhost:3000

To stop the infrastructure services:

```sh
docker-compose down
```

## Production

Build for production:

```sh
bun run build
```

Run in production mode:

```sh
bun start
```

### Releasing

To create a new release and trigger the automated GitHub Actions workflow:

1. **Update the version in `package.json`** to match your desired release version (e.g., `0.5.0`)

2. **Commit and push your changes:**

```sh
git add package.json
git commit -m "chore: bump version to 0.5.0"
git push origin main
```

3. **Create and push a git tag** matching the version with a `v` prefix:

```sh
git tag v0.5.0
git push origin v0.5.0
```

The workflow will automatically:
- Check if a release for this version already exists (to avoid duplicate builds)
- Build macOS ARM64 and Linux ARM64 binaries
- Build and push a Docker image to GitHub Container Registry (`ghcr.io/paideia-lms/paideia`) with tags:
  - `v{VERSION}` (e.g., `v0.5.0`)
  - `latest`
- Create a GitHub release with both binaries attached

You can monitor the workflow progress in the [Actions tab](https://github.com/paideia-lms/paideia/actions) of the repository.

**Note:** The tag name (e.g., `v0.5.0`) must match the version in `package.json` (e.g., `0.5.0`) with a `v` prefix. If a release for that version already exists, the workflow will skip all build steps to save resources.

### Docker

#### Running with Docker Compose

To run the complete Paideia stack (including the Paideia application) with Docker Compose, use both configuration files:

```sh
docker-compose -f docker-compose.yml -f docker-compose.paideia.yml up -d
```

This starts all services:
- Infrastructure services from `docker-compose.yml` (PostgreSQL, MinIO, Drizzle Gateway)
- Paideia application from `docker-compose.paideia.yml`

To stop all services:

```sh
docker-compose -f docker-compose.yml -f docker-compose.paideia.yml down
```

**Note:** During development, use only `docker-compose.yml` to start infrastructure services without the Paideia container. This allows you to run the application locally with `bun dev` for hot-reloading and easier debugging.

#### Building the Linux Binary

The Linux binary must be built in a Linux environment to ensure native dependencies (like `sharp`) are correctly compiled for Linux ARM64. You can use `Dockerfile.build` to create a build environment:

**Option 1: Using Docker Build Environment (Interactive)**

The `Dockerfile.build` creates an interactive build container where you can manually build the Linux binary:

1. **Create and start the build container:**

```sh
bun run docker:build-binary
```

This will:
- Build the Docker image with all dependencies
- Start a container named `paideia-builder`
- Print instructions for entering the container

2. **Enter the container:**

```sh
bun run docker:builder-shell
```

Or manually:
```sh
docker exec -it paideia-builder /bin/bash
```

3. **Build the Linux binary inside the container:**

```sh
bun scripts/build-linux.ts
```

4. **Copy the binary from the container:**

```sh
bun run docker:copy-binary
```

Or manually:
```sh
mkdir -p dist
docker cp paideia-builder:/build/dist/paideia-linux-arm64 ./dist/
```

**Option 2: Using build-linux.ts in a Linux Environment**

If you have access to a Linux machine or Linux container:

```sh
bun run build:linux
```

**Note:** Building the Linux binary on macOS won't work correctly because native dependencies like `sharp` will bundle the macOS version, which won't run on Linux. Always build the Linux binary in a Linux environment.

#### Building the Runtime Docker Image

Once you have the Linux binary in `dist/paideia-linux-arm64`, build the runtime Docker image:

```sh
docker build -t paideia:latest .
```

The runtime image is minimal and only contains the pre-built binary, making it perfect for deployment and GitHub releases.

Run the container with environment variables from a `.env` file:

```sh
docker run -d \
  --name paideia \
  -p 3000:3000 \
  -p 3001:3001 \
  --env-file .env \
  paideia:latest
```

Alternatively, you can pass environment variables directly:

```sh
docker run -d \
  --name paideia \
  -p 3000:3000 \
  -p 3001:3001 \
  -e DATABASE_URL=postgresql://paideia:paideia_password@postgres:5432/paideia_db \
  -e S3_URL=http://minio:9000 \
  -e S3_ACCESS_KEY=paideia_minio \
  -e S3_SECRET_KEY=paideia_minio_secret \
  -e S3_ENDPOINT_URL=http://minio:9000 \
  -e S3_BUCKET=paideia \
  -e PAYLOAD_SECRET=your-secret-key-here \
  paideia:latest
```

**Required Environment Variables:**

- `DATABASE_URL` - PostgreSQL connection string
- `S3_URL` - MinIO/S3 service URL
- `S3_ACCESS_KEY` - S3 access key
- `S3_SECRET_KEY` - S3 secret key
- `S3_ENDPOINT_URL` - S3 endpoint URL (without bucket name)
- `S3_BUCKET` - S3 bucket name
- `PAYLOAD_SECRET` - Secret key for Payload CMS (generate a strong random string)

**Optional Environment Variables:**

- `PORT` - Backend port (default: 3001)
- `FRONTEND_PORT` - Frontend port (default: 3000)
- `SMTP_HOST` - SMTP server host
- `SMTP_USER` - SMTP username
- `SMTP_PASS` - SMTP password
- `RESEND_API_KEY` - Resend API key for email
- `EMAIL_FROM_ADDRESS` - Email sender address (default: info@paideialms.com)
- `EMAIL_FROM_NAME` - Email sender name (default: Paideia LMS)
- `SANDBOX_MODE` - Enable sandbox mode (default: 0)

**Note:** The Docker image includes the Linux ARM64 binary. For production deployments, ensure your Docker host supports ARM64 architecture or build the binary for your target platform.

## Tech Stack

- **[Bun](https://bun.sh)** - Fast JavaScript runtime and bundler
- **[React Router v7](https://reactrouter.com/)** - Modern React framework
- **[Elysia](https://elysiajs.com)** - High-performance web framework
- **[TypeScript](https://typescriptlang.org/)** - Type-safe JavaScript
- **[Payload CMS](https://payloadcms.com/)** - Headless CMS
- **[Mantine](https://mantine.dev/)** - Modern React components

Development tools:
- **[Biome](https://biomejs.dev/)** - Linter and formatter
- **[Lefthook](https://lefthook.dev/)** - Git hooks
- **[Playwright](https://playwright.dev/)** - Browser automation

### Single Executable

Build and package as a standalone binary:

```sh
bun run build
```

## Contributing

We welcome contributions! This project is built with modern development practices and aims to be a community-driven alternative to traditional LMS platforms.

## License

Paideia LMS is licensed under the [GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE).

### What this means:

- ✅ **Free and Open Source**: Use, modify, and distribute freely
- ✅ **Schools and Educational Institutions**: Can host and use without restrictions
- ✅ **Modifications Must Be Shared**: If you modify and host this software, you must share your changes
- ✅ **Same License Required**: All forks and derivatives must use AGPL-3.0
- ⚠️ **Commercial Hosting Restrictions**: While the license permits commercial use, we strongly discourage organizations from hosting this software for schools as a paid service. The spirit of this project is to remain freely accessible to educational institutions.

If you're interested in commercial partnerships or support services that align with our mission, please reach out to discuss collaboration opportunities.
