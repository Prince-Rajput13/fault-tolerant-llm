# Multi-stage Dockerfile for React + Vite frontend
# Stage 1: Build client static assets
FROM node:22-alpine AS builder

WORKDIR /app

# Build arguments for Vite environment variables
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: High-performance, lightweight Nginx static web server
FROM nginx:alpine AS runner

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy custom nginx configuration listening on port 3000
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Permissions for standard nginx user
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=3s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
