# Step-by-Step Testing Guide for All Workarounds

## 🎯 Goal
Test each workaround sequentially to find which one works for downloading YouTube transcripts.

---

## 📋 Before You Start

### Required Setup:
1. Extension installed in Chrome
2. YouTube video open with captions available
3. DevTools open (Cmd+Option+I or F12)
4. Console tab visible

### Quick Reference:
- Extension location: `/Users/tranhuy/Desktop/Code/transcript/yt-transcript-ext/`
- File to edit: `injected.js`
- Line to change: `const WORKAROUND_MODE = X;` (where X = 0, 1, 2, or 3)

---

## 🧪 Test 1: Mode 0 (Baseline - Currently Broken)

### Purpose
Verify the original broken behavior for comparison.

### Steps:
1. Open `injected.js`
2. Set: `const WORKAROUND_MODE = 0;`
3. Save file
4. Go to `chrome://extensions` → Click **Reload** on extension
5. Refresh YouTube page
6. Click "Download transcript"

### Expected Result:
```
[YT Transcript Injected] Mode 0: Original XHR/fetch approach
[YT Transcript Injected] XHR status: 200
[YT Transcript Injected] XHR responseText length: 0
Error: Mode 0 failed: Empty response body
```

### Status: ❌ BROKEN (as expected)

---

## 🧪 Test 2: Mode 1 (Exact Headers - MOST LIKELY TO WORK)

### Purpose
Add exact headers that YouTube expects from a real browser request.

### Steps:

#### Step 2.1: Get Real Headers
1. **Keep YouTube video open**
2. **Open DevTools** → **Network** tab
3. **Filter** by: `timedtext`
4. **Turn captions ON** (click CC button on video)
5. You should see a `timedtext?v=...` request appear
6. **Right-click** on the timedtext request
7. **Copy** → **Copy as fetch** (or Copy as cURL)
8. **Paste** into a text editor

#### Step 2.2: Extract Headers
From the copied fetch/cURL, you'll see headers like:
```
'accept': '*/*',
'accept-language': 'en-US,en;q=0.9',
'referer': 'https://www.youtube.com/watch?v=...',
'sec-fetch-dest': 'empty',
'sec-fetch-mode': 'cors',
'sec-fetch-site': 'same-origin',
'x-youtube-client-name': '1',
'x-youtube-client-version': '2.20260128.01.00'
```

#### Step 2.3: Update Code (OPTIONAL - Already preset)
The code already has common headers set. If Mode 1 fails, you can add more headers:

In `injected.js`, find the Mode 1 section and add any missing headers:
```javascript
xhr.setRequestHeader('Your-Header-Name', 'value');
```

#### Step 2.4: Test
1. Set: `const WORKAROUND_MODE = 1;`
2. Save file
3. Reload extension at `chrome://extensions`
4. Refresh YouTube page
5. Click "Download transcript"

### Expected Result (SUCCESS):
```
[YT Transcript Injected] Mode 1: XHR with exact headers from Network tab
[YT Transcript Injected] Headers set, sending request...
[YT Transcript Injected] XHR status: 200
[YT Transcript Injected] Response length: 45230  ← Should be > 0!
[YT Transcript Injected] First 200 chars: {"events":[{"tStartMs":0,...
Downloaded ✅
```

### Expected Result (FAIL):
```
[YT Transcript Injected] Response length: 0
Error: Mode 1 failed: Status 200, Length 0
```

### Debug Tips:
- Check if `x-youtube-client-version` matches current YouTube version
- Try adding `user-agent` header if still failing
- Check Network tab to see what other headers the real request has

### Status: 🟡 TEST THIS FIRST

---

## 🧪 Test 3: Mode 2 (iframe Loader)

### Purpose
Load the caption URL in a hidden iframe and extract content.

### Steps:
1. Set: `const WORKAROUND_MODE = 2;`
2. Save file
3. Reload extension
4. Refresh YouTube page
5. Click "Download transcript"

### Expected Result (SUCCESS):
```
[YT Transcript Injected] Mode 2: iframe loader trick
[YT Transcript Injected] iframe loaded, text length: 45230
[YT Transcript Injected] First 200 chars: {"events":[...
Downloaded ✅
```

### Expected Result (FAIL):
```
Error: Mode 2 failed: iframe empty
```
or
```
Error: Mode 2 failed: SecurityError: Blocked a frame...
```

### Debug Tips:
- If you see "SecurityError", this means YouTube is blocking iframe access (CORS)
- This is likely to fail but worth trying
- Check console for any security errors

### Status: 🟡 TEST IF MODE 1 FAILS

---

## 🧪 Test 4: Mode 3 (DOM Caption Collector - SLOW BUT RELIABLE)

### Purpose
Watch the video and collect captions as they appear on screen.

### Steps:
1. Set: `const WORKAROUND_MODE = 3;`
2. Save file
3. Reload extension
4. Refresh YouTube page
5. **Turn captions ON manually** (click CC button)
6. Click "Download transcript"
7. **Play the video** for at least 30 seconds
8. Wait for collection to complete

### Expected Result (SUCCESS):
```
[YT Transcript Injected] Mode 3: Collecting captions from DOM
[YT Transcript Injected] Caption window found, starting observer...
[YT Transcript Injected] Captured: Welcome to this video
[YT Transcript Injected] Captured: Today we'll discuss...
[YT Transcript Injected] Captured: distributed systems
... (continues as video plays)
[YT Transcript Injected] Collection complete. Total segments: 156
Downloaded ✅
```

### Expected Result (FAIL):
```
Error: Mode 3 failed: Caption window not found. Turn on captions!
```
or
```
Error: Mode 3 failed: No captions collected. Is video playing with captions on?
```

### Debug Tips:
- Make sure captions are visible on the video
- Play the video - it won't collect if video is paused
- Wait the full 30 seconds
- For long videos, you'll only get the first 30 seconds of captions

### Pros:
- ✅ Most reliable - uses actual rendered captions
- ✅ No API requests needed

### Cons:
- ❌ Very slow (30 seconds minimum)
- ❌ Only gets what's shown during collection period
- ❌ Won't get full transcript of long videos

### Status: 🟢 USE AS LAST RESORT

---

## 📊 Testing Results Template

Copy this and fill in as you test:

```
=== TESTING RESULTS ===

Video URL: https://youtube.com/watch?v=_________________
Video has captions: Yes / No
Caption type: Auto-generated / Manual

---
MODE 0 (Baseline):
Status: ❌ FAILED (expected)
Response length: 0
Error: Empty response body

---
MODE 1 (Exact Headers):
Status: ✅ SUCCESS / ❌ FAILED
Response length: _____
Error (if failed): 
Notes:

---
MODE 2 (iframe):
Status: ✅ SUCCESS / ❌ FAILED / ⏭️ SKIPPED
Response length: _____
Error (if failed):
Notes:

---
MODE 3 (DOM Collector):
Status: ✅ SUCCESS / ❌ FAILED / ⏭️ SKIPPED
Segments collected: _____
Collection time: _____ seconds
Notes:

---
CONCLUSION:
Working mode: _____
Recommended mode: _____
```

---

## 🎯 Which Mode Should Work?

### Probability of Success:

1. **Mode 1 (Exact Headers)** - 60% chance
   - If YouTube only checks headers, this will work
   - Easy to implement permanently

2. **Mode 2 (iframe)** - 20% chance
   - YouTube likely blocks this via CORS
   - Quick to test though

3. **Mode 3 (DOM)** - 100% chance (but slow)
   - Guaranteed to work if captions exist
   - Not practical for long videos

---

## 🚀 After Finding Working Mode

Once you find which mode works:

1. **Report the working mode number**
2. **Share the console logs**
3. I'll clean up the code and remove non-working modes
4. We'll make it the default behavior

---

## 💡 Pro Tips

### Speed up testing:
- Keep extension, YouTube, and console all visible at once
- Use keyboard shortcuts:
  - Cmd+R (reload extension page)
  - Cmd+Shift+R (hard refresh YouTube)
  - Cmd+K (clear console)

### Save time:
- Test Mode 1 thoroughly first (most promising)
- Only try Mode 2 if Mode 1 fails
- Use Mode 3 as last resort

### Get better logs:
- Clear console before each test
- Copy full console output after each test
- Take screenshots if seeing security errors

---

## ❓ FAQ

**Q: Can I test multiple modes without reloading?**
A: No, you must reload the extension each time you change `WORKAROUND_MODE`.

**Q: Mode 1 failed, what headers am I missing?**
A: Copy the FULL fetch command from Network tab and compare all headers.

**Q: Mode 3 is collecting but very slowly**
A: That's normal. It captures captions in real-time as they appear.

**Q: None of the modes work!**
A: Fall back to manual method in WORKAROUND.md (Network tab → copy URL → Python script).

---

## 📞 Need Help?

If stuck, share:
1. Which mode you're testing
2. Full console output
3. The URL from "Copy as fetch" (sanitize video ID if private)
4. Any security errors

Let's find the working mode! Start with Mode 1.
