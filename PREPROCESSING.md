# Bulk Account Preprocessing

## Overview

The preprocessing feature allows you to clean and validate large account lists (5000+) before sending them to the main research agent. This saves time and API costs by removing duplicates, inactive companies, and validating company information upfront.

## When to Use Preprocessing

Use the preprocessing agent when:
- You have a very large list (1000+ accounts)
- Your list may contain duplicates
- You're not sure if all companies are still in business
- Domain information is missing or unreliable
- You want to validate company names before expensive research

## How It Works

### 1. Quick Validation Per Company

The preprocessing agent performs a **single quick web search** per company to:
- Verify the company exists
- Find the official domain/website
- Check if the company is still in business
- Confirm correct company name spelling

**Speed**: ~10-15 seconds per company (much faster than full research's 45-75 seconds)

### 2. Duplicate Detection

The system automatically detects and removes duplicates based on:
- Exact domain matches within the uploaded CSV
- Domains that already exist in your research database
- Case-insensitive domain comparison

### 3. Inactive Company Removal

Companies are marked as inactive and removed if:
- They have ceased operations
- They were acquired and no longer operate independently
- Their website is gone
- They are marked as "out of business" or "defunct"

**Note**: If a company was acquired but still operates under the new owner, it's kept as active.

### 4. CSV Output

The system generates a cleaned CSV file with:
- Validated company names
- Validated domains
- Original industry information
- Only active, non-duplicate companies

This CSV can then be uploaded to the main research agent for full processing.

## Usage Guide

### Step 1: Upload CSV

1. Navigate to **Preprocess** in the main navigation
2. Prepare a CSV file with required columns:
   - `company_name` (required)
   - `industry` (required)
   - `domain` (optional - will be validated/found)

Example CSV:
```csv
company_name,domain,industry
Acme Corp,,Technology
TechCo,techco.com,SaaS
```

3. Drag & drop or browse to upload your CSV (max 10,000 rows)

### Step 2: Monitor Progress

The system will:
- Process accounts in parallel (default: 5 concurrent validations)
- Show real-time progress updates
- Display current company being validated
- Track valid, duplicate, inactive, and failed accounts

The progress page auto-refreshes every 3 seconds.

### Step 3: Download Cleaned CSV

Once complete:
1. Review the statistics:
   - **Valid Accounts**: Ready for research
   - **Duplicates**: Removed from output
   - **Inactive**: Companies no longer in business
   - **Failed**: Validation errors (excluded from output)

2. Click **"Download Cleaned CSV"** to get the validated list

3. Upload the cleaned CSV to the main research agent

## Configuration

### Environment Variables

```bash
# Preprocessing uses the same parallel processing config
ENABLE_PARALLEL_PROCESSING=true
PROCESSING_CONCURRENCY=5  # Will process 5 companies at once
```

### API Endpoints

- `POST /api/preprocess/upload` - Upload CSV for preprocessing
- `POST /api/preprocess/start` - Start preprocessing job
- `GET /api/preprocess/jobs/:jobId` - Get job status
- `GET /api/preprocess/jobs` - List all preprocessing jobs
- `GET /api/preprocess/download/:jobId` - Download cleaned CSV

## Database Schema

### preprocessing_jobs Table

Tracks preprocessing job status:
- Job ID, filename, total accounts
- Status (pending, processing, completed, failed)
- Processed, removed, and failed counts
- Current company being processed
- Output CSV filename

### preprocessing_results Table

Stores validation results for each company:
- Original data (company name, domain, industry)
- Validated data (corrected company name, found domain)
- Flags (is_duplicate, is_active, should_include)
- Validation notes

## Performance

### Processing Speed

| Accounts | Time (5 concurrent) | Time (10 concurrent) |
|----------|---------------------|----------------------|
| 100      | ~3-5 min            | ~2-3 min             |
| 500      | ~15-25 min          | ~10-15 min           |
| 1,000    | ~30-50 min          | ~20-30 min           |
| 5,000    | ~3-4 hours          | ~2-2.5 hours         |
| 10,000   | ~6-8 hours          | ~4-5 hours           |

### Cost Savings

If your list has:
- **20% duplicates**: Save 20% on API costs
- **10% inactive**: Save 10% on API costs
- **30% total removed**: Save 30% on full research costs

**Example**: For 5,000 accounts with 30% removed:
- Without preprocessing: 5,000 full researches = ~$200-300 in API costs
- With preprocessing: 3,500 full researches = ~$140-210 in API costs
- **Savings**: ~$60-90 + time saved

## Workflow Comparison

### Without Preprocessing
```
Upload CSV (5000 accounts)
  ↓
Full Research (5000 × 45-75 sec = 62-104 hours)
  ↓
Discover 1500 are duplicates/inactive (wasted ~$120)
  ↓
Manually clean and reprocess
```

### With Preprocessing
```
Upload CSV (5000 accounts)
  ↓
Preprocessing (5000 × 10-15 sec = 14-21 hours)
  ↓
Cleaned CSV (3500 valid accounts)
  ↓
Full Research (3500 × 45-75 sec = 43-73 hours)
  ↓
Clean, quality research data
```

## Best Practices

1. **Always preprocess large lists** (1000+ accounts)
2. **Review the statistics** before downloading to understand what was removed
3. **Check validation notes** for companies marked as inactive
4. **Keep the preprocessed CSV** as a record of what was validated
5. **Re-run preprocessing** if you add more companies to your list later

## Limitations

1. **Single search per company**: Not as thorough as full research
2. **API dependency**: Requires web search API access
3. **False negatives possible**: Some inactive companies might slip through
4. **Domain-only deduplication**: Doesn't catch name variations of the same company

## Troubleshooting

### High failure rate
- Check your OpenAI API key and credits
- Reduce concurrency to avoid rate limits
- Check if company names are properly formatted

### Unexpected removals
- Review validation notes in the database
- Check if domains were incorrectly identified as duplicates
- Verify company names are spelled correctly in input

### Slow processing
- Increase concurrency (up to 10)
- Check OpenAI API rate limits
- Monitor system resources

## Future Enhancements

Potential improvements:
- [ ] Fuzzy matching for company name deduplication
- [ ] Employee count estimation
- [ ] Revenue range detection
- [ ] LinkedIn profile validation
- [ ] Email format detection (for SDR outreach)
- [ ] Geographic headquarters detection
- [ ] Recent news/funding flags
- [ ] Custom validation rules

## Support

For issues or questions:
1. Check the progress page for error details
2. Review validation notes in preprocessing results
3. Check OpenAI API usage for rate limit issues
4. Try reducing concurrency for stability
5. Test with a small batch first (10-20 accounts)
