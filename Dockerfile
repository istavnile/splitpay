# STAGE 1: Build the React application
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# STAGE 2: Serve with NGINX
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Fix permissions and expose
RUN chmod +x /docker-entrypoint.d/40-generate-config.sh

EXPOSE 80
CMD ["/bin/sh", "-c", "/docker-entrypoint.d/40-generate-config.sh && nginx -g 'daemon off;'"]
