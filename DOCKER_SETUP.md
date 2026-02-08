# Docker Setup Guide

This guide covers deploying the Auth0 SDR Research Agent using Docker and Docker Compose.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Configuration](#configuration)
4. [Building and Running](#building-and-running)
5. [Management](#management)
6. [Data Persistence](#data-persistence)
7. [Troubleshooting](#troubleshooting)
8. [Advanced Usage](#advanced-usage)

## Prerequisites

### Install Docker Desktop

**macOS:**
1. Download from [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/)
2. Install Docker Desktop.dmg
3. Start Docker Desktop from Applications
4. Verify: `docker --version` and `docker-compose --version`

**Windows:**
1. Download from [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/)
2. Install Docker Desktop Installer.exe
3. Restart computer if prompted
4. Start Docker Desktop
5. Verify: `docker --version` and `docker-compose --version`

**Linux:**
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt-get install docker-compose-plugin

# Add user to docker group (optional, avoids sudo)
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker --version
docker-compose --version
```

### Get OpenAI API Key

1. Create account at [platform.openai.com](https://platform.openai.com/)
2. Generate API key from [API Keys](https://platform.openai.com/api-keys)
3. Copy and save securely

## Quick Start

### 1. Clone Repository

```bash
git clone <repository-url>
cd agent-sdr
```

### 2. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env file
nano .env
# or
code .env
```

Add your OpenAI API key:
```bash
OPENAI_API_KEY=sk-proj-your-key-here
OPENAI_BASE_URL=
```

### 3. Start with Docker Compose

```bash
# Build and start in detached mode
docker-compose up -d

# View logs
docker-compose logs -f
```

### 4. Access Application

Open browser to: **http://localhost:3000**

### 5. Stop Application

```bash
docker-compose down
```

## Configuration

### Environment Variables

Create `.env` file in project root:

```bash
# Required
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxx

# Optional
OPENAI_BASE_URL=https://api.openai.com/v1
PORT=3000
```

**Security Note:** The `.env` file is git-ignored and should never be committed.

### Port Configuration

To change the port, edit `docker-compose.yml`:

```yaml
ports:
  - "8080:3000"  # Host port 8080 → Container port 3000
```

Then access at: http://localhost:8080

## Building and Running

### Option 1: Docker Compose (Recommended)

**Start:**
```bash
docker-compose up -d
```

**View logs:**
```bash
docker-compose logs -f
```

**Stop:**
```bash
docker-compose down
```

**Rebuild after code changes:**
```bash
docker-compose up -d --build
```

### Option 2: Manual Docker Commands

**Build image:**
```bash
docker build -t agent-sdr:latest .
```

**Run container:**
```bash
docker run -d \
  --name agent-sdr \
  -p 3000:3000 \
  -e OPENAI_API_KEY=your_key_here \
  -v $(pwd)/data:/app/data \
  agent-sdr:latest
```

**View logs:**
```bash
docker logs -f agent-sdr
```

**Stop container:**
```bash
docker stop agent-sdr
docker rm agent-sdr
```

## Management

### View Running Containers

```bash
docker-compose ps
```

Expected output:
```
NAME                COMMAND             STATUS        PORTS
agent-sdr-agent-sdr-1   "npm start"     Up 5 minutes  0.0.0.0:3000->3000/tcp
```

### View Logs

**All logs:**
```bash
docker-compose logs
```

**Follow logs (real-time):**
```bash
docker-compose logs -f
```

**Last 100 lines:**
```bash
docker-compose logs --tail=100
```

**Specific service:**
```bash
docker-compose logs -f agent-sdr
```

### Restart Container

```bash
# Restart without rebuilding
docker-compose restart

# Restart and rebuild
docker-compose up -d --build
```

### Execute Commands in Container

```bash
# Open shell
docker-compose exec agent-sdr sh

# Run specific command
docker-compose exec agent-sdr npm run verify
```

### Health Check

```bash
# Check health status
docker-compose ps

# Manual health check
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-02-08T...",
  "checks": {
    "database": "ok",
    "accountCount": 42,
    "apiKeyConfigured": true,
    "version": "0.1.0"
  }
}
```

## Data Persistence

### How It Works

The `data/` directory is mounted as a Docker volume:

```yaml
volumes:
  - ./data:/app/data
```

This means:
- Database persists on host machine
- Survives container restarts
- Survives container deletion
- Can be backed up normally

### Database Location

**On host:** `./data/accounts.db`
**In container:** `/app/data/accounts.db`

### Backup Database

**From host:**
```bash
cp data/accounts.db backups/accounts-$(date +%Y%m%d).db
```

**From container:**
```bash
docker-compose exec agent-sdr cp /app/data/accounts.db /app/data/backup.db
docker cp agent-sdr:/app/data/backup.db ./backups/
```

### Restore Database

**To host:**
```bash
docker-compose down
cp backups/accounts-20250208.db data/accounts.db
docker-compose up -d
```

## Troubleshooting

### Container Won't Start

**Check logs:**
```bash
docker-compose logs
```

**Common issues:**

1. **Missing .env file**
   ```bash
   cp .env.example .env
   # Edit and add OPENAI_API_KEY
   ```

2. **Port already in use**
   ```bash
   # Change port in docker-compose.yml
   ports:
     - "3001:3000"
   ```

3. **Invalid API key**
   ```bash
   # Verify .env file
   cat .env
   # Update OPENAI_API_KEY
   ```

### Build Failures

**Issue: "Cannot find module"**
```bash
# Clean and rebuild
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

**Issue: "No space left on device"**
```bash
# Clean up Docker
docker system prune -a
docker volume prune
```

### Database Issues

**Issue: "Database locked"**
```bash
# Stop all containers
docker-compose down

# Remove lock files
rm data/accounts.db-wal data/accounts.db-shm

# Restart
docker-compose up -d
```

**Issue: "Database corrupted"**
```bash
# Stop container
docker-compose down

# Restore from backup
cp backups/accounts-backup.db data/accounts.db

# Restart
docker-compose up -d
```

### Performance Issues

**Issue: Slow processing**
- Check Docker resource allocation (Docker Desktop → Settings → Resources)
- Recommended: 4GB RAM, 2 CPUs minimum

**Issue: High memory usage**
- Normal for AI processing
- Consider reducing batch size
- Monitor: `docker stats`

### Connection Issues

**Issue: "Cannot connect to localhost:3000"**

1. **Check container is running:**
   ```bash
   docker-compose ps
   ```

2. **Check health:**
   ```bash
   curl http://localhost:3000/api/health
   ```

3. **Check logs for errors:**
   ```bash
   docker-compose logs
   ```

4. **Restart:**
   ```bash
   docker-compose restart
   ```

## Advanced Usage

### Custom Dockerfile

For development with hot reload, create `docker-compose.dev.yml`:

```yaml
version: '3.8'

services:
  agent-sdr:
    build: .
    ports:
      - "3000:3000"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - NODE_ENV=development
    volumes:
      - ./data:/app/data
      - ./app:/app/app
      - ./components:/app/components
      - ./lib:/app/lib
    command: npm run dev
```

Run with:
```bash
docker-compose -f docker-compose.dev.yml up
```

### Multi-Stage Build

For smaller production images, modify Dockerfile:

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
RUN npm ci --only=production
CMD ["npm", "start"]
```

### Environment-Specific Configs

**Development:**
```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

**Production:**
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up
```

### Scaling (Not Recommended for SQLite)

**Note:** SQLite doesn't support concurrent writes, so don't scale:

```bash
# DON'T DO THIS with SQLite
docker-compose up --scale agent-sdr=3  # Will cause database locks
```

For scaling, migrate to PostgreSQL or MySQL.

### Automated Updates

Create update script `update.sh`:

```bash
#!/bin/bash
echo "Updating agent-sdr..."

# Pull latest changes
git pull

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d

echo "Update complete!"
```

Run:
```bash
chmod +x update.sh
./update.sh
```

## Production Deployment

### Security Best Practices

1. **Use secrets management:**
   ```yaml
   services:
     agent-sdr:
       secrets:
         - openai_key

   secrets:
     openai_key:
       external: true
   ```

2. **Run as non-root:**
   ```dockerfile
   USER node
   ```

3. **Use HTTPS:**
   - Deploy behind reverse proxy (nginx, Caddy)
   - Enable SSL/TLS

4. **Limit resources:**
   ```yaml
   deploy:
     resources:
       limits:
         cpus: '2'
         memory: 2G
   ```

### Monitoring

**Add health check monitoring:**
```bash
# Check every 60 seconds
while true; do
  curl -f http://localhost:3000/api/health || echo "Health check failed"
  sleep 60
done
```

**View resource usage:**
```bash
docker stats agent-sdr
```

### Backup Automation

Add to cron (`crontab -e`):
```bash
# Daily backup at 2 AM
0 2 * * * cd /path/to/agent-sdr && ./backup.sh
```

Create `backup.sh`:
```bash
#!/bin/bash
BACKUP_DIR="backups"
mkdir -p $BACKUP_DIR
cp data/accounts.db $BACKUP_DIR/accounts-$(date +%Y%m%d-%H%M%S).db

# Keep only last 7 days
find $BACKUP_DIR -name "accounts-*.db" -mtime +7 -delete
```

## Docker vs Standard Setup

| Feature | Docker | Standard Node.js |
|---------|--------|------------------|
| Setup time | 5 minutes | 10 minutes |
| Isolation | ✓ Full | ✗ Shared |
| Portability | ✓ High | ~ Medium |
| Updates | Easy rebuild | npm install |
| Resource usage | Higher | Lower |
| Development | Slower builds | Faster |
| Production | ✓ Recommended | Requires PM2 |

## Summary

**Quick Commands:**
```bash
# Start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down

# Restart
docker-compose restart

# Rebuild
docker-compose up -d --build

# Health check
curl http://localhost:3000/api/health

# Backup
cp data/accounts.db backups/backup.db
```

For standard Node.js setup, see [SETUP_GUIDE.md](SETUP_GUIDE.md).

For troubleshooting, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
