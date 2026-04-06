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

# Build the Expo web application
# This generates the static web files in the /app/dist folder
RUN npx expo export -p web

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

# Start NGINX
CMD ["nginx", "-g", "daemon off;"]
