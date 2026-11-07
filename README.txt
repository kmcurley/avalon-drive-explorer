AVALON DOCUMENT LIBRARY - FIRST TEST VERSION
==============================================

Files:
  index.html
  css/styles.css
  js/config.js
  js/drive-api.js
  js/explorer.js

SETUP
-----
1. Open js/config.js in a text editor.
2. Replace PASTE_YOUR_RESTRICTED_API_KEY_HERE with the actual API key value
   from Google Cloud Console. "API key 1" is only its display name.
3. Keep the API key restricted to:
     Website referrers:
       http://localhost:8000/*
       https://www.avalon-estates.com/*
       https://avalon-estates.com/*
     API restriction:
       Google Drive API
4. Confirm the root Drive folder is shared as "Anyone with the link - Viewer".
5. From this folder, run:
       python -m http.server 8000
6. Browse to:
       http://localhost:8000

NOTES
-----
- This first version is READ-ONLY. It lists public folders and files.
- It does not yet implement administrator sign-in, uploads, downloads,
  preview, or printing. Those are later stages.
- The OAuth Client ID is not needed for this read-only public listing test.
- Never put an OAuth client secret in JavaScript or in this project.
- A public folder makes its contents available to anyone who can access it.
- Search recursively checks subfolders and may take time for a large library.
- If the browser reports a permission/API error, check that the Drive API is
  enabled and that the root folder is publicly viewable.
