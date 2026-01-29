# Debugging Guide: Empty Response Issue

## 🔴 Current Problem

**Error:** "Empty response from YouTube captions API"
**Console:** 
```
[YT Transcript] Response length: 0
[YT Transcript] First 500 chars:
```

---

## 🔍 Step-by-Step Debug Checklist

### Step 1: Verify Extension Files Are Loaded

1. Open `chrome://extensions/`
2. Find "YouTube Transcript TXT Downloader"
3. Click **Details**
4. Check that all files are present:
   - ✅ manifest.json
   - ✅ background.js
   - ✅ content.js
   - ✅ injected.js

### Step 2: Reload Everything

1. In `chrome://extensions/`, click the **Reload** button
2. Go to YouTube and open any video with captions
3. **Hard refresh** the page (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)

### Step 3: Check Console Logs

Open DevTools (F12 or Cmd+Option+I), then click "Download transcript".

**You should see logs in this order:**

```
[YT Transcript Content] Requesting transcript with reqId: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
[YT Transcript Content] BaseURL: https://www.youtube.com/api/timedtext?v=...&signature=...&pot=...
[YT Transcript Injected] Received request for: https://www.youtube.com/api/timedtext?...
[YT Transcript Injected] Fetching URL: https://www.youtube.com/api/timedtext?...&fmt=json3
[YT Transcript Injected] Response status: 200 OK
[YT Transcript Injected] Response headers: [...]
[YT Transcript Injected] Response text length: 45230
[YT Transcript Injected] First 200 chars: {"events":[{"tStartMs":0,...
[YT Transcript Content] Received response for reqId: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
[YT Transcript Content] Has error? false
[YT Transcript Content] Transcript length: 45230
[YT Transcript] Response length: 45230
[YT Transcript] First 500 chars: {"events":[{"tStartMs":0,"dDurationMs":4000,...
```

### Step 4: Diagnose Missing Logs

#### Case A: No logs at all
**Problem:** Content script not running
**Fix:**
1. Check manifest.json `content_scripts.matches` includes current YouTube URL
2. Verify `run_at: "document_idle"` is present
3. Reload extension

#### Case B: See "Content" logs but not "Injected" logs
**Problem:** injected.js not injecting into page
**Possible causes:**
1. **CSP (Content Security Policy) blocking the script**
   - Check console for CSP errors
   - Look for: `Refused to load the script...`
2. **Script not declared in web_accessible_resources**
   - Check manifest.json
3. **Script injection timing issue**

**Fix:**
```javascript
// In content.js, add retry logic:
function ensureInjected() {
  if (injectedOnce) return;
  injectedOnce = true;

  const s = document.createElement("script");
  s.src = chrome.runtime.getURL("injected.js");
  s.onload = () => {
    console.log("[Content] Injected script loaded successfully");
    s.remove();
  };
  s.onerror = (e) => {
    console.error("[Content] Failed to inject script:", e);
  };
  (document.head || document.documentElement).appendChild(s);
}
```

#### Case C: See "Injected" logs but "Response text length: 0"
**Problem:** YouTube's API is returning empty body
**This is the MAIN ISSUE you're experiencing**

**Possible causes:**

1. **The `pot` token has expired**
   - YouTube generates these tokens when the page loads
   - They expire after some time
   - **Fix:** Refresh the YouTube page

2. **The `baseUrl` doesn't have required parameters**
   - Check the logged BaseURL
   - Should contain: `signature`, `pot`, `expire`, `key`
   - **If missing:** YouTube changed their caption structure

3. **CORS or security blocking**
   - Even in page context, fetch might be blocked
   - Check Network tab for the request
   - Look for: Status 200 but 0 bytes transferred

4. **YouTube A/B testing / geo-restrictions**
   - YouTube might be testing new caption formats
   - Some regions might have different API behavior

### Step 5: Manual Verification

**Test if the URL works at all:**

1. Click "Download transcript" and let it fail
2. Copy the logged BaseURL from console
3. Open a **new browser tab**
4. Paste the URL in address bar
5. Add `&fmt=json3` if not present
6. Press Enter

**Expected result:** You should see JSON like:
```json
{"events":[{"tStartMs":0,"dDurationMs":4000,"segs":[{"utf8":"Welcome to"}]},...]}
```

**If you see empty page or error:**
- The URL is invalid or expired
- YouTube's API changed
- Need to get fresh URL from `ytInitialPlayerResponse`

---

## 🔧 Advanced Debugging

### Check ytInitialPlayerResponse

Open YouTube video page, then in console:

```javascript
// Check if player response exists
window.ytInitialPlayerResponse

// Check caption tracks
window.ytInitialPlayerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks

// Check a specific track
const tracks = window.ytInitialPlayerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks
console.log("First track:", tracks[0])
console.log("BaseURL:", tracks[0]?.baseUrl)
```

**Expected output:**
```javascript
{
  baseUrl: "https://www.youtube.com/api/timedtext?v=...&signature=...&pot=...",
  name: { simpleText: "English" },
  vssId: ".en",
  languageCode: "en",
  kind: "asr",
  isTranslatable: true
}
```

### Test Fetch in Console

```javascript
// Copy baseUrl from above
const baseUrl = "..."; // paste here

// Add fmt=json3
const url = baseUrl + (baseUrl.includes("?") ? "&" : "?") + "fmt=json3";

// Try fetching
fetch(url)
  .then(r => r.text())
  .then(t => {
    console.log("Length:", t.length);
    console.log("First 500 chars:", t.substring(0, 500));
  })
  .catch(e => console.error("Fetch failed:", e));
```

**If this works in console but not in extension:**
- There's something different about the execution context
- Try running it in an **eval'd script** from the page

---

## 🛠️ Potential Fixes

### Fix 1: Ensure injected.js runs in page context

Verify in `content.js`:

```javascript
function ensureInjected() {
  if (injectedOnce) return;
  injectedOnce = true;

  const s = document.createElement("script");
  s.src = chrome.runtime.getURL("injected.js");
  s.onload = () => s.remove();
  
  // IMPORTANT: Inject into HEAD (actual page DOM)
  (document.head || document.documentElement).appendChild(s);
}
```

### Fix 2: Add fetch credentials

In `injected.js`, try adding credentials:

```javascript
fetch(url, { credentials: 'include' })  // or 'same-origin'
```

⚠️ **Note:** We tried this before and it caused sandbox issues, but worth testing with the page context approach.

### Fix 3: Use XMLHttpRequest instead of fetch

Some extensions have better luck with XHR:

```javascript
// In injected.js, replace fetch() with:
const xhr = new XMLHttpRequest();
xhr.open('GET', url, true);
xhr.onload = function() {
  if (xhr.status === 200) {
    const text = xhr.responseText;
    console.log("[YT Transcript Injected] XHR Response length:", text.length);
    window.postMessage({
      type: "YT_TRANSCRIPT_RESPONSE",
      reqId,
      transcript: text
    }, "*");
  } else {
    window.postMessage({
      type: "YT_TRANSCRIPT_RESPONSE",
      reqId,
      error: `HTTP ${xhr.status}: ${xhr.statusText}`
    }, "*");
  }
};
xhr.onerror = function() {
  window.postMessage({
    type: "YT_TRANSCRIPT_RESPONSE",
    reqId,
    error: "XHR network error"
  }, "*");
};
xhr.send();
```

### Fix 4: Check for YouTube API changes

YouTube might have changed the caption URL structure. Check:

1. **Network tab** in DevTools
2. Filter by "timedtext"
3. Look for actual caption requests
4. Compare URLs to what extension is using

---

## 📊 Compare: Working vs Not Working

### ✅ WORKING (What you should see):

```
User clicks button
↓
Content script sends message to page
↓
Injected script receives message
↓ 
Injected script fetches URL
↓
Response: 200 OK, 45KB body
↓
Injected script sends transcript back
↓
Content script receives transcript
↓
Processes JSON
↓
Downloads file
```

### ❌ NOT WORKING (Current state):

```
User clicks button
↓
Content script sends message to page
↓
Injected script receives message (?)
↓
Injected script fetches URL
↓
Response: 200 OK, 0 bytes body ← PROBLEM HERE
↓
Injected script sends empty string back
↓
Content script receives empty response
↓
Error: "Empty response from YouTube captions API"
```

---

## 🎯 Next Steps

1. **Add the enhanced logging** (already done in latest code)
2. **Reload extension** in chrome://extensions
3. **Refresh YouTube page**
4. **Click "Download transcript"**
5. **Share all console logs** from both tabs:
   - YouTube page console
   - Extension background page console (inspect service worker)

6. **Also check Network tab:**
   - Filter by "timedtext"
   - Look for the fetch request
   - Check response headers and body

---

## 📝 Report Template

When reporting the issue, include:

```
## Environment
- Chrome version: 
- Extension version: 0.2.0
- Video URL: 
- Video has captions: Yes/No
- Caption type: Auto-generated / Manual

## Console Logs
[Paste all logs starting with [YT Transcript]]

## Network Tab
- timedtext request appears: Yes/No
- Request URL: 
- Response status: 
- Response size: 

## ytInitialPlayerResponse
- captionTracks exists: Yes/No
- Number of tracks: 
- First track baseUrl: [paste]
```

This will help diagnose the exact issue.
