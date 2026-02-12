# Parallel Processing Guide

This guide explains how to use the new parallel processing feature for faster account research.

## Overview

The SDR agent now supports parallel processing, allowing multiple accounts to be researched simultaneously instead of one at a time. This can provide **3-5x speed improvements** for large batches.

### Performance Comparison

| Accounts | Sequential Time | Parallel Time (5 concurrent) | Speed Improvement |
|----------|-----------------|------------------------------|-------------------|
| 10       | ~10 min         | ~3-4 min                     | ~3x faster        |
| 100      | ~100 min        | ~30-40 min                   | ~2.5x faster      |
| 1,000    | ~16-20 hours    | ~5-7 hours                   | ~3x faster        |
| 10,000   | ~166 hours      | ~50-70 hours                 | ~2.5x faster      |

## Configuration

### Environment Variables

Add these to your `.env.local` file:

```bash
# Enable parallel processing (true/false)
ENABLE_PARALLEL_PROCESSING=true

# Number of concurrent accounts (1-10)
# Conservative: 3, Moderate: 5, Aggressive: 8
PROCESSING_CONCURRENCY=5

# Maximum retry attempts for rate limit errors (0-10)
MAX_API_RETRIES=3

# Delay between account batches in milliseconds
ACCOUNT_DELAY_MS=500
```

### Recommended Settings

#### Conservative (Safe Start)
```bash
ENABLE_PARALLEL_PROCESSING=true
PROCESSING_CONCURRENCY=3
MAX_API_RETRIES=3
```

Best for:
- First-time parallel processing users
- OpenAI Tier 1 accounts
- Testing with smaller batches
- When rate limits are a concern

#### Moderate (Recommended)
```bash
ENABLE_PARALLEL_PROCESSING=true
PROCESSING_CONCURRENCY=5
MAX_API_RETRIES=3
```

Best for:
- Most production use cases
- OpenAI Tier 2+ accounts
- Regular batch processing
- Good balance of speed and safety

#### Aggressive (Maximum Speed)
```bash
ENABLE_PARALLEL_PROCESSING=true
PROCESSING_CONCURRENCY=8
MAX_API_RETRIES=3
```

Best for:
- OpenAI Tier 3+ accounts with high limits
- Large batch processing (1000+ accounts)
- When you need maximum speed
- Requires close monitoring

## How It Works

### Architecture

1. **Batch Processing**: Accounts are processed in batches (size = concurrency × 2)
2. **Concurrency Control**: Uses `p-limit` library to enforce max concurrent operations
3. **Error Handling**: Individual account failures don't stop the batch
4. **Retry Logic**: Exponential backoff for rate limit errors (429)
5. **Database Safety**: Transaction support with retry for SQLITE_BUSY errors

### Processing Flow

```
Job Start
    ↓
Get Batch (concurrency × 2)
    ↓
Process in Parallel (max = concurrency)
    ├─→ Account 1: Research → Categorize → Update DB
    ├─→ Account 2: Research → Categorize → Update DB
    ├─→ Account 3: Research → Categorize → Update DB
    ├─→ Account 4: Research → Categorize → Update DB
    └─→ Account 5: Research → Categorize → Update DB
    ↓
Wait for Batch Complete
    ↓
Update Job Progress
    ↓
Delay (500ms)
    ↓
Next Batch (if pending accounts remain)
    ↓
Job Complete
```

## Usage

### Via Web UI

1. Upload your CSV file as usual
2. The system will automatically use the mode specified in `.env.local`
3. Monitor progress on the processing page
4. View results when complete

### Via API

You can override the default settings per job:

```bash
# Start with parallel processing (concurrency = 5)
curl -X POST http://localhost:3000/api/process/start \
  -H "Content-Type: application/json" \
  -d '{"jobId": 123, "mode": "parallel", "concurrency": 5}'

# Start with sequential processing (fallback)
curl -X POST http://localhost:3000/api/process/start \
  -H "Content-Type: application/json" \
  -d '{"jobId": 123, "mode": "sequential"}'
```

### Programmatic Usage

```typescript
import { processJob } from '@/lib/processor';

// Use default mode from config
await processJob(jobId);

// Force parallel mode with custom concurrency
await processJob(jobId, { mode: 'parallel', concurrency: 3 });

// Force sequential mode
await processJob(jobId, { mode: 'sequential' });
```

## Monitoring & Troubleshooting

### Logs

Parallel processing provides enhanced logging:

```
🚀 Starting PARALLEL processing for job 123
   Concurrency: 5 accounts at a time
============================================================

📦 Processing batch of 10 accounts...
[Account 45] Researching: Acme Corp (attempt 1/4)
[Account 46] Researching: TechCo (attempt 1/4)
[Account 47] Researching: DataInc (attempt 1/4)
...

📊 Progress: 5 completed, 0 failed, 95 remaining

✅ Job 123 completed
   Total: 100 accounts
   ✓ Processed: 98
   ✗ Failed: 2
   Success Rate: 98.0%
```

### Common Issues

#### Rate Limit Errors (429)

**Symptoms:**
```
[Account 45] Rate limit hit for Acme Corp. Retrying in 1000ms...
```

**Solutions:**
1. Reduce concurrency: `PROCESSING_CONCURRENCY=3`
2. Increase delay: `ACCOUNT_DELAY_MS=1000`
3. Check OpenAI tier limits
4. Wait for rate limit window to reset

#### Database Lock Errors (SQLITE_BUSY)

**Symptoms:**
```
Error: SQLITE_BUSY: database is locked
```

**Solutions:**
- Built-in retry logic handles this automatically
- If persistent, reduce concurrency
- Database uses WAL mode for better concurrent access

#### Memory Issues

**Symptoms:**
- Node.js out of memory errors
- System slowdown

**Solutions:**
1. Reduce concurrency: `PROCESSING_CONCURRENCY=3`
2. Restart the server periodically for very large batches
3. Process in smaller job batches (e.g., 500 accounts at a time)

### Performance Monitoring

Check OpenAI API usage:
- https://platform.openai.com/usage

Monitor key metrics:
- **TPM (Tokens Per Minute)**: Should stay below tier limit
- **RPM (Requests Per Minute)**: Should stay below tier limit
- **Success Rate**: Should be >95%

## Safety Features

### Built-in Protections

1. **Rate Limit Handling**: Automatic retry with exponential backoff
2. **Database Transactions**: Prevents data corruption from concurrent writes
3. **Error Isolation**: One account failure doesn't affect others
4. **Job Tracking**: Prevents multiple processors on same job
5. **Graceful Degradation**: Falls back to sequential on errors

### Best Practices

1. **Start Conservative**: Use concurrency=3 for first runs
2. **Monitor Closely**: Watch logs for rate limit warnings
3. **Test Small Batches**: Try 10-20 accounts before large batches
4. **Check OpenAI Tier**: Ensure your tier supports your concurrency
5. **Set Reasonable Limits**: Don't exceed concurrency=8 without monitoring

## When to Use Each Mode

### Use Parallel Processing When:
- Processing 50+ accounts
- You have OpenAI Tier 2+ with adequate limits
- Time is a priority
- You can monitor the job
- You've tested with smaller batches

### Use Sequential Processing When:
- Processing <50 accounts
- Debugging specific failures
- Rate limits are frequently hit
- You want maximum reliability
- Running on constrained resources

## Rollback Plan

If you encounter issues, you can instantly disable parallel processing:

```bash
# In .env.local
ENABLE_PARALLEL_PROCESSING=false
```

This reverts to the original sequential processing without code changes.

## Rate Limit Reference

### OpenAI Rate Limits (2026)

| Tier | TPM (Tokens/Min) | RPM (Requests/Min) | Recommended Concurrency |
|------|------------------|--------------------|-----------------------|
| 1    | 500K             | 3,500              | 3                     |
| 2    | 5M               | 3,500              | 5                     |
| 3    | 10M              | 5,000              | 8                     |
| 4    | 80M              | 10,000             | 10+                   |
| 5    | 180M             | 20,000             | 10+                   |

Each account uses approximately:
- **6 research queries**: ~6 requests, ~8K-15K tokens
- **1 categorization**: ~1 request, ~2K-4K tokens
- **Total per account**: ~7 requests, ~10K-19K tokens
- **Processing time**: 45-75 seconds

### Calculating Your Limits

**Example: Tier 2 Account (5M TPM, 3,500 RPM)**

With concurrency = 5:
- Parallel requests: ~35 requests/min (5 × 7)
- Token usage: ~50K-95K tokens/min
- Well within limits ✓

With concurrency = 10:
- Parallel requests: ~70 requests/min
- Token usage: ~100K-190K tokens/min
- Still safe but closer to limits

## Support

If you encounter issues:

1. Check logs for error messages
2. Try reducing concurrency
3. Test with sequential mode
4. Review OpenAI API usage dashboard
5. Check this documentation for troubleshooting

## Future Enhancements

Potential improvements for future versions:

- [ ] Adaptive concurrency based on rate limit feedback
- [ ] Real-time rate limit monitoring dashboard
- [ ] Automatic throttling when approaching limits
- [ ] Progress notifications (email/Slack)
- [ ] Advanced scheduling (time-based processing)
- [ ] Cost tracking and budgeting
- [ ] Multi-region support for higher limits
