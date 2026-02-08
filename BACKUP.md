# Backup and Restore Guide

This guide covers backing up and restoring your Auth0 SDR Research Agent database.

## Table of Contents

1. [Database Location](#database-location)
2. [Manual Backup](#manual-backup)
3. [Automated Backup](#automated-backup)
4. [Restore from Backup](#restore-from-backup)
5. [Export Data](#export-data)
6. [Docker Backups](#docker-backups)
7. [Best Practices](#best-practices)

## Database Location

**Standard setup:**
- Path: `data/accounts.db`
- Format: SQLite 3
- Additional files (auto-managed):
  - `data/accounts.db-wal` (Write-Ahead Log)
  - `data/accounts.db-shm` (Shared memory)

**Docker setup:**
- Host: `./data/accounts.db`
- Container: `/app/data/accounts.db`

## Manual Backup

### Quick Backup

**macOS/Linux:**
```bash
# Create backup with timestamp
cp data/accounts.db backups/accounts-$(date +%Y%m%d-%H%M%S).db

# Or simpler version
cp data/accounts.db backups/accounts-backup.db
```

**Windows (Command Prompt):**
```cmd
mkdir backups
copy data\accounts.db backups\accounts-%date:~-4,4%%date:~-10,2%%date:~-7,2%.db
```

**Windows (PowerShell):**
```powershell
New-Item -ItemType Directory -Force -Path backups
Copy-Item data\accounts.db -Destination "backups\accounts-$(Get-Date -Format 'yyyyMMdd-HHmmss').db"
```

### Full Backup (includes WAL files)

**macOS/Linux:**
```bash
# Stop the application first (Ctrl+C)

# Create backup directory
mkdir -p backups/full-$(date +%Y%m%d-%H%M%S)

# Copy all database files
cp data/accounts.db* backups/full-$(date +%Y%m%d-%H%M%S)/

# Restart application
npm run dev
```

**Why stop first?** Ensures database is in consistent state.

### Backup Script

Create `backup.sh`:

```bash
#!/bin/bash

# Configuration
BACKUP_DIR="backups"
RETENTION_DAYS=30

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Create backup with timestamp
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/accounts-$TIMESTAMP.db"

# Copy database
cp data/accounts.db "$BACKUP_FILE"

# Verify backup
if [ -f "$BACKUP_FILE" ]; then
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "✓ Backup created: $BACKUP_FILE ($SIZE)"
else
    echo "✗ Backup failed!"
    exit 1
fi

# Clean old backups (keep last N days)
find "$BACKUP_DIR" -name "accounts-*.db" -mtime +$RETENTION_DAYS -delete
echo "✓ Cleaned backups older than $RETENTION_DAYS days"

# Count remaining backups
COUNT=$(ls -1 "$BACKUP_DIR"/accounts-*.db 2>/dev/null | wc -l)
echo "✓ Total backups: $COUNT"
```

Make executable and run:
```bash
chmod +x backup.sh
./backup.sh
```

## Automated Backup

### Using Cron (macOS/Linux)

**Edit crontab:**
```bash
crontab -e
```

**Add backup schedule:**

```bash
# Daily backup at 2 AM
0 2 * * * cd /path/to/agent-sdr && ./backup.sh

# Every 6 hours
0 */6 * * * cd /path/to/agent-sdr && ./backup.sh

# Every hour
0 * * * * cd /path/to/agent-sdr && ./backup.sh
```

**View scheduled jobs:**
```bash
crontab -l
```

### Using Task Scheduler (Windows)

1. Open Task Scheduler
2. Create Basic Task
3. Name: "Agent SDR Backup"
4. Trigger: Daily at 2:00 AM
5. Action: Start a program
   - Program: `powershell.exe`
   - Arguments: `-File C:\path\to\agent-sdr\backup.ps1`
6. Finish

**Create `backup.ps1`:**
```powershell
$BackupDir = "backups"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupFile = "$BackupDir\accounts-$Timestamp.db"

# Create backup directory
New-Item -ItemType Directory -Force -Path $BackupDir

# Copy database
Copy-Item data\accounts.db -Destination $BackupFile

# Verify
if (Test-Path $BackupFile) {
    $Size = (Get-Item $BackupFile).Length / 1MB
    Write-Host "✓ Backup created: $BackupFile ($([math]::Round($Size, 2)) MB)"
} else {
    Write-Host "✗ Backup failed!"
    exit 1
}

# Clean old backups (keep last 30 days)
Get-ChildItem $BackupDir -Filter "accounts-*.db" |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } |
    Remove-Item

Write-Host "✓ Backup complete"
```

### Cloud Backup

**Upload to Cloud Storage:**

```bash
#!/bin/bash
# backup-to-cloud.sh

# Create local backup
./backup.sh

# Upload to cloud (examples)

# AWS S3
aws s3 cp backups/accounts-latest.db s3://your-bucket/agent-sdr-backups/

# Google Cloud Storage
gsutil cp backups/accounts-latest.db gs://your-bucket/agent-sdr-backups/

# Dropbox (using rclone)
rclone copy backups/accounts-latest.db dropbox:/agent-sdr-backups/

# Azure Blob Storage
az storage blob upload \
    --container-name backups \
    --file backups/accounts-latest.db \
    --name accounts-$(date +%Y%m%d).db
```

## Restore from Backup

### Standard Restore

1. **Stop the application:**
   ```bash
   # Press Ctrl+C in terminal running npm run dev
   ```

2. **Backup current database (just in case):**
   ```bash
   cp data/accounts.db data/accounts-before-restore.db
   ```

3. **Restore from backup:**
   ```bash
   cp backups/accounts-20250208.db data/accounts.db
   ```

4. **Clean WAL files:**
   ```bash
   rm -f data/accounts.db-wal data/accounts.db-shm
   ```

5. **Restart application:**
   ```bash
   npm run dev
   ```

6. **Verify restore:**
   - Open http://localhost:3000
   - Check account count on dashboard
   - Browse accounts to verify data

### Docker Restore

1. **Stop container:**
   ```bash
   docker-compose down
   ```

2. **Restore database:**
   ```bash
   cp backups/accounts-20250208.db data/accounts.db
   ```

3. **Clean WAL files:**
   ```bash
   rm -f data/accounts.db-wal data/accounts.db-shm
   ```

4. **Restart container:**
   ```bash
   docker-compose up -d
   ```

5. **Verify:**
   ```bash
   curl http://localhost:3000/api/health
   ```

## Export Data

### Export to SQL

```bash
# Export entire database
sqlite3 data/accounts.db .dump > export-$(date +%Y%m%d).sql

# Export specific table
sqlite3 data/accounts.db "SELECT * FROM accounts;" > accounts-export.csv

# Export with headers
sqlite3 -header -csv data/accounts.db "SELECT * FROM accounts;" > accounts-export.csv
```

### Export to JSON

```bash
# Using sqlite3 JSON extension
sqlite3 data/accounts.db "SELECT json_group_array(json_object(
    'id', id,
    'company_name', company_name,
    'domain', domain,
    'industry', industry,
    'tier', tier,
    'priority_score', priority_score
)) FROM accounts;" > accounts-export.json
```

### Query Specific Data

```bash
# Export only completed accounts
sqlite3 -header -csv data/accounts.db \
    "SELECT * FROM accounts WHERE research_status = 'completed';" \
    > completed-accounts.csv

# Export high-priority accounts
sqlite3 -header -csv data/accounts.db \
    "SELECT company_name, domain, tier, priority_score, prospects
     FROM accounts
     WHERE priority_score >= 8
     ORDER BY priority_score DESC;" \
    > high-priority-accounts.csv

# Export tier A accounts
sqlite3 -header -csv data/accounts.db \
    "SELECT * FROM accounts WHERE tier = 'A';" \
    > tier-a-accounts.csv
```

## Docker Backups

### Backup from Docker Container

```bash
# Copy database from container to host
docker-compose exec agent-sdr cp /app/data/accounts.db /app/data/backup.db
docker cp agent-sdr:/app/data/backup.db ./backups/accounts-$(date +%Y%m%d).db

# Or directly
docker cp agent-sdr:/app/data/accounts.db ./backups/accounts-$(date +%Y%m%d).db
```

### Automated Docker Backup

Create `docker-backup.sh`:

```bash
#!/bin/bash

BACKUP_DIR="backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
CONTAINER_NAME="agent-sdr-agent-sdr-1"  # Adjust if different

mkdir -p "$BACKUP_DIR"

# Create backup inside container
docker-compose exec -T agent-sdr cp /app/data/accounts.db /app/data/backup-temp.db

# Copy to host
docker cp "$CONTAINER_NAME:/app/data/backup-temp.db" "$BACKUP_DIR/accounts-$TIMESTAMP.db"

# Cleanup temp file
docker-compose exec -T agent-sdr rm /app/data/backup-temp.db

echo "✓ Docker backup created: $BACKUP_DIR/accounts-$TIMESTAMP.db"
```

## Best Practices

### Backup Frequency

**Recommended schedules:**

| Usage Level | Backup Frequency | Retention |
|-------------|------------------|-----------|
| Light (< 50 accounts/week) | Daily | 30 days |
| Medium (50-200 accounts/week) | Every 6 hours | 30 days |
| Heavy (> 200 accounts/week) | Every hour | 60 days |

### Backup Storage

**Where to store backups:**

1. **Local (minimum):**
   - Keep 7-30 days on same machine
   - Different drive if possible

2. **Network (recommended):**
   - NAS or network drive
   - Automated sync
   - 30-90 days retention

3. **Cloud (best):**
   - S3, Google Cloud, Azure, Dropbox
   - Encrypted at rest
   - Long-term retention (1 year+)

4. **3-2-1 Rule (ideal):**
   - 3 copies of data
   - 2 different storage types
   - 1 off-site backup

### Backup Verification

**Test backups regularly:**

```bash
#!/bin/bash
# verify-backup.sh

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "✗ Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Check file size
SIZE=$(stat -f%z "$BACKUP_FILE" 2>/dev/null || stat -c%s "$BACKUP_FILE")
if [ $SIZE -lt 1000 ]; then
    echo "✗ Backup file too small: $SIZE bytes"
    exit 1
fi

# Check database integrity
sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check;" > /tmp/check.txt
if grep -q "ok" /tmp/check.txt; then
    echo "✓ Backup integrity verified: $BACKUP_FILE"
else
    echo "✗ Backup integrity check failed!"
    cat /tmp/check.txt
    exit 1
fi

# Count records
COUNT=$(sqlite3 "$BACKUP_FILE" "SELECT COUNT(*) FROM accounts;")
echo "✓ Backup contains $COUNT accounts"
```

### Before Major Changes

**Always backup before:**
- Upgrading application version
- Running database migrations
- Bulk operations (delete, reprocess)
- Modifying database directly
- System maintenance

```bash
# Quick pre-change backup
cp data/accounts.db backups/before-upgrade-$(date +%Y%m%d).db
```

### Security

**Protect your backups:**

1. **Encrypt sensitive backups:**
   ```bash
   # Encrypt backup
   openssl enc -aes-256-cbc -salt -in backup.db -out backup.db.enc

   # Decrypt backup
   openssl enc -d -aes-256-cbc -in backup.db.enc -out backup.db
   ```

2. **Secure file permissions:**
   ```bash
   chmod 600 backups/*.db
   ```

3. **Don't commit backups to git:**
   - Already in `.gitignore`
   - Never push database files

### Monitoring

**Monitor backup health:**

```bash
#!/bin/bash
# check-backup-health.sh

BACKUP_DIR="backups"
MAX_AGE_HOURS=24

# Find most recent backup
LATEST=$(ls -t "$BACKUP_DIR"/accounts-*.db 2>/dev/null | head -1)

if [ -z "$LATEST" ]; then
    echo "✗ No backups found!"
    exit 1
fi

# Check age
AGE=$(( ($(date +%s) - $(stat -f%m "$LATEST" 2>/dev/null || stat -c%Y "$LATEST")) / 3600 ))

if [ $AGE -gt $MAX_AGE_HOURS ]; then
    echo "⚠ Latest backup is $AGE hours old: $LATEST"
    exit 1
else
    echo "✓ Latest backup is $AGE hours old: $LATEST"
fi

# Check disk space
AVAILABLE=$(df -h data | awk 'NR==2 {print $4}')
echo "✓ Available disk space: $AVAILABLE"
```

## Recovery Scenarios

### Accidental Deletion

1. Stop application immediately
2. Don't make any more changes
3. Restore from most recent backup
4. Verify restored data
5. Resume normal operations

### Database Corruption

1. Try repair first:
   ```bash
   sqlite3 data/accounts.db "PRAGMA integrity_check;"
   ```

2. If unrepairable:
   - Restore from backup
   - May lose recent data since last backup

3. Prevent future corruption:
   - Regular backups
   - Proper shutdown procedures
   - Monitor disk health

### Disaster Recovery

**Full system loss:**

1. Install fresh system (see SETUP_GUIDE.md)
2. Restore database from backup
3. Configure `.env.local`
4. Start application
5. Verify all data present

**Time to recovery:** 15-30 minutes with good backups

## Summary

**Quick Commands:**

```bash
# Manual backup
cp data/accounts.db backups/accounts-$(date +%Y%m%d).db

# Restore backup
docker-compose down  # or Ctrl+C
cp backups/accounts-20250208.db data/accounts.db
rm -f data/accounts.db-wal data/accounts.db-shm
docker-compose up -d  # or npm run dev

# Verify database
sqlite3 data/accounts.db "PRAGMA integrity_check;"

# Export to CSV
sqlite3 -header -csv data/accounts.db "SELECT * FROM accounts;" > export.csv
```

**Remember:**
- Backup before major changes
- Test backups regularly
- Keep multiple backup copies
- Store backups securely
- Document your backup procedures

For setup and configuration, see [SETUP_GUIDE.md](SETUP_GUIDE.md).
