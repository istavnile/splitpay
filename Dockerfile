# ==========================================
# STAGE 1: Build Expo Web Application
# ==========================================
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies first for better caching
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the application code
# (node_modules and local builds are excluded via .dockerignore)
COPY . .

# Set environment variables for the build process (Baked into the JS bundle)
ARG EXPO_PUBLIC_SUPABASE_URL
ARG EXPO_PUBLIC_SUPABASE_ANON_KEY

ENV EXPO_PUBLIC_SUPABASE_URL=$EXPO_PUBLIC_SUPABASE_URL
ENV EXPO_PUBLIC_SUPABASE_ANON_KEY=$EXPO_PUBLIC_SUPABASE_ANON_KEY

# Build the Expo web application
RUN npx expo export -p web

# Ensure PWA assets from public/ are in the dist folder
# Some Expo versions don't copy these automatically in certain environments
RUN cp -r public/* dist/ || true

# ==========================================
# STAGE 2: Serve with NGINX
# ==========================================
FROM nginx:alpine

# Remove the default nginx index page
RUN rm -rf /usr/share/nginx/html/*

# Copy the custom NGINX configuration as a template
COPY nginx.conf /etc/nginx/conf.d/default.conf.template

# Install gettext for envsubst
RUN apk add --no-cache gettext

# Copy the built Expo Web static files from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Create a custom entrypoint script to generate config.js AND nginx.conf at runtime
RUN echo '#!/bin/sh' > /docker-entrypoint.d/40-generate-config.sh && \
    echo 'export SUPABASE_HOSTNAME=$(echo $EXPO_PUBLIC_SUPABASE_URL | sed -e "s|^[^/]*//||" -e "s|/.*$||")' >> /docker-entrypoint.d/40-generate-config.sh && \
    echo 'envsubst < /usr/share/nginx/html/config-template.js > /usr/share/nginx/html/config.js' >> /docker-entrypoint.d/40-generate-config.sh && \
    echo 'envsubst '"'"'$EXPO_PUBLIC_SUPABASE_URL $SUPABASE_HOSTNAME'"'"' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf' >> /docker-entrypoint.d/40-generate-config.sh && \
    echo 'echo "✅ Dynamic config.js and nginx.conf generated"' >> /docker-entrypoint.d/40-generate-config.sh && \
    chmod +x /docker-entrypoint.d/40-generate-config.sh

# Start NGINX
CMD ["nginx", "-g", "daemon off;"]
