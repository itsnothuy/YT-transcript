# 🎯 Quick Reference: Testing All Workarounds

## Current Status
✅ All 4 workarounds implemented
📝 Ready to test one by one

---

## 🔧 How to Switch Modes

### Edit this file:
```
/Users/tranhuy/Desktop/Code/transcript/yt-transcript-ext/injected.js
```

### Change this line (near top of file):
```javascript
const WORKAROUND_MODE = 1;  // ← Change this number
```

### Then:
1. Save file
2. Go to `chrome://extensions`
3. Click **Reload** on extension
4. Refresh YouTube page
5. Click "Download transcript"
6. Check console

---

## 📊 Testing Order (Recommended)

```
┌─────────────┐
│   Mode 1    │  ← START HERE (60% chance of working)
│   Headers   │     Add real headers from Network tab
└─────────────┘     Fast if it works
       ↓ if fails
┌─────────────┐
│   Mode 2    │     Try iframe loader
│   iframe    │     20% chance, worth a shot
└─────────────┘     Fast to test
       ↓ if fails  
┌─────────────┐
│   Mode 3    │  ← LAST RESORT (100% works but slow)
│    DOM      │     Collects captions from screen
└─────────────┘     Takes 30+ seconds
```

---

## 🧪 Mode Quick Reference

### Mode 0: Baseline (Broken)
```javascript
const WORKAROUND_MODE = 0;
```
- **Purpose:** Verify original broken behavior
- **Expected:** Empty response (0 bytes)
- **Use:** Just to confirm the problem

### Mode 1: Exact Headers ⭐ RECOMMENDED
```javascript
const WORKAROUND_MODE = 1;
```
- **Purpose:** Add YouTube's expected headers
- **Setup:** Copy headers from Network tab (optional - already preset)
- **Expected:** Should work if headers are correct
- **Speed:** Fast (1-2 seconds)

### Mode 2: iframe Loader
```javascript
const WORKAROUND_MODE = 2;
```
- **Purpose:** Load caption URL in hidden iframe
- **Setup:** None needed
- **Expected:** May fail due to CORS
- **Speed:** Fast (1-2 seconds)

### Mode 3: DOM Collector
```javascript
const WORKAROUND_MODE = 3;
```
- **Purpose:** Watch video and collect captions from screen
- **Setup:** Must turn captions ON and play video
- **Expected:** 100% success rate but slow
- **Speed:** 30 seconds minimum

---

## 📝 What to Check in Console

### Mode 1 SUCCESS:
```
[YT Transcript Injected] Mode 1: XHR with exact headers
Response length: 45230  ← Should be > 0
First 200 chars: {"events":[...
Downloaded ✅
```

### Mode 1 FAIL:
```
Response length: 0  ← Still 0
Error: Mode 1 failed
```

### Mode 2 SUCCESS:
```
[YT Transcript Injected] Mode 2: iframe loader
iframe loaded, text length: 45230
Downloaded ✅
```

### Mode 3 SUCCESS:
```
[YT Transcript Injected] Mode 3: Collecting captions from DOM
Captured: Welcome to this video
Captured: Today we'll discuss...
Collection complete. Total segments: 156
Downloaded ✅
```

---

## 🎯 One-Line Test Commands

Open YouTube, then paste these in DevTools console to test manually:

### Test if baseUrl is valid:
```javascript
window.ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer.captionTracks[0].baseUrl
```

### Test Mode 1 manually:
```javascript
const url = window.ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer.captionTracks[0].baseUrl + "&fmt=json3";
fetch(url).then(r => r.text()).then(t => console.log("Length:", t.length, "First 100:", t.substring(0, 100)));
```

---

## 🚨 Troubleshooting

### Problem: Extension button doesn't appear
**Solution:** Not on a `/watch` page, or video has no captions

### Problem: Console shows no logs at all
**Solution:** Extension not loaded, hit Reload in chrome://extensions

### Problem: Console shows old logs
**Solution:** Clear console (Cmd+K) before testing

### Problem: Mode 1 still returns 0 bytes
**Solution:** Copy EXACT headers from Network tab timedtext request

### Problem: Mode 3 shows "Caption window not found"
**Solution:** Turn captions ON manually (click CC button on video)

---

## 📞 Report Results

After testing, share:

```
MODE TESTED: ___
RESULT: ✅ SUCCESS / ❌ FAILED
RESPONSE LENGTH: _____
ERROR (if any): 
CONSOLE LOGS: (paste here)
```

---

## 🎓 Pro Tips

1. **Clear console** before each test (Cmd+K)
2. **Start with Mode 1** - highest chance of success
3. **Check Network tab** for real timedtext requests
4. **Mode 3 requires video to play** - don't pause!
5. **Test on a short video first** - faster iteration

---

## Files Reference

```
Main code:       injected.js (change WORKAROUND_MODE here)
Detailed guide:  TESTING_GUIDE.md (step-by-step)
Manual method:   WORKAROUND.md (Network tab approach)
Post-mortem:     POST_MORTEM.md (technical analysis)
```

---

**Ready to test? Start with Mode 1! 🚀**
