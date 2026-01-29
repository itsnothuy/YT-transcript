# YouTube Transcript Downloader - Chrome Extension

A Chrome extension that automatically extracts and downloads YouTube video transcripts as `.txt` files directly from the YouTube watch page.

---

## 🎯 What Happens When You Click "Download transcript"?

### Expected Behavior (When Working):

1. **Button Click** → "Fetching…" message appears
2. **Transcript Fetched** from YouTube's caption API (via page context)
3. **Processing** → Extracts all `events[].segs[].utf8` fields and joins them
4. **Download Triggered** → Your browser's **Download dialog opens**
5. **File Saved** → You get a `.txt` file in your Downloads folder

### File Details:

- **Filename format:** `{VideoTitle}.{LanguageCode}.txt`
  - Example: `How_To_Build_A_Startup.en.txt`
  - Special characters in title are replaced with underscores
  - Language code comes from the selected caption track

- **File content:** Pure verbatim transcript text
  - No timestamps (just continuous text)
  - No formatting or line breaks (matches YouTube's raw caption data)
  - Exactly as YouTube stores it in the `utf8` fields

- **File location:** Your browser's default Downloads folder
  - On macOS: typically `~/Downloads/`
  - You can choose "Save As" location (extension uses `saveAs: true`)

### Example Output:

```
Welcome to this video about distributed systemstoday we're going to talk about leaderless replicationin traditional database systems...
```

(Note: YouTube captions often don't have spaces between sentences - that's how YouTube stores them)

---

## 📦 Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **Load unpacked**
5. Select the `yt-transcript-ext` folder
6. Extension is now installed!

---

## 🚀 Usage

1. **Navigate to any YouTube video** (e.g., `https://youtube.com/watch?v=...`)
2. **Wait for page to load** - The extension will automatically:
   - Detect if captions are available
   - Show a dropdown + button next to Like/Share buttons
3. **Select a caption language** from the dropdown (if multiple available)
4. **Click "Download transcript"**
5. **Save the file** when your browser prompts you

### If No Button Appears:

- The video doesn't have captions enabled
- You're not on a `/watch` page (extension only works on video pages)
- The page hasn't fully loaded yet (wait a moment, or refresh)

---

## 🔍 Troubleshooting

### Problem: "Empty response from YouTube captions API"

**What it means:** The extension couldn't fetch the transcript data from YouTube.

**Debug steps:**

1. **Open DevTools Console** (F12 or Cmd+Option+I on Mac)
2. **Look for these log messages:**
   ```
   [YT Transcript Content] Requesting transcript with reqId: ...
   [YT Transcript Content] BaseURL: https://...
   [YT Transcript Injected] Received request for: ...
   [YT Transcript Injected] Fetching URL: ...
   [YT Transcript Injected] Response status: 200 OK
   [YT Transcript Injected] Response text length: 45230
   ```

3. **If you see "Response text length: 0":**
   - The injected script isn't running in page context
   - Try **reloading the extension** in `chrome://extensions`
   - Try **refreshing the YouTube page**
   - Check that `injected.js` is listed in `web_accessible_resources` in manifest

4. **If you don't see injected logs at all:**
   - The content script didn't inject the page script
   - Check browser console for CSP (Content Security Policy) errors
   - Verify the extension has proper permissions

### Problem: Button doesn't appear

**Possible causes:**
- Video has no captions (try a TED talk or educational video)
- You're on YouTube homepage or search results (must be on `/watch` page)
- Extension isn't loaded (check `chrome://extensions`)

### Problem: "Timed out fetching transcript from page context"

**Means:** The injected script didn't respond within 10 seconds

**Solutions:**
- Video might have very large transcript (>10 seconds to fetch)
- Slow internet connection
- YouTube changed their API structure

---

## 🏗️ Architecture

### How It Works:

```
┌────────────────────────────────────────────────────────────┐
│ YouTube Watch Page                                         │
│                                                            │
│  ┌──────────────────┐         ┌─────────────────────┐    │
│  │ Page Context     │         │ Content Script      │    │
│  │ (injected.js)    │ ←────→  │ (content.js)        │    │
│  │                  │ postMsg  │                     │    │
│  │ - Has YT cookies │         │ - Injects UI        │    │
│  │ - Fetches caps   │         │ - Parses JSON3      │    │
│  └──────────────────┘         └─────────────────────┘    │
│                                          │                 │
└──────────────────────────────────────────│─────────────────┘
                                           │ chrome.runtime
                                           ↓
                               ┌─────────────────────┐
                               │ Service Worker      │
                               │ (background.js)     │
                               │                     │
                               │ - Downloads file    │
                               └─────────────────────┘
```

### Why This Design?

YouTube's caption API requires requests from **page context** (where cookies/session exist). Content scripts run in an **isolated world** and can't access these, so we:

1. Inject `injected.js` into page context
2. Content script sends `postMessage` with caption URL
3. Injected script fetches (has proper auth)
4. Returns transcript via `postMessage`
5. Content script processes and triggers download

**See `POST_MORTEM.md` for full technical details.**

---

## 📁 File Structure

```
yt-transcript-ext/
├── manifest.json       # Extension config (MV3)
├── background.js       # Service worker (handles downloads)
├── content.js          # Content script (UI + orchestration)
├── injected.js         # Page context script (fetches captions)
├── README.md           # This file
└── POST_MORTEM.md      # Technical deep dive
```

---

## 🛠️ Development

### Testing Locally:

1. Make changes to any `.js` file
2. Go to `chrome://extensions`
3. Click **Reload** button on the extension card
4. Refresh the YouTube page
5. Test the button

### Adding Features:

**Add timestamps:**
```javascript
// In extractTranscriptJson3():
for (let i = 0; i < data.events.length; i++) {
  const ev = data.events[i];
  const timestamp = ev.tStartMs; // milliseconds
  // Format as [MM:SS] text
}
```

**Add line breaks:**
```javascript
// Join with newlines instead of empty string:
return { transcript: parts.join("\n") };
```

**Support other platforms:**
- Would need to detect Vimeo, Coursera, etc.
- Each has different caption API structures

---

## 🐛 Known Issues

1. **Some videos return empty response**
   - YouTube may require additional auth tokens (POT)
   - Workaround: Use Network tab method (see POST_MORTEM.md)

2. **Button position varies**
   - YouTube's DOM changes frequently
   - Extension tries multiple selectors as fallback

3. **Transcript has no spacing**
   - That's how YouTube stores captions (no spaces between sentences)
   - Future: Add sentence boundary detection

---

## 📋 Permissions

The extension requires:

- `"downloads"` - To save `.txt` files to disk
- `host_permissions` for `youtube.com` - To run on YouTube pages
- `web_accessible_resources` - To inject page context script

**Privacy:** All processing happens locally in your browser. No data is sent to external servers.

---

## 📜 License

MIT License - feel free to modify and distribute.

---

## 🙏 Credits

Based on reverse-engineering YouTube's caption API format (`fmt=json3`).

Inspired by manual transcript extraction workflows using browser DevTools.

---

## 💡 Tips

- **Long videos:** May take 5-10 seconds to download large transcripts
- **Multiple languages:** Switch dropdown to get transcript in different language
- **Auto-generated vs Manual:** Both types work (ASR and human-created)
- **Timestamps:** Not included by default (add them in `extractTranscriptJson3()` if needed)

---

**For technical details about why this architecture was chosen, see `POST_MORTEM.md`.**
