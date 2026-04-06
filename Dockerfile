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

# Copy the custom NGINX configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built Expo Web static files from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80 (This is the port easy panel will bind to)
EXPOSE 80

# Start NGINX with dynamic environment variable injection
# This creates config.js from the template before starting Nginx
CMD ["/bin/sh", "-c", "envsubst < /usr/share/nginx/html/config-template.js > /usr/share/nginx/html/config.js && echo '✅ Dynamic config.js generated' && exec nginx -g 'daemon off;'"]
