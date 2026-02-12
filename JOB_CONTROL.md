# Job Control - Pause, Resume, Cancel & Delete

## Overview

All processing jobs (both full research and preprocessing) now support pause, resume, cancel, and delete operations. This gives you full control over long-running batch processes.

## Features

### Pause
- **What it does**: Temporarily stops processing without losing progress
- **When to use**: When you need to free up resources or temporarily halt processing
- **How it works**: Current accounts finish processing, then the job waits in paused state
- **Data safety**: All progress is saved, accounts remain in their current state

### Resume
- **What it does**: Continues processing from where it was paused
- **When to use**: After pausing a job and you're ready to continue
- **How it works**: Picks up from the next pending account
- **Data safety**: No data loss, seamless continuation

### Cancel
- **What it does**: Stops processing and marks the job as failed/cancelled
- **When to use**: When you want to permanently stop a job
- **How it works**: Current accounts may finish, then job is marked cancelled
- **Data safety**: Completed accounts are saved; in-progress accounts reset to pending
- **Warning**: Cannot be resumed after cancelling

### Delete
- **What it does**: Permanently removes the job and all associated data
- **When to use**: Clean up completed/failed jobs you no longer need
- **How it works**: Deletes job and all associated accounts (full research) or results (preprocessing)
- **Data safety**: PERMANENT - cannot be undone
- **Warning**: Requires confirmation before deletion

## User Interface

### Status Indicators

**Processing Page:**
- 🔄 **Processing** - Job is actively processing (blue background)
- ⏸️ **Paused** - Job is paused (yellow background)
- ✅ **Completed** - Job finished successfully (green background)
- ❌ **Failed/Cancelled** - Job failed or was cancelled (red background)

### Control Buttons

**While Processing:**
- ⏸️ **Pause** - Pause the job (yellow button)
- ✖️ **Cancel** - Cancel the job (red button)

**While Paused:**
- ▶️ **Resume** - Resume processing (green button)
- ✖️ **Cancel** - Cancel the job (red button)

**After Complete/Failed:**
- 🗑️ **Delete Job** - Permanently delete (gray button)

### Button Locations

**Full Research:** `/processing/[jobId]` page
- Controls shown in the status banner at the top
- Next to "View All Accounts" button when completed

**Preprocessing:** `/preprocess/progress/[jobId]` page
- Controls shown below the status badge
- Centered on the page

## Technical Details

### Database

**New Column**: `paused` (INTEGER, defaults to 0)
- Added to `processing_jobs` table
- Added to `preprocessing_jobs` table
- 0 = not paused, 1 = paused

### API Endpoints

#### Full Research Jobs
- `POST /api/process/[jobId]/pause` - Pause job
- `POST /api/process/[jobId]/resume` - Resume job
- `POST /api/process/[jobId]/cancel` - Cancel job
- `DELETE /api/process/[jobId]/delete` - Delete job

#### Preprocessing Jobs
- `POST /api/preprocess/jobs/[jobId]/pause` - Pause job
- `POST /api/preprocess/jobs/[jobId]/resume` - Resume job
- `POST /api/preprocess/jobs/[jobId]/cancel` - Cancel job
- `DELETE /api/preprocess/jobs/[jobId]/delete` - Delete job

### Processing Logic

**Pause Behavior:**
1. User clicks Pause button
2. API sets `paused = 1` in database
3. Processor checks pause state every iteration
4. When paused detected, processor waits (checks every 3 seconds)
5. Current batch finishes before pause takes effect (parallel mode)

**Resume Behavior:**
1. User clicks Resume button
2. API sets `paused = 0` in database
3. Processor detects resume on next check
4. Processing continues from next pending account

**Cancel Behavior:**
1. User clicks Cancel button (requires confirmation)
2. API sets job status to 'failed'
3. API resets any in-progress accounts to 'pending' (full research only)
4. Processor detects cancelled status and exits
5. Job cannot be resumed

**Delete Behavior:**
1. User clicks Delete button (requires confirmation)
2. For full research: Deletes all associated accounts
3. For preprocessing: Deletes all associated results
4. Deletes the job record
5. User redirected to dashboard

## Usage Examples

### Scenario 1: Need to Free Up Resources

```
1. Job is processing 1000 accounts
2. You need to run something else
3. Click "Pause" button
4. Current batch finishes (5-10 accounts)
5. Job shows as "⏸️ Paused"
6. When ready, click "Resume"
7. Processing continues seamlessly
```

### Scenario 2: Wrong File Uploaded

```
1. Job starts processing
2. You realize it's the wrong file
3. Click "Cancel" button
4. Confirm the action
5. Job stops and marks as failed
6. Click "Delete Job" to remove it
7. Upload correct file
```

### Scenario 3: Clean Up Old Jobs

```
1. Go to completed or failed job page
2. Click "🗑️ Delete Job" button
3. Confirm deletion
4. Job and all data permanently removed
5. Redirected to dashboard
```

## Best Practices

### When to Pause
- Free up API rate limits for other tasks
- Temporarily pause during maintenance
- Review progress before continuing
- Investigate issues without losing progress

### When to Cancel
- Wrong file uploaded
- Discovered duplicate job
- Requirements changed
- Job stuck or behaving unexpectedly

### When to Delete
- Job completed and data is processed
- Old test jobs no longer needed
- Failed jobs you won't retry
- Free up database space

### When NOT to Delete
- Job is still processing (pause or cancel first)
- You might need to reference the data later
- Unsure if data was properly extracted

## Safety Features

1. **Confirmation Prompts**: Cancel and Delete require confirmation
2. **Status Checks**: Processors constantly check for pause/cancel
3. **Data Integrity**: Completed accounts are never lost
4. **Graceful Shutdown**: Current operations complete before stopping
5. **UI Feedback**: Loading states prevent duplicate actions

## Limitations

1. **Not Instant**: Pause/cancel takes effect after current batch completes
2. **No Undo**: Cancel and delete are permanent
3. **Active Processing**: Can't delete a currently processing job (must cancel first)
4. **Parallel Mode**: In parallel processing, all currently running accounts complete before pause takes effect

## Monitoring

**What Happens When Paused:**
- Job status remains "processing"
- `paused` flag set to 1
- Processor enters wait loop (checks every 3 seconds)
- No accounts actively being processed
- Progress page still shows current state
- Auto-refresh continues (updates every 3 seconds)

**What Happens When Cancelled:**
- Job status changes to "failed"
- In-progress accounts reset to "pending" (full research)
- Processor exits cleanly
- Job cannot be resumed
- Can be deleted

## Troubleshooting

### Job Won't Pause
- Wait for current batch to complete (5-15 seconds)
- Check browser console for errors
- Refresh the page and try again

### Job Won't Resume
- Check if job was cancelled instead of paused
- Verify there are pending accounts remaining
- Check server logs for errors

### Delete Button Not Showing
- Delete only available for completed/failed jobs
- Cannot delete while processing (pause or cancel first)
- Refresh page to update status

### Lost Progress After Cancel
- This is expected behavior
- Completed accounts are saved
- In-progress accounts reset to pending
- Use Pause if you want to preserve exact state

## Future Enhancements

Potential improvements:
- [ ] Scheduled pause/resume (time-based)
- [ ] Email notifications when paused
- [ ] Auto-pause on rate limit detection
- [ ] Batch delete multiple jobs
- [ ] Export job data before deletion
- [ ] Job archiving instead of deletion
- [ ] Pause/resume from dashboard
- [ ] Keyboard shortcuts for controls

## Support

For issues:
1. Check job status on progress page
2. Try refreshing the page
3. Check server logs for errors
4. Cancel and restart if stuck
5. Report persistent issues

---

**Version**: 1.0
**Last Updated**: 2026-02-09
