# Deprecated Workarounds Archive

This folder contains old code attempts that were tried but ultimately not used in the final solution.

## Files

### `content_old.js`
The original content script that attempted to:
- Fetch transcript from page context using postMessage
- Tried direct XHR/fetch approaches
- All resulted in empty responses (0 bytes) from YouTube

### `injected_with_workarounds.js`
Contains 4 different workaround modes (0-3):
- **Mode 0**: Baseline XHR/fetch (broken)
- **Mode 1**: XHR with exact headers from Network tab
- **Mode 2**: iframe loader trick
- **Mode 3**: DOM caption collector (MutationObserver)

## Why These Were Deprecated

All modes 0-2 failed because YouTube's anti-bot detection blocks programmatic requests even from page context. Mode 3 worked but was too slow (30+ seconds, only captures visible captions).

## Final Solution

The final working solution uses **webRequest interception**:
- Extension listens for YouTube's own timedtext requests
- Captures the response when user turns on captions
- 100% reliable, uses YouTube's authenticated requests
- See main codebase for implementation

## Historical Context

These attempts helped us understand:
1. YouTube returns 200 OK with empty body (not 403) to hide security
2. Headers alone aren't enough - YouTube validates request origin
3. POT (Page Origin Token) is cryptographically bound to session
4. Interception is more reliable than replication

Keep this archive for reference when dealing with similar API security issues.
