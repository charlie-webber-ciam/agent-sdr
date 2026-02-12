# Offline Viewer Export - User Guide

## Overview

The JavaScript + HTML Viewer export option allows you to create a **fully offline, interactive report viewer** that you can distribute to anyone. Recipients only need to open the HTML file in a web browser - no installation, no database, no server required.

## What Gets Exported

When you select "JavaScript + HTML Viewer" format, you'll download **two files**:

1. **`data-YYYY-MM-DD.js`** - Contains all your account data in JavaScript format
2. **`accounts-viewer.html`** - Interactive viewer application

## How to Use

### Step 1: Export Your Data

1. Navigate to the `/accounts` page
2. Apply any filters you want (tier, industry, etc.) or select specific accounts
3. Click the "Export" button
4. Select **"JavaScript + HTML Viewer"** format
5. Choose between "Selected accounts" or "Current view"
6. Click "Export" - both files will download automatically

### Step 2: Share the Files

Place **both files in the same folder**:
```
my-research-reports/
├── data-2024-02-10.js
└── accounts-viewer.html
```

**Important:** The HTML file looks for `data.js`, so you may need to rename your data file:
- From: `data-2024-02-10.js`
- To: `data.js`

### Step 3: Open and View

Simply **double-click `accounts-viewer.html`** - it will open in your default browser and automatically load the data from `data.js`.

## Features

### 🔍 **Search Functionality**
- Search across company names, domains, and industries
- Real-time filtering as you type
- Case-insensitive matching

### 🎯 **Filters**
- **Tier Filter:** Show only Tier A, B, or C accounts
- **Industry Filter:** Filter by specific industries
- Combine filters for precise results

### 📋 **Account List View**
- Grid layout showing all accounts
- Color-coded tier badges
- Priority scores displayed
- Click any card to view full report

### 📊 **Detail View**
- Complete research reports for each account
- Executive summary highlighted at top
- **Markdown rendering:** All research content supports:
  - **Bold text** and *italic text*
  - [Clickable links](https://example.com)
  - Bullet lists and numbered lists
  - Headers and sections
  - `Inline code` formatting
  - > Blockquotes
- All 6 research sections:
  - Current Authentication Solution
  - Customer Base & Growth
  - Security & Compliance
  - Recent News & Funding
  - Tech Transformation Initiatives
  - Key Decision Maker Prospects
- Use cases and recommended Auth0 SKUs
- SDR notes (if any)

### 🖨️ **Print/PDF Export**
- Click "Print / Save PDF" button in detail view
- Browser print dialog appears
- Save as PDF for permanent record
- Print button automatically hidden in PDF output

## Distribution Scenarios

### 1. **Email to Stakeholders**
Zip the two files and email:
```bash
# Create zip file
zip research-package.zip data.js accounts-viewer.html
```

Recipients unzip and open `accounts-viewer.html`

### 2. **USB Drive Distribution**
Copy both files to USB drive for offline presentations

### 3. **Shared Network Drive**
Place files on company network drive for team access

### 4. **Secure File Transfer**
Use your company's secure file transfer service (not suitable for email with sensitive data)

## Technical Details

### Browser Compatibility
Works in all modern browsers:
- ✅ Chrome/Edge (recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Opera

### No Internet Required
Once files are downloaded, **everything works offline**:
- No external JavaScript libraries (markdown parser is built-in)
- No external CSS frameworks
- No API calls
- No tracking or telemetry

### Markdown Support
Research content is automatically rendered with full markdown support:
- Links are clickable and open in new tabs
- Bold and italic text for emphasis
- Bullet and numbered lists for organization
- Headers for section breaks
- Inline code formatting
- Blockquotes for important notes
- Horizontal rules for visual separation

### Security Considerations

**Data is NOT encrypted** in the JavaScript file. Anyone with access to `data.js` can read it.

**Security tips:**
- Don't commit data.js to version control
- Use encrypted zip files for sensitive data
- Use secure file transfer methods
- Set appropriate file permissions on shared drives
- Delete files after viewing if highly confidential

### File Sizes

Approximate sizes per account:
- **CSV:** ~2-3 KB per account
- **JSON:** ~4-5 KB per account
- **JavaScript:** ~4-5 KB per account (same as JSON + wrapper)
- **HTML Viewer:** ~18 KB (one-time, reusable)

**Example:** 100 accounts = ~500 KB total

## Customization

### Renaming Files

The HTML viewer looks for `data.js` by default. If you want to use a different name:

1. Rename your data file (e.g., `my-data.js`)
2. Edit `accounts-viewer.html` line 289:
   ```html
   <!-- Change this line -->
   <script src="data.js"></script>
   <!-- To -->
   <script src="my-data.js"></script>
   ```

### Styling

All CSS is inline in the HTML file. You can customize:
- Colors (search for hex codes like `#3b82f6`)
- Fonts (line 13: `font-family`)
- Layout (grid settings on line 79)

## Troubleshooting

### "Data File Not Found" Error

**Problem:** HTML shows warning about missing data file

**Solution:**
- Ensure `data.js` is in the **same folder** as `accounts-viewer.html`
- Check the filename is exactly `data.js` (case-sensitive on Linux/Mac)
- If renamed, update the script tag in HTML (see Customization section)

### Search Not Working

**Problem:** Typing in search box doesn't filter results

**Solution:**
- Make sure JavaScript is enabled in your browser
- Try refreshing the page (Ctrl/Cmd + R)
- Check browser console for errors (F12 key)

### No Accounts Showing

**Problem:** HTML opens but shows "No accounts found"

**Solution:**
- Clear all filters (use the "All Tiers" and "All Industries" options)
- Clear search box
- Check that data.js actually contains account data (open in text editor)

### Print/PDF Issues

**Problem:** Print button doesn't work or PDF looks wrong

**Solution:**
- Use Chrome or Edge for best PDF results
- In print dialog, choose "Save as PDF" as destination
- Set margins to "Default" or "Minimum"
- Enable "Background graphics" for badges to show

## Data Format

The `data.js` file structure:

```javascript
var MyData = {
  "export_metadata": {
    "export_date": "2024-02-10T15:30:00Z",
    "total_accounts": 25,
    "format_version": "1.0",
    "filters_applied": { ... }
  },
  "accounts": [
    {
      "id": 1,
      "company_name": "Example Corp",
      "domain": "example.com",
      "industry": "Technology",
      "tier": "A",
      "priority_score": 8,
      "estimated_annual_revenue": "$5M-$10M",
      "estimated_user_volume": "100K-500K users",
      "auth0_skus": ["Core", "FGA"],
      "use_cases": ["B2C", "Customer Identity"],
      "research": {
        "summary": "...",
        "current_auth_solution": "...",
        "customer_base_info": "...",
        "security_incidents": "...",
        "news_and_funding": "...",
        "tech_transformation": "..."
      },
      "prospects": [...],
      "timestamps": { ... }
    }
  ]
};
```

## Comparison: Export Formats

| Feature | CSV | JSON | JS + HTML |
|---------|-----|------|-----------|
| **Readable in Excel** | ✅ | ❌ | ❌ |
| **Readable by humans** | ⚠️ Limited | ⚠️ Technical | ✅ Interactive |
| **Search functionality** | ❌ | ❌ | ✅ |
| **Click-through navigation** | ❌ | ❌ | ✅ |
| **Requires software** | Excel/Sheets | Text editor | Web browser |
| **Offline viewing** | ✅ | ✅ | ✅ |
| **Best for** | Analysis | Developers | Stakeholders |

## Tips & Best Practices

### For Presenters
- Export before meetings to ensure offline access
- Practice navigation flow beforehand
- Use search to quickly find specific accounts during discussion
- Print priority accounts to PDF for handouts

### For Distributors
- Include a README.txt with instructions
- Test on recipient's likely browser (e.g., corporate IE/Edge)
- Consider creating a "Top 10" export for executives
- Update exports regularly (weekly/monthly)

### For Analysts
- Export different tiers separately for targeted analysis
- Use industry filters to create vertical-specific reports
- Combine with CSV export for spreadsheet analysis

## Support

For issues or questions:
1. Check this guide's Troubleshooting section
2. Verify both files are in same folder and named correctly
3. Try in a different browser
4. Check browser console (F12) for JavaScript errors

## Version History

**Version 1.0** (2024-02-10)
- Initial release
- Search and filter functionality
- Detail view with full reports
- Print/PDF support
- Fully offline operation
