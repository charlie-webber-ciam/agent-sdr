FROM node:20-alpine

WORKDIR /app

# Install dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Create data directory
RUN mkdir -p data

# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

# Environment variables will be passed via docker-compose or -e flags
ENV NODE_ENV=production

# Start the application
CMD ["npm", "start"]
