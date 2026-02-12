# Quick Research Feature

## Overview

The Quick Research feature allows you to research a **single account on-demand** without uploading a CSV file. Perfect for ad-hoc research requests or when you need to quickly investigate a specific company.

## How to Use

### Method 1: From Dashboard
1. Click the **"Quick Research"** card (⚡ lightning icon)
2. Fill in the form
3. Click "Start Research"

### Method 2: From Navigation
1. Click **"Quick Research"** in the top navigation bar
2. Fill in the form
3. Click "Start Research"

### Method 3: Direct URL
Navigate to: `http://localhost:3000/quick-research`

## Form Fields

### Company Name (Required)
- The official name of the company
- Examples: "Salesforce", "Atlassian", "Canva"
- Used as the primary identifier for research

### Domain (Optional)
- Company website domain
- Examples: "salesforce.com", "atlassian.com", "canva.com"
- Improves research accuracy but not required
- If omitted, research relies on company name only

### Industry (Required)
- Select from dropdown list of common industries
- Used for categorization and context
- Options include:
  - Technology
  - Financial Services
  - Healthcare
  - E-commerce
  - SaaS
  - Gaming
  - Media & Entertainment
  - Education
  - And more...

## What Happens

### Step 1: Immediate Response
- Form submits and you're redirected to the account detail page
- Account is created in your database
- Research starts in the background

### Step 2: Research Process (45-75 seconds)
The AI agent conducts 6 separate research queries:
1. **Current authentication solution** - What they currently use
2. **Customer base & growth** - Scale and user metrics
3. **Security & compliance** - Incidents and requirements
4. **Recent news & funding** - Company updates and financial info
5. **Tech transformation** - Digital initiatives and modernization
6. **Key prospects** - Decision-makers to target

### Step 3: Auto-Categorization
After research completes, the account is automatically:
- Assigned a tier (A/B/C)
- Estimated ARR calculated
- User volume estimated
- Use cases identified
- Auth0 SKUs recommended
- Priority score assigned (1-10)

### Step 4: View Results
- Results appear on the account detail page in real-time
- All research sections populate as they complete
- Account is saved to database for future reference

## Use Cases

### 1. Inbound Lead Research
When a lead comes in via web form or sales inquiry:
- Enter company name and domain
- Get instant intelligence
- Respond with relevant information

### 2. Meeting Preparation
Before a discovery call:
- Quick research on the prospect
- Review their current solution
- Identify pain points and opportunities

### 3. Competitive Intelligence
Research competitor customers:
- Understand their authentication setup
- Identify switching opportunities
- Prepare targeted messaging

### 4. Account Planning
When assigned a new territory:
- Research key accounts individually
- Build account profiles one-by-one
- Prioritize outreach strategy

### 5. Executive Requests
When leadership asks about a specific company:
- Instant research in under 2 minutes
- Professional report ready to share
- Can export to PDF immediately

## Advantages vs CSV Upload

| Aspect | CSV Upload | Quick Research |
|--------|-----------|----------------|
| **Setup** | Prepare CSV file | Just type company name |
| **Speed to start** | ~2-3 minutes | ~10 seconds |
| **Best for** | Bulk research (10+ accounts) | Single account |
| **Use case** | Regular SDR workflow | Ad-hoc requests |
| **Effort** | More upfront work | Minimal effort |

## Technical Details

### Database Storage
- Account is created with a special job marked "Quick Research"
- Stored permanently in your database
- Can be categorized, edited, exported like any other account
- Appears in account browser with all other accounts

### Research Quality
- **Identical quality** to CSV upload research
- Same 6 research queries
- Same categorization logic
- Same AI agent and prompts

### Performance
- Research runs asynchronously (doesn't block the UI)
- Results appear in real-time as each section completes
- Page auto-refreshes to show updates
- No polling or manual refresh needed

### Error Handling
- Form validation for required fields
- Clear error messages
- Failed research shows error on account page
- Can retry individual accounts via account browser

## Tips & Best Practices

### For Best Results
- ✅ **Provide domain when possible** - Improves research accuracy
- ✅ **Use official company name** - Avoid abbreviations
- ✅ **Select accurate industry** - Affects categorization quality
- ✅ **Check for duplicates first** - Search accounts browser before creating

### Common Scenarios

**Scenario 1: Domain Unknown**
```
Company Name: "Atlassian"
Domain: [leave empty]
Industry: "Technology"
```
→ Research works but may be less specific

**Scenario 2: Full Information**
```
Company Name: "Atlassian Corporation"
Domain: "atlassian.com"
Industry: "Technology"
```
→ Most accurate research possible

**Scenario 3: Startup**
```
Company Name: "Example Startup"
Domain: "examplestartup.io"
Industry: "SaaS"
```
→ Research adapts to company size

## Workflow Integration

### SDR Daily Workflow
1. **Morning:** Review inbound leads from overnight
2. **For each lead:** Quick research via form
3. **During research:** Continue other work
4. **When complete:** Review and prioritize
5. **Outreach:** Use research for personalized messaging

### Territory Planning
1. **Build target list:** Use CSV for bulk research
2. **Ad-hoc additions:** Quick research for individual companies
3. **Prioritization:** Categorization helps rank opportunities
4. **Export:** Share researched accounts with team

### Competitive Analysis
1. **Identify competitor customers** from news/case studies
2. **Quick research each one** to understand their setup
3. **Build switching strategy** based on pain points
4. **Track in database** for long-term opportunity

## Limitations

### Not Suitable For:
- ❌ **Bulk research** - Use CSV upload for 10+ accounts
- ❌ **Automated workflows** - Use API or CSV for automation
- ❌ **List building** - Use preprocess feature for large lists

### Suitable For:
- ✅ **Single account research** - Perfect use case
- ✅ **Urgent requests** - Get results in under 2 minutes
- ✅ **Ad-hoc investigations** - No CSV needed
- ✅ **Meeting prep** - Quick intelligence gathering

## API Endpoint

For programmatic access:

**Endpoint:** `POST /api/quick-research`

**Request Body:**
```json
{
  "companyName": "Atlassian Corporation",
  "domain": "atlassian.com",
  "industry": "Technology"
}
```

**Response:**
```json
{
  "accountId": 123,
  "message": "Research started. You will be redirected to view progress."
}
```

**Error Response:**
```json
{
  "error": "Company name and industry are required"
}
```

## Related Features

- **CSV Upload** (`/upload`) - Bulk research for multiple accounts
- **Account Browser** (`/accounts`) - View all researched accounts
- **Bulk Categorize** (`/categorize`) - Categorize existing accounts
- **Preprocessing** (`/preprocess`) - Validate large lists before research

## Troubleshooting

### Research Fails
**Problem:** Account shows "failed" status

**Solution:**
- Check OpenAI API key is valid
- Verify internet connection for web search
- Check company name is correct
- Try again with domain included

### Research Takes Too Long
**Problem:** Still processing after 5 minutes

**Solution:**
- Each research query can take 10-15 seconds
- Total time: 45-75 seconds is normal
- Be patient - refresh page to check status
- If > 5 minutes, check server logs

### Duplicate Account
**Problem:** Company already exists in database

**Solution:**
- Check account browser first before creating
- If duplicate needed, contact support
- Can't currently prevent duplicates in quick research

### Wrong Industry Selected
**Problem:** Accidentally selected wrong industry

**Solution:**
- Navigate to account detail page after research completes
- Industry field is not currently editable
- Can add SDR notes to clarify
- Re-categorize if needed (tier/SKU still accurate)

## Future Enhancements

Possible improvements (not yet implemented):
- Duplicate detection before creating account
- Edit industry after creation
- Batch quick research (5-10 accounts)
- Save common companies as templates
- Quick research from Chrome extension
- Slack bot integration for quick research
- Email-to-research (forward email, get research)

## Summary

Quick Research provides a **fast, simple way** to research individual accounts without the overhead of CSV uploads. Perfect for:
- 🎯 Inbound leads
- 📞 Meeting preparation
- 🔍 Competitive intelligence
- ⚡ Urgent executive requests

**Research Quality:** Same as CSV upload
**Time to Results:** Under 2 minutes
**Effort Required:** Minimal (3 form fields)
**Database Storage:** Yes (permanent)
**Categorization:** Automatic

---

**Status:** ✅ Fully implemented
**Location:** `/quick-research` page
**API:** `POST /api/quick-research`
**Navigation:** Dashboard card + top nav link
