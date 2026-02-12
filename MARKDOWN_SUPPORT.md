# Markdown Support in Offline Viewer

The HTML viewer includes a built-in markdown parser that automatically formats all research content. This means AI-generated research with markdown formatting will display beautifully in the offline viewer.

## Supported Markdown Syntax

### Links
```markdown
[Visit Auth0](https://auth0.com)
[Company Website](https://example.com)
```
**Result:** Clickable links that open in new tabs

---

### Bold Text
```markdown
**Important finding**
__Another bold text__
```
**Result:** **Bold text** for emphasis

---

### Italic Text
```markdown
*Emphasis here*
_Another italic text_
```
**Result:** *Italic text* for subtle emphasis

---

### Headers
```markdown
# Main Header
## Subheader
### Sub-subheader
```
**Result:** Hierarchical section headers

---

### Lists - Unordered
```markdown
- First item
- Second item
- Third item
```
**Result:**
- Formatted bullet list
- With proper indentation
- And spacing

---

### Lists - Ordered
```markdown
1. First step
2. Second step
3. Third step
```
**Result:**
1. Numbered list
2. With sequential numbering
3. And proper formatting

---

### Inline Code
```markdown
The company uses `OAuth 2.0` for authentication.
```
**Result:** Highlighted `code` with monospace font

---

### Blockquotes
```markdown
> This is a key insight from the research.
```
**Result:** Indented quote with left border

---

### Horizontal Rules
```markdown
---
***
___
```
**Result:** Visual separator between sections

---

## Example Research Content

Here's how markdown-formatted research content looks in the viewer:

### Input (Markdown)
```markdown
## Current Authentication Solution

**Key Finding:** The company currently uses Auth0's competitor Okta for authentication.

### Pain Points Identified:
- High licensing costs (estimated **$50K/year**)
- Limited customization options
- Poor developer experience

**Source:** [Company Tech Blog](https://example.com/blog)

> "We're evaluating alternatives due to rising costs" - CTO Quote

---

## Next Steps
1. Schedule discovery call
2. Present Auth0 pricing comparison
3. Demo customization capabilities
```

### Output (Rendered HTML)
The viewer will display this with:
- Clickable blog link
- Bold emphasis on key numbers
- Formatted bullet list
- Proper quote styling
- Sequential numbered steps
- Section separation

---

## Benefits for AI-Generated Content

When your AI research agent includes markdown in its output:
1. **URLs are automatically clickable** - No need to copy/paste
2. **Key findings stand out** - Bold text draws attention
3. **Lists are organized** - Easy to scan bullet points
4. **Structure is clear** - Headers create visual hierarchy
5. **Sources are linked** - Direct access to referenced materials

## Best Practices

When generating research content with AI:

### Use Links for Sources
```markdown
According to [TechCrunch](https://techcrunch.com/article), the company raised $50M.
```

### Highlight Key Numbers
```markdown
The company has **10,000+ customers** and is growing at **200% YoY**.
```

### Organize with Lists
```markdown
### Top 3 Buying Signals:
1. Recent $20M Series B funding
2. Job posting for "Head of Identity"
3. Migration from legacy system mentioned in blog
```

### Structure with Headers
```markdown
## Financial Overview
### Revenue Growth
### Funding History

## Technical Stack
### Current Authentication
### Identity Requirements
```

### Quote Important Insights
```markdown
> "We need a more scalable identity solution" - CTO interview, Dec 2023
```

---

## Technical Implementation

The markdown parser is:
- **Self-contained:** No external libraries required
- **Lightweight:** Adds only ~2KB to viewer file
- **Fast:** Client-side rendering with regex-based parsing
- **Safe:** HTML is escaped to prevent XSS attacks
- **Offline:** Works without internet connection

### Parsing Order
1. Escape HTML entities (prevent XSS)
2. Convert headers (H1, H2, H3)
3. Convert blockquotes
4. Convert lists (bullet and numbered)
5. Convert links (clickable)
6. Convert inline code
7. Convert bold and italic
8. Convert line breaks and paragraphs

### Styling
All markdown elements are styled inline to maintain consistency:
- Links: Blue (#3b82f6) with hover effect
- Bold: Darker gray (#1f2937) with font-weight 600
- Code: Light gray background (#f3f4f6) with red text
- Lists: Proper indentation and spacing
- Headers: Size and weight hierarchy

---

## Limitations

The markdown parser supports the most common markdown features but has some limitations:

### Not Supported:
- ❌ Code blocks (```code```)
- ❌ Tables
- ❌ Images
- ❌ Nested lists (multi-level)
- ❌ Task lists (- [ ] checkbox)
- ❌ Footnotes
- ❌ Definition lists

### Workarounds:
- **Code blocks:** Use multiple `inline code` spans
- **Tables:** Use lists with clear formatting
- **Images:** Use links to image URLs
- **Complex nesting:** Simplify structure

---

## Testing Markdown Rendering

To test the markdown rendering in your exports:

1. Add markdown to SDR notes or research content
2. Export with JavaScript + HTML Viewer format
3. Open viewer and navigate to account detail
4. Verify formatting is correct

### Sample Test Data
```markdown
# Test Header

This is a paragraph with **bold**, *italic*, and [a link](https://auth0.com).

## Subheader

- Bullet one
- Bullet two
- Bullet three

> Important quote here

Check out `inline code` formatting.

---

End of test.
```

---

## Summary

The built-in markdown support makes the offline viewer much more than a simple data dump - it's a **rich, formatted document viewer** that preserves the structure and emphasis of AI-generated research content, making it easy to read, navigate, and share with stakeholders.
