# Stage 1: Build Stage
FROM oven/bun:latest AS builder

# Set the working directory in the builder stage
WORKDIR /app

# Copy package.json and bun.lockb (or other lock files)
COPY package.json bun.lockb ./

# Install dependencies using Bun
# Using --frozen-lockfile for reproducible builds
RUN bun install --frozen-lockfile

# Copy the rest of the frontend application source code
COPY . .

# Run the build command (e.g., generates static assets in /app/dist)
RUN bun run build

# Stage 2: Serve Stage
FROM nginx:alpine AS server

# Set working directory for Nginx (optional, but good practice)
WORKDIR /usr/share/nginx/html

# Remove default Nginx static assets
RUN rm -rf ./*

# Copy the built static assets from the builder stage
# (from /app/dist in the builder stage to /usr/share/nginx/html in the server stage)
COPY --from=builder /app/dist .

# Copy the custom Nginx configuration
# This file (nginx.conf) should be in the same directory as the Dockerfile (i.e., frontend/)
# It will replace or augment the default Nginx configuration.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose the port Nginx listens on (default is 80)
EXPOSE 80

# The default Nginx CMD will start the server.
# No explicit CMD is needed here unless you want to override the default.
# CMD ["nginx", "-g", "daemon off;"] # This is often the default in nginx images
