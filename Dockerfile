# Use Bun as base image
FROM oven/bun:slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lock  ./
COPY patches ./patches

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN bun run build

# Expose port 3000
EXPOSE 3000

# Start the application
CMD ["bun", "run", "start"]
