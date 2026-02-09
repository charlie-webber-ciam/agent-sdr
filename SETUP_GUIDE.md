# Setup Guide

This guide provides step-by-step instructions for setting up the Auth0 SDR Research Agent on your local machine.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Verification](#verification)
5. [First Run](#first-run)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

### 1. Install Node.js

The application requires Node.js version 18.x or 20.x (20.x LTS recommended).

**macOS:**
```bash
# Using Homebrew
brew install node@20

# Or download from nodejs.org
# https://nodejs.org/en/download/
```

**Windows:**
1. Download installer from [nodejs.org](https://nodejs.org/)
2. Run the installer (.msi file)
3. Follow installation wizard
4. Restart terminal/command prompt

**Linux (Ubuntu/Debian):**
```bash
# Using NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

**Verification:**
```bash
node --version
# Should output: v20.x.x (or v18.x.x)

npm --version
# Should output: 9.x.x or higher
```

### 2. Get OpenAI API Key

1. **Create OpenAI Account**
   - Go to [platform.openai.com](https://platform.openai.com/)
   - Sign up or log in

2. **Generate API Key**
   - Navigate to [API Keys](https://platform.openai.com/api-keys)
   - Click "Create new secret key"
   - Give it a name (e.g., "SDR Agent")
   - Copy the key immediately (you won't see it again)
   - Store securely (password manager, secure note)

3. **Verify API Access**
   - Ensure your account has access to GPT-4 or newer models
   - Check usage limits and billing settings
   - Set spending limits if desired

**Key Format:**
- Starts with `sk-proj-` or `sk-`
- Example: `sk-proj-abc123xyz789...`

### 3. Download/Clone Repository

**Option A: Git Clone (if you have access)**
```bash
git clone https://github.com/auth0/agent-sdr.git
cd agent-sdr
```

**Option B: Download ZIP**
1. Download the ZIP archive
2. Extract to desired location
3. Open terminal in extracted folder

## Installation

### 1. Navigate to Project Directory

```bash
cd agent-sdr
# Or wherever you extracted/cloned the project
```

### 2. Install Dependencies

```bash
npm install
```

**What this does:**
- Downloads and installs all required packages (~150MB)
- Compiles native modules (better-sqlite3)
- Sets up project dependencies
- Takes 2-4 minutes depending on internet speed

**Expected output:**
```
added 245 packages, and audited 246 packages in 2m

52 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
```

**Common issues during installation:**

**Issue: "gyp ERR! stack Error: not found: python"**
- Install Python 3.x from [python.org](https://www.python.org/)
- Required for building native modules

**Issue: "Permission denied"**
- macOS/Linux: Don't use `sudo npm install`
- Fix permissions: `sudo chown -R $(whoami) ~/.npm`

**Issue: Network errors**
- Check internet connection
- Try: `npm install --registry=https://registry.npmjs.org/`

## Configuration

### 1. Create Environment File

```bash
# Copy the example file
cp .env.example .env.local
```

**Windows (Command Prompt):**
```cmd
copy .env.example .env.local
```

**Windows (PowerShell):**
```powershell
Copy-Item .env.example .env.local
```

### 2. Edit Environment File

Open `.env.local` in your preferred text editor:

```bash
# macOS
nano .env.local
# or
open -e .env.local

# Linux
nano .env.local
# or
gedit .env.local

# Windows
notepad .env.local
```

### 3. Add Your OpenAI API Key

Replace `your_openai_api_key_here` with your actual API key:

**Before:**
```bash
OPENAI_API_KEY=your_openai_api_key_here
```

**After:**
```bash
OPENAI_API_KEY=sk-proj-abc123xyz789yourrealkeyhere
```

**Important:**
- Remove any spaces before or after the key
- Don't add quotes around the key
- Don't add any extra lines
- Save the file

**Optional: Custom OpenAI Endpoint**

If you're using a custom OpenAI-compatible endpoint:
```bash
OPENAI_BASE_URL=https://your-custom-endpoint.com/v1
```

Otherwise, leave it blank or commented out.

### 4. Verify Environment File

```bash
# Check that .env.local exists
ls -la .env.local

# Verify it contains your key (don't share this output!)
cat .env.local
```

## Verification

Run the setup verification script to check your configuration:

```bash
npm run verify
```

**Expected output:**
```
Auth0 SDR Research Agent - Setup Verification
============================================

✓ Node.js version: v20.11.0 (OK)
✓ npm version: 10.2.4 (OK)
✓ Dependencies installed
✓ Environment file exists (.env.local)
✓ OpenAI API key configured
✓ Data directory exists
✓ Database initialized
✓ All checks passed!

You're ready to start the application with: npm run dev
```

**If any checks fail:**
- See the error message for specific guidance
- Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for solutions
- Review the relevant setup step above

## First Run

### 1. Start Development Server

```bash
npm run dev
```

**Expected output:**
```
> agent-sdr@0.1.0 dev
> next dev

  ▲ Next.js 16.1.6
  - Local:        http://localhost:3000
  - Environments: .env.local

✓ Starting...
✓ Ready in 2.3s
✓ Created data directory
```

**The server is now running!**

### 2. Open Browser

1. Open your web browser
2. Navigate to: **http://localhost:3000**
3. You should see the Auth0 SDR Research Agent dashboard

**Dashboard features:**
- Account statistics (will show 0 initially)
- "Upload New Batch" button
- "Browse All Accounts" button
- Recent jobs list (empty initially)

### 3. Keep Server Running

- Leave the terminal window open
- Don't close the terminal or press Ctrl+C
- You'll see logs as you use the application
- To stop the server: Press `Ctrl+C`

## Testing

### 1. Upload Sample Data

The repository includes a `sample_accounts.csv` file for testing.

**Steps:**
1. Click "Upload New Batch" on the dashboard
2. Drag and drop `sample_accounts.csv` or click to browse
3. Review validation results:
   - Should show 10 accounts
   - All columns present
   - No errors

4. Click "Start Processing"

### 2. Monitor Processing

**You'll be redirected to the processing page:**
- Progress bar showing overall completion
- Current account being processed
- List of all accounts with real-time status updates
- Page auto-refreshes every 3 seconds

**Expected behavior:**
- Status changes: pending → processing → completed
- Takes ~30-60 seconds per account
- Total time: ~5-10 minutes for 10 accounts

**What to watch for:**
- Green checkmarks for completed accounts
- Red X for failed accounts (investigate if this happens)
- Processing should continue even if one account fails

### 3. View Results

**When processing completes:**

1. **Browse Accounts:**
   - Click "View All Accounts" or navigate to /accounts
   - See grid of account cards
   - Test search and filter functions

2. **View Account Details:**
   - Click any account card
   - Review research results:
     - Executive summary
     - Authentication solution
     - Customer base information
     - Security incidents
     - News and funding
     - Tech transformation
     - Key prospects

3. **Test Categorization:**
   - On account detail page, click "Categorize with AI"
   - Review AI suggestions
   - Edit or accept suggestions
   - Save categorization

4. **Test Filtering:**
   - Return to accounts page
   - Try different filters:
     - Search by company name
     - Filter by tier
     - Filter by status
   - Verify results update correctly

## Troubleshooting

### Issue: "Port 3000 already in use"

**Solution 1: Use different port**
```bash
PORT=3001 npm run dev
# Then open http://localhost:3001
```

**Solution 2: Find and stop process using port 3000**

macOS/Linux:
```bash
lsof -ti:3000 | xargs kill -9
```

Windows:
```cmd
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Issue: "Cannot find module 'better-sqlite3'"

**Solution:**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Issue: "OpenAI API key not configured"

**Solution:**
1. Verify `.env.local` exists in project root
2. Check that `OPENAI_API_KEY` is set correctly
3. Ensure no spaces or quotes around the key
4. Restart the development server

### Issue: "Database locked"

**Solution:**
1. Stop the development server (Ctrl+C)
2. Close any SQLite database viewers
3. Delete lock files:
   ```bash
   rm data/accounts.db-wal data/accounts.db-shm
   ```
4. Restart: `npm run dev`

### Issue: "Model not found: gpt-5.2"

**Solution:**
Update the model in the source files:

1. Open `lib/agent-researcher.ts`
2. Find line with `model: 'gpt-5.2'`
3. Change to available model (e.g., `'gpt-4'`, `'gpt-4-turbo'`)
4. Open `lib/categorizer.ts`
5. Make the same change
6. Restart server

### Issue: Processing fails immediately

**Possible causes:**

1. **Invalid API key**
   - Verify key in `.env.local`
   - Test key at [platform.openai.com](https://platform.openai.com/)

2. **API rate limits**
   - Check your OpenAI usage limits
   - Wait and try again
   - Reduce batch size

3. **Network issues**
   - Check internet connection
   - Check firewall settings
   - Try again

### Issue: Slow processing

**Normal behavior:**
- 30-60 seconds per account is expected
- 6 research queries per account
- Sequential processing (one at a time)

**Not normal:**
- If taking 2+ minutes per account, check:
  - Internet connection speed
  - OpenAI API status
  - Server logs for errors

## Next Steps

Once setup is complete:

1. **Upload Your Own Data**
   - Prepare CSV with required columns: company_name, industry
   - Optional columns: domain, auth0_account_owner
   - Maximum 10,000 rows per file
   - Upload and process

2. **Categorize Accounts**
   - Use AI categorization for completed accounts
   - Bulk categorize multiple accounts
   - Set tier, revenue, priority

3. **Explore Features**
   - Advanced filtering
   - Bulk reprocessing
   - Export to PDF (print function)

4. **Production Deployment** (optional)
   - See [DOCKER_SETUP.md](DOCKER_SETUP.md) for Docker deployment
   - See README.md for other deployment options

## Getting Help

If you encounter issues not covered here:

1. Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
2. Check [README.md](README.md) for detailed documentation
3. Review server logs in terminal
4. Check OpenAI API status
5. Create GitHub issue with:
   - Error messages
   - Steps to reproduce
   - System information

## Security Reminders

- Never commit `.env.local` to git
- Keep your OpenAI API key secure
- Set spending limits in OpenAI dashboard
- Backup your database regularly
- Use HTTPS in production

## Success Checklist

- [ ] Node.js 18+ or 20+ installed
- [ ] OpenAI API key obtained
- [ ] Dependencies installed (`npm install`)
- [ ] `.env.local` created and configured
- [ ] Verification passed (`npm run verify`)
- [ ] Server starts successfully (`npm run dev`)
- [ ] Dashboard loads in browser
- [ ] Sample data processes successfully
- [ ] Account details viewable
- [ ] Categorization works

If all items are checked, you're ready to use the application!
