// content.js - NEW INTERCEPTION-BASED APPROACH

const ROOT_ID = "yt-transcript-ext-root";
let injectedOnce = false;
let awaitingCapture = false;
let bootRetryTimer = null;

boot();

// Re-run when YouTube SPA navigates to a new watch page.
window.addEventListener("yt-navigate-finish", () => {
  clearTimeout(bootRetryTimer);  // Cancel any pending retry
  boot();
});
window.addEventListener("yt-page-data-updated", () => {
  clearTimeout(bootRetryTimer);  // Cancel any pending retry
  boot();
});

// Fallback: If button doesn't appear, retry after 2 seconds
// This handles cases where YouTube's DOM loads slowly
window.addEventListener("yt-navigate-finish", () => {
  clearTimeout(bootRetryTimer);
  bootRetryTimer = setTimeout(() => {
    const buttonExists = document.getElementById(ROOT_ID);
    if (!buttonExists && location.pathname.startsWith("/watch")) {
      console.log("[YT Transcript] Button not found after navigation, retrying boot...");
      boot();
    }
  }, 2000);
});

// Listen for captured timedtext data from background
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "TIMEDTEXT_CAPTURED") {
    console.log("[YT Transcript Content] Received captured timedtext data, length:", msg.data?.length);
    handleCapturedData(msg.data);
  }
});

async function boot() {
  try {
    if (!location.pathname.startsWith("/watch")) return;

    ensureInjected();

    // Wait longer for YouTube's dynamic DOM to load
    const actionBar = await waitForAnySelector(
      [
        "ytd-watch-metadata #top-level-buttons-computed",
        "#info #menu #top-level-buttons-computed",
        "ytd-video-primary-info-renderer #top-level-buttons-computed"
      ],
      10000  // Increased from 6s to 10s
    );

    if (!actionBar) {
      console.log("[YT Transcript] Action bar not found, will retry on next navigation");
      return;
    }

    const ui = mountUI(actionBar);
    
    // Try to get caption data with retries
    let data = null;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (!data && attempts < maxAttempts) {
      attempts++;
      try {
        data = await requestCaptionData(3000);  // Increased timeout to 3s
        break;
      } catch (e) {
        console.log(`[YT Transcript] Caption data request failed (attempt ${attempts}/${maxAttempts}):`, e.message);
        if (attempts < maxAttempts) {
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 500 * attempts));
        }
      }
    }

    // Show UI even if caption data failed - user can still try clicking the button
    if (!data) {
      console.log("[YT Transcript] Could not get caption data, showing empty UI");
      // Pass empty caption tracks so UI is mounted but hidden (normal behavior)
      updateUI(ui, { captionTracks: [], title: "youtube_transcript" });
    } else {
      updateUI(ui, data);
    }
  } catch (e) {
    console.error("[YT Transcript] Boot failed:", e);
  }
}

function ensureInjected() {
  if (injectedOnce) return;
  injectedOnce = true;

  const s = document.createElement("script");
  s.src = chrome.runtime.getURL("injected.js");
  s.onload = () => s.remove();
  (document.head || document.documentElement).appendChild(s);
}

function requestCaptionData(timeoutMs = 3000) {  // Increased default from 2s to 3s
  return new Promise((resolve, reject) => {
    const reqId = crypto.randomUUID();
    const t = setTimeout(() => {
      window.removeEventListener("message", onMsg);
      reject(new Error("Timed out requesting caption data"));
    }, timeoutMs);

    function onMsg(ev) {
      if (ev.source !== window) return;
      if (ev.data?.type !== "YT_CAPTION_DATA") return;
      if (ev.data?.reqId !== reqId) return;

      clearTimeout(t);
      window.removeEventListener("message", onMsg);
      resolve(ev.data.payload);
    }

    window.addEventListener("message", onMsg);
    window.postMessage({ type: "YT_CAPTION_DATA_REQUEST", reqId }, "*");
  });
}

function restoreButtonHandler(ui) {
  const { track, btn, msg, shadow } = ui;
  
  // Remove any existing listener by cloning the button
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);
  
  // Update reference
  ui.btn = newBtn;
  
  // Add the normal download handler
  newBtn.addEventListener("click", async () => {
    try {
      newBtn.disabled = true;
      track.disabled = true;
      msg.textContent = "Please turn on captions...";

      const opt = track.selectedOptions[0];
      const title = opt?.dataset?.title || "youtube_transcript";
      const languageCode = opt?.dataset?.lang || "lang";

      // Enable interception in background
      await chrome.runtime.sendMessage({ type: "ENABLE_INTERCEPTION" });
      console.log("[YT Transcript] Interception enabled - please turn on captions in video player");

      // Store UI context for later
      window.__ytTranscriptUI = { title, languageCode, btn: newBtn, track, msg };
      awaitingCapture = true;

      // Show instructions to user
      msg.textContent = "👆 Turn on captions (CC button) to capture transcript";

    } catch (e) {
      msg.textContent = String(e?.message || e);
      newBtn.disabled = false;
      track.disabled = false;
    }
  });
}

function mountUI(actionBar) {
  // If already present, reuse it
  let host = document.getElementById(ROOT_ID);
  if (host) return host.__ui;

  host = document.createElement("span");
  host.id = ROOT_ID;

  // Keep it near other action buttons
  actionBar.prepend(host);

  const shadow = host.attachShadow({ mode: "open" });

  shadow.innerHTML = `
    <style>
      .wrap { display: inline-flex; align-items: center; gap: 8px; }
      select, button {
        font: inherit;
        height: 36px;
        border-radius: 18px;
        border: 1px solid var(--yt-spec-10-percent-layer, rgba(0,0,0,.1));
        background: var(--yt-spec-badge-chip-background, rgba(0,0,0,.05));
        color: var(--yt-spec-text-primary, #0f0f0f);
        padding: 0 12px;
        cursor: pointer;
      }
      select { max-width: 160px; }
      button[disabled], select[disabled] { opacity: .6; cursor: not-allowed; }
      .msg { font-size: 12px; opacity: .8; margin-left: 6px; }
      .hidden { display: none; }
    </style>

    <span class="wrap">
      <select id="track" disabled></select>
      <button id="btn" disabled>Download transcript</button>
      <span id="msg" class="msg"></span>
    </span>
  `;

  const track = shadow.getElementById("track");
  const btn = shadow.getElementById("btn");
  const msg = shadow.getElementById("msg");

  btn.addEventListener("click", async () => {
    try {
      btn.disabled = true;
      track.disabled = true;
      msg.textContent = "Please turn on captions...";

      const opt = track.selectedOptions[0];
      const title = opt?.dataset?.title || "youtube_transcript";
      const languageCode = opt?.dataset?.lang || "lang";

      // Enable interception in background
      await chrome.runtime.sendMessage({ type: "ENABLE_INTERCEPTION" });
      console.log("[YT Transcript] Interception enabled - please turn on captions in video player");

      // Store UI context for later
      window.__ytTranscriptUI = { title, languageCode, btn, track, msg };
      awaitingCapture = true;

      // Show instructions to user
      msg.textContent = "👆 Turn on captions (CC button) to capture transcript";

    } catch (e) {
      msg.textContent = String(e?.message || e);
      btn.disabled = false;
      track.disabled = false;
    }
  });

  host.__ui = { host, shadow, track, btn, msg };
  return host.__ui;
}

async function handleCapturedData(raw) {
  if (!awaitingCapture) return;
  awaitingCapture = false;

  const context = window.__ytTranscriptUI;
  if (!context) return;

  const { title, languageCode, btn, track, msg } = context;

  try {
    msg.textContent = "Processing transcript...";

    console.log("[YT Transcript] Raw data length:", raw.length);
    console.log("[YT Transcript] First 500 chars:", raw.substring(0, 500));

    if (!raw || raw.trim().length === 0) {
      throw new Error("Empty response from YouTube captions API");
    }

    // Use the EXACT parsing logic from extract_transcript.py
    const { transcript, report } = extractTranscriptJson3(raw);

    console.log("[YT Transcript] Extraction complete:");
    console.log(report);

    const filename = safeFilename(`${title}.${languageCode}.txt`);

    const dl = await chrome.runtime.sendMessage({
      type: "DOWNLOAD_TEXT_FILE",
      filename,
      text: transcript
    });

    if (!dl?.ok) throw new Error(dl?.error || "Download failed");

    msg.textContent = "Downloaded ✅";

    // Disable interception
    await chrome.runtime.sendMessage({ type: "DISABLE_INTERCEPTION" });

  } catch (e) {
    msg.textContent = String(e?.message || e);
  } finally {
    btn.disabled = false;
    track.disabled = false;
  }
}

function updateUI(ui, data) {
  const tracks = data?.captionTracks || [];
  const title = data?.title || "youtube_transcript";

  // Hide the whole thing if no captions
  if (tracks.length === 0) {
    ui.host.style.display = "none";
    return;
  }

  ui.host.style.display = "";
  ui.track.innerHTML = "";

  // Prefer human captions over ASR, then English, else first
  const sorted = [...tracks].sort((a, b) => {
    const aAsr = a.kind === "asr" ? 1 : 0;
    const bAsr = b.kind === "asr" ? 1 : 0;
    if (aAsr !== bAsr) return aAsr - bAsr;

    const aEn = (a.languageCode || "").toLowerCase().startsWith("en") ? 0 : 1;
    const bEn = (b.languageCode || "").toLowerCase().startsWith("en") ? 0 : 1;
    return aEn - bEn;
  });

  for (const t of sorted) {
    const opt = document.createElement("option");
    opt.value = t.baseUrl;
    opt.textContent = `${t.name} (${t.languageCode}${t.kind ? `, ${t.kind}` : ""})`;
    opt.dataset.lang = t.languageCode || "";
    opt.dataset.title = title;
    ui.track.appendChild(opt);
  }

  ui.track.disabled = false;
  ui.btn.disabled = false;
  ui.msg.textContent = "";
}

/**
 * EXACT PARSING LOGIC FROM extract_transcript.py
 * Mirrors Python implementation line-by-line
 */
function extractTranscriptJson3(raw) {
  // ---------- A) Parse JSON with explicit failure handling ----------
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    const report = {
      fileName: "captured_from_network",
      parsedOk: false,
      status: "JSON_PARSE_FAILED",
      jsonError: String(e),
      numEvents: 0,
      numEventsWithSegs: 0,
      numSegsExtracted: 0,
      numMissingUtf8: 0,
      warnings: []
    };

    console.error("INTEGRITY REPORT", report);
    throw new Error("JSON_PARSE_FAILED: " + e.message);
  }

  // ---------- B) Check for events array ----------
  if (!Array.isArray(data?.events)) {
    const report = {
      fileName: "captured_from_network",
      parsedOk: true,
      status: "NO_EVENTS_ARRAY",
      numEvents: 0,
      numEventsWithSegs: 0,
      numSegsExtracted: 0,
      numMissingUtf8: 0,
      warnings: ["events array missing or not a list"]
    };

    console.error("INTEGRITY REPORT", report);
    throw new Error("NO_EVENTS_ARRAY");
  }

  const events = data.events;

  // ---------- C) Extract transcript and collect stats ----------
  const transcriptParts = [];

  const numEvents = events.length;
  let numEventsWithSegs = 0;
  let numSegsExtracted = 0;
  let numMissingUtf8 = 0;
  let numNoSegsEvents = 0;

  const missingUtf8Log = [];
  const noSegsLog = [];

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const segs = ev?.segs;

    if (!segs) {
      numNoSegsEvents++;
      noSegsLog.push(`event=${i}: NO_SEGS (no segs array)`);
      continue;
    }

    numEventsWithSegs++;

    for (let j = 0; j < segs.length; j++) {
      const seg = segs[j];

      if (!("utf8" in seg)) {
        const placeholder = `⟦MISSING_UTF8 event=${i} seg=${j}⟧`;
        transcriptParts.push(placeholder);
        numMissingUtf8++;
        numSegsExtracted++;
        missingUtf8Log.push(
          `event=${i} seg=${j}: missing utf8 field, inserted placeholder`
        );
      } else {
        const text = seg.utf8;
        // DO NOT clean, trim, or modify text. Use exactly as-is.
        transcriptParts.push(text);
        numSegsExtracted++;
      }
    }
  }

  const transcript = transcriptParts.join("");

  // ---------- D) Build integrity report ----------
  const warnings = [];
  if (numNoSegsEvents > 0) {
    warnings.push(`${numNoSegsEvents} events had NO_SEGS (metadata-only)`);
  }

  const report = {
    fileName: "captured_from_network",
    parsedOk: true,
    status: "SUCCESS",
    numEvents,
    numEventsWithSegs,
    numSegsExtracted,
    numMissingUtf8,
    warnings: warnings.length > 0 ? warnings : ["none"],
    missingUtf8Log: numMissingUtf8 > 0 ? missingUtf8Log : ["None"],
    noSegsLog: numNoSegsEvents > 0 ? noSegsLog : ["None"]
  };

  console.log("INTEGRITY REPORT", report);
  console.log("VERBATIM TRANSCRIPT (first 1000 chars):", transcript.substring(0, 1000));

  return { transcript, report };
}

function safeFilename(name) {
  return name.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 180).trim() || "transcript.txt";
}

function waitForAnySelector(selectors, timeoutMs) {
  return new Promise((resolve) => {
    for (const s of selectors) {
      const el = document.querySelector(s);
      if (el) return resolve(el);
    }

    const obs = new MutationObserver(() => {
      for (const s of selectors) {
        const el = document.querySelector(s);
        if (el) {
          obs.disconnect();
          resolve(el);
          return;
        }
      }
    });

    obs.observe(document.documentElement, { childList: true, subtree: true });

    setTimeout(() => {
      obs.disconnect();
      resolve(null);
    }, timeoutMs);
  });
}
