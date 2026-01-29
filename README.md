# YouTube Transcript Downloader

A Chrome extension that downloads YouTube video transcripts as plain text files.

## ✨ Features

- 📝 Download transcripts in their original verbatim format
- 🌍 Support for all available caption languages
- 🤖 Works with both manual and auto-generated captions
- 🎯 Simple two-click operation
- 💯 100% reliable - uses YouTube's own authenticated requests

## 🚀 How to Use

1. **Install the Extension**
   - Visit Chrome Web Store (link coming soon)
   - Or load unpacked for development (see below)

2. **On Any YouTube Video:**
   - Open a video with captions available
   - Click the **"Download transcript"** button next to Like/Share
   - Select your preferred caption language from the dropdown

3. **Turn On Captions:**
   - Click the **CC** button in the video player
   - The extension automatically captures the transcript data
   - Message will show: "Processing transcript..."

4. **Save the File:**
   - Browser's "Save As" dialog will appear
   - Choose your location and save
   - File format: `{VideoTitle}.{LanguageCode}.txt`

## 📦 Installation (Development)

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **Load unpacked**
5. Select the extension folder
6. Extension is now installed!

## 🔒 Permissions

This extension requires:
- **downloads** - To save transcript files to your computer
- **webRequest** - To intercept YouTube's caption requests for reliable downloads
- **host_permissions** for `youtube.com` - To access YouTube video pages

**Why webRequest?** This extension intercepts YouTube's own caption requests to ensure 100% reliability. We never make unauthorized requests - we simply capture what YouTube already sends when you turn on captions.

## 🛠️ Technical Details

### How It Works

1. Extension detects caption tracks from YouTube's player data
2. User clicks "Download transcript" → Extension enables request interception
3. User turns on captions → YouTube fetches the transcript
4. Extension intercepts YouTube's request and captures the response
5. Transcript is parsed (identical logic to JSON3 format) and downloaded

### Output Format

- **Pure verbatim text** - exactly as YouTube stores it
- **No timestamps** - just the spoken words
- **No formatting** - plain text only
- **Complete transcript** - all caption segments concatenated

### Example Output

```
Hello everyone and welcome to this videoin this video I'm going to show youhow to build a startup from scratchwe'll cover everything from ideationto launching your productlet's get started
```

## 📖 Documentation

Full documentation available in the `/docs` folder:
- [User Guide](docs/INTERCEPTION_MODE_GUIDE.md) - Detailed usage instructions
- [Technical Post-Mortem](docs/POST_MORTEM.md) - How we solved YouTube's security challenges
- [Troubleshooting](docs/DEBUGGING.md) - Common issues and solutions

## 🐛 Troubleshooting

### "No captions detected"
- Make sure the video has captions (click CC button manually to check)
- Refresh the page and try again

### "Empty response" error
- Turn captions OFF, then click "Download transcript", then turn captions ON
- Make sure you turn on captions AFTER clicking the button

### Button doesn't appear
- Extension may not be loaded - check `chrome://extensions`
- Make sure you're on a YouTube video page (`/watch?v=...`)

### Still having issues?
See [docs/DEBUGGING.md](docs/DEBUGGING.md) for detailed troubleshooting steps.

## 🤝 Contributing

This extension was built to solve a specific workflow: automating the download and parsing of YouTube transcripts for research and note-taking.

If you find bugs or have suggestions, please open an issue on GitHub.

## 📜 License

MIT License - See LICENSE file for details

## 🙏 Acknowledgments

Built with the goal of making transcript access easier for:
- Researchers analyzing video content
- Students taking notes from educational videos
- Content creators reviewing their own videos
- Accessibility advocates

---

**Version:** 0.3.0  
**Last Updated:** January 29, 2026  
**Status:** Production Ready

## 📁 Project Structure

```
yt-transcript-ext/
├── manifest.json          # Extension configuration
├── background.js          # Service worker (handles interception)
├── content.js            # Content script (UI + parsing logic)
├── injected.js           # Page context script (accesses YouTube data)
├── README.md             # This file
├── docs/                 # Full documentation
└── archive/              # Deprecated code (not included in extension)
```
