// background.js

// ============================================
// TIMEDTEXT INTERCEPTOR
// Captures YouTube's own caption requests
// ============================================

let isInterceptionEnabled = false;
let capturedTimedtextData = null;
let pendingTabId = null;

// Listen for enable/disable commands from content script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "ENABLE_INTERCEPTION") {
    isInterceptionEnabled = true;
    pendingTabId = sender.tab?.id || null;
    capturedTimedtextData = null;
    console.log("[Background] Interception ENABLED for tab:", pendingTabId);
    sendResponse({ ok: true });
    return;
  }

  if (msg?.type === "DISABLE_INTERCEPTION") {
    isInterceptionEnabled = false;
    pendingTabId = null;
    console.log("[Background] Interception DISABLED");
    sendResponse({ ok: true });
    return;
  }

  if (msg?.type === "GET_CAPTURED_DATA") {
    console.log("[Background] GET_CAPTURED_DATA request, data:", capturedTimedtextData ? "YES" : "NO");
    sendResponse({ data: capturedTimedtextData });
    capturedTimedtextData = null; // Clear after retrieval
    return;
  }

  if (msg?.type === "DOWNLOAD_TEXT_FILE") {
    (async () => {
      const { filename, text } = msg;
      const url = "data:text/plain;charset=utf-8," + encodeURIComponent(text);
      await chrome.downloads.download({
        url,
        filename,
        saveAs: true
      });
      sendResponse({ ok: true });
    })().catch((e) => sendResponse({ ok: false, error: String(e?.message || e) }));
    return true;
  }
});

// Intercept timedtext requests
chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (!isInterceptionEnabled) return;
    if (pendingTabId && details.tabId !== pendingTabId) return;

    console.log("[Background] Captured timedtext request:", details.url);

    // Fetch the response body (we need to re-fetch since webRequest doesn't give us body)
    fetch(details.url)
      .then(res => res.text())
      .then(text => {
        console.log("[Background] Fetched timedtext response, length:", text.length);
        capturedTimedtextData = text;
        
        // Notify content script that data is ready
        if (pendingTabId) {
          chrome.tabs.sendMessage(pendingTabId, {
            type: "TIMEDTEXT_CAPTURED",
            data: text
          });
        }
      })
      .catch(err => {
        console.error("[Background] Failed to fetch timedtext:", err);
      });
  },
  {
    urls: ["https://www.youtube.com/api/timedtext*"],
    types: ["xmlhttprequest"]
  }
);

