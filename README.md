# Auth0 SDR Research Agent

An autonomous research agent that processes company accounts, conducts comprehensive web research from an Auth0 CIAM perspective, and maintains a searchable database of account profiles for Sales Development Representatives.

## Overview

This application automates the time-consuming research phase of SDR prospecting by:
- Processing CSV files with up to 500 company accounts per batch
- Conducting 6 AI-powered research queries per company
- Extracting authentication solutions, customer data, security compliance, and key decision-makers
- Categorizing accounts by tier (A/B/C) and priority score
- Storing structured data in a local SQLite database

## Features

- **Automated Research**: Deep web research using OpenAI's Agent SDK with web search
- **AI Categorization**: Automatic tier assignment (A/B/C) and priority scoring (1-10)
- **Account Profiles**: Complete profiles with auth solutions, customer base, prospects, and more
- **Advanced Filtering**: Search by company, filter by tier/SKU/priority, sort by multiple criteria
- **Bulk Operations**: Reprocess failed accounts, categorize multiple accounts at once
- **Export Ready**: Print-friendly detailed reports for each account

## System Requirements

- **Node.js**: Version 18.x or 20.x (recommended: 20.x LTS)
- **npm**: Version 9.x or higher (comes with Node.js)
- **Disk Space**: 500MB minimum (for dependencies and database)
- **OpenAI API**: Valid API key with access to GPT-4 or newer models
- **Operating System**: macOS, Linux, or Windows

## Quick Start

### Option 1: Standard Node.js Setup (Recommended for Development)

```bash
# 1. Clone or download this repository
git clone <repository-url>
cd agent-sdr

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local and add your OpenAI API key

# 4. Verify setup (optional but recommended)
npm run verify

# 5. Start the development server
npm run dev

# 6. Open browser
# Navigate to http://localhost:3000
```

### Option 2: Docker Setup (Recommended for Production)

```bash
# 1. Clone or download this repository
git clone <repository-url>
cd agent-sdr

# 2. Configure environment
cp .env.example .env
# Edit .env and add your OpenAI API key

# 3. Start with Docker Compose
docker-compose up -d

# 4. Open browser
# Navigate to http://localhost:3000

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

See [DOCKER_SETUP.md](DOCKER_SETUP.md) for detailed Docker instructions.

## Detailed Setup

For step-by-step instructions with troubleshooting, see [SETUP_GUIDE.md](SETUP_GUIDE.md).

### 1. Prerequisites

**Install Node.js:**
- Download from [nodejs.org](https://nodejs.org/)
- Verify installation: `node --version` (should show v18.x or v20.x)

**Get OpenAI API Key:**
1. Create account at [platform.openai.com](https://platform.openai.com/)
2. Navigate to API Keys section
3. Create new secret key
4. Copy and save securely (you won't see it again)

### 2. Installation

```bash
# Clone repository
git clone <repository-url>
cd agent-sdr

# Install dependencies (takes 2-3 minutes)
npm install
```

### 3. Configuration

```bash
# Create environment file
cp .env.example .env.local

# Edit .env.local with your favorite editor
nano .env.local
# or
code .env.local
```

Add your OpenAI API key:
```bash
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxx
```

### 4. First Run

```bash
# Start development server
npm run dev
```

You should see:
```
> agent-sdr@0.1.0 dev
> next dev

  ▲ Next.js 16.1.6
  - Local:        http://localhost:3000

✓ Starting...
✓ Ready in 2.3s
```

### 5. Test with Sample Data

1. Open browser to http://localhost:3000
2. Click "Upload New Batch"
3. Upload the included `sample_accounts.csv` file
4. Click "Start Processing"
5. Monitor progress (takes ~5 minutes for 10 accounts)

## Usage Guide

### Uploading Accounts

**CSV Format Requirements:**
- Required columns: `company_name`, `industry`
- Optional columns: `domain`, `auth0_account_owner`
- Maximum 500 rows per file
- UTF-8 encoding
- Header row required

Example:
```csv
company_name,domain,industry,auth0_account_owner
Acme Corp,acme.com,SaaS,John Smith
Tech Startup,techstartup.io,Technology,Sarah Johnson
Private Company,,Financial Services,Mike Davis
```

Note: Domain is optional - leave blank if not available. Accounts without domains will be assigned a unique placeholder for database purposes, but will display as "No domain" in the UI.

**Duplicate Handling:**
- CSV duplicates (same domain appears multiple times in uploaded file): Automatically removed, keeping first occurrence
- Database duplicates (domain already exists in database): Automatically skipped
- Upload continues with all valid, non-duplicate accounts
- Detailed summary shows counts of each type of duplicate removed

**Upload Process:**
1. Navigate to Upload page
2. Drag and drop CSV or click to browse
3. Review validation results
4. Confirm to create processing job

### Processing Accounts

**How it works:**
- Sequential processing (one account at a time)
- 6 research queries per account
- Average: 30-60 seconds per account
- Automatic retry on transient failures

**Monitoring Progress:**
- Real-time progress bar
- Current account display
- Status for each account (pending → processing → completed/failed)
- Auto-refresh every 3 seconds

### Categorizing Accounts

After research completes, categorize accounts:

1. Navigate to account detail page
2. Click "Categorize with AI"
3. Review AI suggestions:
   - Tier (A/B/C)
   - Revenue estimate
   - User volume
   - Recommended Auth0 SKUs
   - Priority score (1-10)
4. Edit or accept suggestions
5. Save categorization

**Bulk Categorization:**
1. Go to Accounts page
2. Filter/search to find accounts
3. Select accounts to categorize
4. Click "Categorize Selected"
5. AI processes all selected accounts

### Filtering and Searching

**Available Filters:**
- **Search**: Company name or domain (partial match)
- **Tier**: A (high value), B (medium value), C (lower value), Unassigned
- **SKU**: Core, FGA (Fine-Grained Authorization), Auth for AI
- **Use Case**: B2C, B2B, B2E, Multi-tenant, Enterprise SSO
- **Priority**: Minimum priority score (1-10)
- **Revenue**: Revenue range text
- **Status**: Pending, Processing, Completed, Failed
- **Industry**: As imported from CSV

**Sorting Options:**
- Priority Score (default, highest first)
- Recently Processed
- Company Name
- Tier
- Created Date

### Bulk Operations

**Reprocess Failed Accounts:**
1. Filter by status: "Failed"
2. Click "Select All"
3. Click "Retry Selected"
4. Accounts reset to pending and added to new processing job

**Bulk Categorization:**
- Select multiple completed accounts
- Click "Categorize Selected"
- AI categorizes all at once

**Bulk Delete:**
- Select accounts to remove
- Click "Delete Selected"
- Confirm deletion (cannot be undone)

### Viewing Account Details

Each completed account profile includes:
- **Executive Summary**: AI-generated overview
- **Authentication Solution**: Current auth provider and implementation
- **Customer Base**: Size, growth trajectory, user types
- **Security & Compliance**: Incidents, certifications, requirements
- **News & Funding**: Recent developments, financial status
- **Tech Transformation**: Modernization initiatives, tech stack
- **Key Prospects**: Decision-makers with titles and LinkedIn profiles
- **SDR Metadata**: Tier, revenue, priority, recommended SKUs, notes

**Export Options:**
- Print button for PDF generation (browser print dialog)
- Data stored in SQLite database (see BACKUP.md)

## Available Commands

```bash
# Development
npm run dev          # Start development server (hot reload)
npm run build        # Build for production
npm start            # Start production server (after build)

# Utilities
npm run verify       # Check setup and configuration
npm run lint         # Run code linter
npm run clean        # Clean build artifacts and temp files
npm run reset-db     # Delete database (will be recreated on next start)
```

## Project Structure

```
agent-sdr/
├── app/                          # Next.js App Router pages
│   ├── page.tsx                 # Dashboard (home)
│   ├── upload/page.tsx          # CSV upload
│   ├── processing/[jobId]/      # Processing monitor
│   ├── accounts/                # Account browser and details
│   └── api/                     # Backend API routes
├── components/                   # React components
│   ├── Navigation.tsx           # Top nav bar
│   ├── SearchBar.tsx            # Search/filter component
│   └── AccountCard.tsx          # Account preview card
├── lib/                         # Backend logic
│   ├── db.ts                    # Database operations
│   ├── schema.sql               # Database schema
│   ├── migrate.ts               # Auto-migrations
│   ├── agent-researcher.ts      # AI research agent
│   ├── categorizer.ts           # AI categorization
│   └── processor.ts             # Background processing
├── data/                        # Database storage (git-ignored)
│   └── accounts.db              # SQLite database
├── .env.local                   # Environment variables (git-ignored)
└── README.md                    # This file
```

## Configuration

### Environment Variables

**Required:**
- `OPENAI_API_KEY`: Your OpenAI API key (starts with `sk-`)

**Optional:**
- `OPENAI_BASE_URL`: Custom API endpoint (leave blank for default)
- `PORT`: Server port (default: 3000)

### Model Configuration

The application uses `gpt-5.2` model by default. If you need to change this:

1. Edit `lib/agent-researcher.ts` (line ~20)
2. Edit `lib/categorizer.ts` (line ~15)
3. Update to your available model (e.g., `gpt-4`, `gpt-4-turbo`, `gpt-3.5-turbo`)

## Data Management

### Database Location
- Path: `data/accounts.db`
- Format: SQLite 3
- Automatically created on first run
- Includes auto-migration system

### Backup
```bash
# Manual backup
cp data/accounts.db backups/accounts-$(date +%Y%m%d).db

# Restore backup
cp backups/accounts-20250208.db data/accounts.db
```

See [BACKUP.md](BACKUP.md) for detailed backup/restore instructions.

### Reset Database
```bash
npm run reset-db
# Database will be recreated with fresh schema on next start
```

## Troubleshooting

### Common Issues

**"Cannot find module 'better-sqlite3'"**
- Run: `npm install`

**"Invalid API key"**
- Check `.env.local` file exists
- Verify key format (starts with `sk-`)
- Ensure no extra spaces or quotes

**"Port 3000 already in use"**
- Change port: `PORT=3001 npm run dev`
- Or stop other process using port 3000

**"Model not found: gpt-5.2"**
- Update model in `lib/agent-researcher.ts` and `lib/categorizer.ts`
- Use model available in your OpenAI account

**Accounts stuck in "processing"**
- Check OpenAI API rate limits
- Restart server: Ctrl+C then `npm run dev`
- Check logs for errors

**Database locked error**
- Ensure only one server instance is running
- Close any database viewers (DB Browser for SQLite, etc.)
- Restart server

For more troubleshooting help, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

## Production Deployment

### Option 1: Docker (Recommended)

See [DOCKER_SETUP.md](DOCKER_SETUP.md) for complete instructions.

### Option 2: Traditional Hosting (VPS, Cloud VM)

```bash
# Build production bundle
npm run build

# Start production server
npm start

# Or use PM2 for process management
npm install -g pm2
pm2 start npm --name "agent-sdr" -- start
pm2 save
pm2 startup
```

### Option 3: Platform-as-a-Service

**Vercel/Netlify:**
- These platforms don't support SQLite in production
- Consider PostgreSQL adapter or use Docker deployment instead

**Railway/Render:**
- Connect GitHub repository
- Set environment variables in dashboard
- Add persistent volume for `data/` directory
- Deploy from main branch

## Performance Notes

- **Sequential Processing**: Designed to process one account at a time to avoid OpenAI rate limits and maintain quality research
- **Expected Speed**: 30-60 seconds per account (6 research queries + processing)
- **Batch Size**: Up to 500 accounts per CSV (takes ~4-8 hours)
- **Memory Usage**: ~200-300MB during processing (normal for AI operations)

## Security Considerations

- Keep `.env.local` private (never commit to git)
- Secure your OpenAI API key
- Set spending limits in OpenAI dashboard
- Regularly backup database
- Don't expose database file publicly
- Use HTTPS in production

## Support

For issues, questions, or feedback:
- Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- Review [SETUP_GUIDE.md](SETUP_GUIDE.md)
- Check existing GitHub issues
- Create new issue with:
  - Node.js version (`node --version`)
  - Operating system
  - Error messages
  - Steps to reproduce

## License

Proprietary - Internal Auth0 use only. See [LICENSE](LICENSE) for details.

## Version

Current version: 0.1.0

Built with:
- Next.js 16.1.6
- React 19
- OpenAI Agents SDK 0.4.6
- TypeScript 5
- SQLite (better-sqlite3)
