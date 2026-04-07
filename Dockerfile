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

# Add a script to inject environment variables at runtime into config.js
RUN echo '#!/bin/sh' > /docker-entrypoint.d/40-generate-config.sh && \
    echo 'CLEAN_URL=$(echo $POCKETBASE_URL | tr -d "\r")' >> /docker-entrypoint.d/40-generate-config.sh && \
    echo 'echo "window.APP_CONFIG = { POCKETBASE_URL: \"$CLEAN_URL\" };" > /usr/share/nginx/html/config.js' >> /docker-entrypoint.d/40-generate-config.sh && \
    chmod +x /docker-entrypoint.d/40-generate-config.sh

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
