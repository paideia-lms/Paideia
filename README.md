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

### App Only Development

Run just the development server (requires external database and MinIO):


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
- **App**: http://localhost:3000

## Production

Build for production:

```sh
bun run build
```

Run in production mode:

```sh
bun start
```

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

[MIT License](LICENSE)
