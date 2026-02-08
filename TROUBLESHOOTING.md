# Troubleshooting Guide

This guide covers common issues and their solutions for the Auth0 SDR Research Agent.

## Table of Contents

1. [Installation Issues](#installation-issues)
2. [Configuration Issues](#configuration-issues)
3. [Runtime Issues](#runtime-issues)
4. [Processing Issues](#processing-issues)
5. [Database Issues](#database-issues)
6. [Performance Issues](#performance-issues)
7. [Docker Issues](#docker-issues)
8. [Getting Additional Help](#getting-additional-help)

## Installation Issues

### "Cannot find module 'better-sqlite3'"

**Cause:** Dependencies not installed or installation failed.

**Solution:**
```bash
# Reinstall dependencies
npm install

# If that fails, clean and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Windows specific:**
```bash
# May need windows-build-tools
npm install --global windows-build-tools
npm install
```

### "gyp ERR! stack Error: not found: python"

**Cause:** Python not installed (required for building native modules).

**Solution:**

**macOS:**
```bash
# Install via Homebrew
brew install python3

# Or use Xcode Command Line Tools
xcode-select --install
```

**Windows:**
1. Download Python from [python.org](https://www.python.org/)
2. Install with "Add Python to PATH" checked
3. Restart terminal
4. Run `npm install` again

**Linux:**
```bash
sudo apt-get install python3 python3-dev
```

### "Permission denied" during npm install

**Cause:** Incorrect npm directory permissions.

**Solution (macOS/Linux):**
```bash
# Don't use sudo npm install!
# Fix npm permissions instead:
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules

# Then try again
npm install
```

**Windows:**
Run terminal as Administrator, then:
```bash
npm install
```

### "EACCES: permission denied, mkdir"

**Cause:** No write permission in project directory.

**Solution:**
```bash
# macOS/Linux
sudo chown -R $(whoami) .
npm install

# Windows: Run as Administrator
```

## Configuration Issues

### "OpenAI API key not configured"

**Cause:** Missing or incorrectly configured `.env.local` file.

**Solution:**

1. **Check file exists:**
   ```bash
   ls -la .env.local
   ```

2. **If missing, create it:**
   ```bash
   cp .env.example .env.local
   ```

3. **Edit and add key:**
   ```bash
   nano .env.local
   # or
   code .env.local
   ```

4. **Verify format (no quotes, no spaces):**
   ```bash
   OPENAI_API_KEY=sk-proj-abc123xyz789
   ```

5. **Restart server:**
   ```bash
   # Press Ctrl+C to stop
   npm run dev
   ```

### "Invalid API key" or "401 Unauthorized"

**Cause:** API key is invalid, expired, or has wrong format.

**Solution:**

1. **Verify key format:**
   - Should start with `sk-` or `sk-proj-`
   - No spaces or quotes
   - Single line

2. **Test key:**
   ```bash
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer YOUR_API_KEY"
   ```

3. **Generate new key:**
   - Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - Create new secret key
   - Update `.env.local`

4. **Check billing:**
   - Ensure OpenAI account has active payment method
   - Check usage limits not exceeded

### "Model not found: gpt-5.2"

**Cause:** The configured model is not available in your OpenAI account.

**Solution:**

1. **Check available models:**
   ```bash
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer YOUR_API_KEY" \
     | grep "gpt"
   ```

2. **Update model in code:**

   Edit `lib/agent-researcher.ts`:
   ```typescript
   // Find line ~20
   model: 'gpt-4' // or 'gpt-4-turbo', 'gpt-3.5-turbo'
   ```

   Edit `lib/categorizer.ts`:
   ```typescript
   // Find line ~15
   model: 'gpt-4' // match the same model
   ```

3. **Restart server:**
   ```bash
   npm run dev
   ```

## Runtime Issues

### "Port 3000 already in use"

**Cause:** Another process is using port 3000.

**Solution 1: Use different port**
```bash
PORT=3001 npm run dev
# Then open http://localhost:3001
```

**Solution 2: Stop process using port 3000**

**macOS/Linux:**
```bash
# Find process
lsof -ti:3000

# Kill process
lsof -ti:3000 | xargs kill -9
```

**Windows (Command Prompt):**
```cmd
# Find process
netstat -ano | findstr :3000

# Kill process (replace PID with actual PID)
taskkill /PID <PID> /F
```

**Windows (PowerShell):**
```powershell
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process
```

### "Cannot GET /" or blank page

**Cause:** Application not started properly or build issue.

**Solution:**

1. **Check server is running:**
   ```bash
   curl http://localhost:3000
   ```

2. **Restart development server:**
   ```bash
   # Press Ctrl+C
   npm run dev
   ```

3. **Clear Next.js cache:**
   ```bash
   rm -rf .next
   npm run dev
   ```

4. **Check browser console:**
   - Open Developer Tools (F12)
   - Check Console tab for errors

### "Error: ENOENT: no such file or directory"

**Cause:** Missing file or directory.

**Solution:**

Check which file is missing from error message, then:

```bash
# If data directory missing
mkdir -p data

# If schema.sql missing
ls lib/schema.sql

# If node_modules missing
npm install

# If .next missing
npm run dev  # Will rebuild
```

## Processing Issues

### Accounts stuck in "processing" status

**Cause:** Server crashed, API timeout, or rate limit hit.

**Solution:**

1. **Check server logs:**
   - Look at terminal running `npm run dev`
   - Check for error messages

2. **Check OpenAI API status:**
   - Visit [status.openai.com](https://status.openai.com/)

3. **Check rate limits:**
   - Go to [platform.openai.com/account/limits](https://platform.openai.com/account/limits)
   - Upgrade plan if needed

4. **Restart server:**
   ```bash
   # Press Ctrl+C
   npm run dev
   ```

5. **Manually reset stuck accounts:**
   - Go to Accounts page
   - Filter by status: "Processing"
   - Select stuck accounts
   - Click "Retry Selected"

### All accounts fail immediately

**Cause:** API key issue, model not available, or network problem.

**Solution:**

1. **Verify API key:**
   ```bash
   cat .env.local
   # Check OPENAI_API_KEY is correct
   ```

2. **Test API directly:**
   ```bash
   curl https://api.openai.com/v1/chat/completions \
     -H "Authorization: Bearer YOUR_KEY" \
     -H "Content-Type: application/json" \
     -d '{"model":"gpt-4","messages":[{"role":"user","content":"test"}]}'
   ```

3. **Check model availability:**
   - Update model in `lib/agent-researcher.ts` and `lib/categorizer.ts`
   - Use model you have access to

4. **Check firewall/proxy:**
   - Ensure application can reach api.openai.com
   - Check corporate firewall settings

### Processing is very slow

**Cause:** API rate limits, network latency, or overloaded system.

**Expected behavior:**
- 30-60 seconds per account is normal
- 6 research queries per account
- Sequential processing (by design)

**If slower than expected:**

1. **Check internet speed:**
   ```bash
   curl -o /dev/null https://api.openai.com/
   ```

2. **Check system resources:**
   - Close unnecessary applications
   - Check CPU/memory usage

3. **Check OpenAI tier:**
   - Higher tiers = higher rate limits
   - Upgrade if processing large batches

### Categorization fails with "Rate limit exceeded"

**Cause:** Too many requests too quickly.

**Solution:**

1. **Wait a few minutes** then try again

2. **Categorize in smaller batches:**
   - Select 5-10 accounts at a time instead of all

3. **Upgrade OpenAI tier:**
   - Go to [platform.openai.com/settings](https://platform.openai.com/settings)
   - Upgrade to higher tier for more capacity

## Database Issues

### "Database is locked"

**Cause:** Multiple connections or processes accessing database.

**Solution:**

1. **Ensure only one server running:**
   ```bash
   # Find node processes
   ps aux | grep node
   # or on Windows
   tasklist | findstr node

   # Kill extra processes
   kill <PID>
   ```

2. **Close database viewers:**
   - Close DB Browser for SQLite
   - Close any other database tools

3. **Remove lock files:**
   ```bash
   rm data/accounts.db-wal
   rm data/accounts.db-shm
   ```

4. **Restart server:**
   ```bash
   npm run dev
   ```

### "Database disk image is malformed"

**Cause:** Database file corrupted.

**Solution:**

1. **Stop server** (Ctrl+C)

2. **Restore from backup:**
   ```bash
   cp backups/accounts-latest.db data/accounts.db
   ```

3. **If no backup, try recovery:**
   ```bash
   # Dump to SQL
   sqlite3 data/accounts.db .dump > dump.sql

   # Create new database
   mv data/accounts.db data/accounts.db.corrupt
   sqlite3 data/accounts.db < dump.sql
   ```

4. **Last resort - reset database:**
   ```bash
   npm run reset-db
   # Warning: This deletes all data!
   ```

### "UNIQUE constraint failed"

**Cause:** Trying to insert duplicate data.

**Solution:**

This is usually handled by the application, but if you see this:

1. **Check for duplicate domains in CSV:**
   - Each domain should appear only once

2. **Check existing database:**
   ```bash
   sqlite3 data/accounts.db
   > SELECT domain, COUNT(*) FROM accounts GROUP BY domain HAVING COUNT(*) > 1;
   > .exit
   ```

3. **Delete duplicates manually:**
   - Use Accounts page to find and delete duplicates

## Performance Issues

### High memory usage

**Cause:** Normal for AI processing, but can be excessive.

**Expected:** 200-300MB during processing
**Concerning:** > 1GB

**Solution:**

1. **Normal usage:**
   - This is expected during active processing
   - Memory releases after processing completes

2. **If excessive:**
   - Reduce batch size (process fewer accounts at once)
   - Close other applications
   - Restart server periodically

3. **Check for memory leaks:**
   ```bash
   # Monitor memory
   ps aux | grep node
   # or
   top
   ```

### Slow UI/page loads

**Cause:** Large database, slow queries, or network issues.

**Solution:**

1. **Clear Next.js cache:**
   ```bash
   rm -rf .next
   npm run dev
   ```

2. **Optimize database:**
   ```bash
   sqlite3 data/accounts.db
   > VACUUM;
   > ANALYZE;
   > .exit
   ```

3. **Check database size:**
   ```bash
   ls -lh data/accounts.db
   # If > 100MB, consider archiving old accounts
   ```

## Docker Issues

### Container won't start

**See [DOCKER_SETUP.md](DOCKER_SETUP.md#troubleshooting) for Docker-specific issues.**

Quick checks:
```bash
# Check logs
docker-compose logs

# Check if .env exists
ls -la .env

# Verify configuration
docker-compose config
```

### "Cannot connect to Docker daemon"

**Solution:**
```bash
# macOS/Windows: Start Docker Desktop

# Linux: Start Docker service
sudo systemctl start docker
```

## Getting Additional Help

### Before asking for help, gather:

1. **Error message** (full text)
2. **System information:**
   ```bash
   node --version
   npm --version
   # macOS/Linux
   uname -a
   # Windows
   systeminfo | findstr /B /C:"OS"
   ```

3. **Steps to reproduce** the issue

4. **Relevant logs:**
   - Terminal output
   - Browser console errors (F12 → Console)
   - Database errors

### Quick diagnostic commands:

```bash
# Verify setup
npm run verify

# Check health
curl http://localhost:3000/api/health

# View logs
# (already visible in terminal running npm run dev)

# Test database
sqlite3 data/accounts.db "SELECT COUNT(*) FROM accounts;"

# Test OpenAI API
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $(grep OPENAI_API_KEY .env.local | cut -d '=' -f2)"
```

### Resources:

- **Setup Guide:** [SETUP_GUIDE.md](SETUP_GUIDE.md)
- **README:** [README.md](README.md)
- **Docker Setup:** [DOCKER_SETUP.md](DOCKER_SETUP.md)
- **Backup Guide:** [BACKUP.md](BACKUP.md)
- **OpenAI Status:** [status.openai.com](https://status.openai.com/)
- **GitHub Issues:** Check existing issues or create new one

### Still stuck?

Create a GitHub issue with:
- Clear description of the problem
- Steps to reproduce
- Error messages
- System information
- What you've already tried

## Common Error Messages Reference

| Error | Likely Cause | Solution |
|-------|--------------|----------|
| `ENOENT` | File not found | Check file path, run npm install |
| `EADDRINUSE` | Port in use | Use different port or kill process |
| `EACCES` | Permission denied | Fix file permissions |
| `SQLITE_BUSY` | Database locked | Close other connections |
| `401 Unauthorized` | Invalid API key | Check .env.local |
| `429 Too Many Requests` | Rate limit | Wait or upgrade tier |
| `404 Model not found` | Invalid model | Update model in code |
| `ECONNREFUSED` | Can't reach API | Check network/firewall |

## Reset and Start Fresh

If all else fails:

```bash
# 1. Stop server (Ctrl+C)

# 2. Clean everything
rm -rf node_modules .next data/accounts.db

# 3. Reinstall
npm install

# 4. Recreate environment
cp .env.example .env.local
# Edit .env.local with your API key

# 5. Start fresh
npm run dev
```

**Warning:** This deletes all research data. Backup first if needed!
