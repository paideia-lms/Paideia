# Paideia LMS

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

## Development

Run the development server:

```sh
bun dev
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

## Tech Stack

- **[Bun](https://bun.sh)** - Fast JavaScript runtime and bundler
- **[React Router v7](https://reactrouter.com/)** - Modern React framework
- **[Elysia](https://elysiajs.com)** - High-performance web framework
- **[TypeScript](https://typescriptlang.org/)** - Type-safe JavaScript
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS framework

## Deployment

### Docker

```sh
docker build -t paideia-lms .
docker run -p 3000:3000 paideia-lms
```

### Single Executable

Build and package as a standalone binary:

```sh
bun run build:exe
```

## Contributing

We welcome contributions! This project is built with modern development practices and aims to be a community-driven alternative to traditional LMS platforms.

## License

[MIT License](LICENSE)
