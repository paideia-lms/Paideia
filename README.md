# Paideia LMS

[![GitHub stars](https://img.shields.io/github/stars/paideia-lms/paideia?style=social)](https://github.com/paideia-lms/paideia)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/paideia-lms/Paideia)

> [!IMPORTANT] 
> This project is in active development and is not yet ready for production use.

> [!NOTE] 
> We're looking for contributors and sponsors. If you're interested in helping build a modern alternative to traditional LMS platforms, we'd love to hear from you.

A lightweight Learning Management System built with [Bun](https://bun.sh) and [React Router v7](https://reactrouter.com/). Deploys as a single executable.

![Dashboard](doc/assets/dashboard.webp)

## What is Paideia?

Paideia LMS is a modern alternative to platforms like Moodle. It's built with modern web tech, focuses on simplicity and performance, and packages everything into a single binary.

**Features:**
- Course management (assignments, quizzes, content, grading)
- User management with role-based access control
- Payment integration
- Version control and change tracking
- RESTful API
- Import from Moodle, Canvas, and other LMS platforms

**Architecture:**
- Single executable deployment
- Lightweight and fast
- No dynamic plugins (everything built-in)
- Designed for server deployments, not serverless
- Built with Bun, React Router v7, and TypeScript

Paideia LMS is **free and non-profit forever**. We welcome sponsors and donations to support development.

## Documentation

Full docs at [docs.paideialms.com](https://docs.paideialms.com)

## Installation

See `docker-compose.yml` and `docker-compose.paideia.yml` for configuration details.

**Quick start:**
```sh
docker compose -f docker-compose.yml -f docker-compose.paideia.yml up -d
```

Access:
- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- MinIO Console: http://localhost:9001

**Binary installation:** Download from [GitHub Releases](https://github.com/paideia-lms/paideia/releases) and configure environment variables as shown in the docker-compose files.

See `server/env.ts` for environment variable documentation.

## Development

Start infrastructure services:
```sh
docker compose up -d
```

Or use the dev script:
```sh
bun dev
```

This starts PostgreSQL (localhost:5432), MinIO (localhost:9000/9001), Drizzle Gateway (localhost:4983), and the app (localhost:3000).

The project uses two docker compose files:
- `docker-compose.yml` - Infrastructure services (PostgreSQL, MinIO, Drizzle Gateway)
- `docker-compose.paideia.yml` - Paideia application

This keeps the app container separate during development so you can run it locally with `bun dev` for hot-reloading.

## Production

Build:
```sh
bun run build
```

Run:
```sh
bun start
```

### Releasing

1. Update version in `package.json`
2. Commit and push:
   ```sh
   git add package.json
   git commit -m "chore: bump version to X.X.X"
   git push origin main
   ```
3. Create and push a git tag:
   ```sh
   git tag vX.X.X
   git push origin vX.X.X
   ```

The GitHub Actions workflow will build binaries and Docker images automatically. Check progress in the [Actions tab](https://github.com/paideia-lms/paideia/actions).

### Building Linux Binary

The Linux binary must be built in a Linux environment. Use the Docker build environment:

```sh
bun run docker:build-binary
bun run docker:builder-shell
# Inside container:
bun scripts/build-linux.ts
# Exit container, then:
bun run docker:copy-binary
```

Or if you have a Linux machine:
```sh
bun run build:linux
```

Build the Docker image:
```sh
docker build -t paideia:latest .
```

Run with environment variables:
```sh
docker run -d --name paideia -p 3000:3000 -p 3001:3001 --env-file .env paideia:latest
```

## Tech Stack

- [Bun](https://bun.sh) - Runtime and bundler
- [React Router v7](https://reactrouter.com/) - React framework
- [Elysia](https://elysiajs.com) - Web framework
- [TypeScript](https://typescriptlang.org/) - Type safety
- [Payload CMS](https://payloadcms.com/) - Headless CMS
- [Mantine](https://mantine.dev/) - UI components

Development tools: Biome, Lefthook

## Contributing

Contributions welcome! This is a community-driven project built with modern development practices.

## License

Paideia LMS is licensed under the [GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE).

- Free and open source
- Schools can use without restrictions
- Modifications must be shared
- All forks must use AGPL-3.0
- We discourage commercial hosting of this software for schools as a paid service

If you're interested in commercial partnerships that align with our mission, reach out to discuss.

---

[![Star History Chart](https://api.star-history.com/svg?repos=paideia-lms/paideia&type=Date)](https://star-history.com/#paideia-lms/paideia&Date)
