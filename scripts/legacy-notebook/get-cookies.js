/**
 * Use this script locally to extract your NotebookLM session cookies.
 * 
 * INSTRUCTIONS:
 * 1. Open Chrome and go to notebooklm.google.com (make sure you are logged in).
 * 2. Press F12 to open DevTools.
 * 3. Go to the "Network" tab.
 * 4. Refresh the page.
 * 5. Right-click the first request (notebooklm.google.com) and select:
 *    "Copy" -> "Copy as cURL (bash)".
 * 6. Paste that string into a text file or use it to extract the 'cookie' header.
 * 7. Alternatively, use this script if you have 'puppeteer' installed locally.
 */

// This is a placeholder. The easiest way is for the user to copy 
// the 'cookie' header from DevTools directly into GitHub Secrets.

console.log('--- HOW TO GET YOUR COOKIES FOR GITHUB SECRETS ---');
console.log('1. Go to https://notebooklm.google.com');
console.log('2. Open DevTools (F12) > Application > Storage > Cookies');
console.log('3. Copy all cookies and format them as Name=Value; Name=Value; ...');
console.log('4. Or Copy the "cookie" header from any Network request to notebooklm.google.com');
console.log('5. Paste the result into a GitHub Secret named: NOTEBOOKLM_COOKIES');
