# Legal Documents

This folder contains the legal documents for MinbarAI.

## Files

- `terms-and-conditions.md` - Terms and Conditions document
- `privacy-policy.md` - Privacy Policy document

## Usage

These markdown files are used by:

1. **API Routes** - For downloadable versions:
   - `/api/terms-and-conditions/download` - Downloads terms as TXT
   - `/api/privacy-policy/download` - Downloads privacy policy as TXT

2. **Web Pages** - For display on the website:
   - `/terms` - Terms and Conditions page
   - `/privacy` - Privacy Policy page

## Updating Documents

When updating these documents:

1. **Update the markdown files** in this folder
2. **Update the corresponding React components**:
   - `app/terms/page.tsx` - Terms and Conditions page
   - `app/privacy/page.tsx` - Privacy Policy page

## File Organization

The API routes will look for files in this `legal/` folder first, with fallback to the old root directory locations for backward compatibility.

## Last Updated

- Terms and Conditions: January 2025
- Privacy Policy: January 2025
