// content.js

const ROOT_ID = "yt-transcript-ext-root";
let injectedOnce = false;
let mounted = false;

boot();

// Re-run when YouTube SPA navigates to a new watch page.
window.addEventListener("yt-navigate-finish", () => boot());
window.addEventListener("yt-page-data-updated", () => boot());

async function boot() {
  try {
    if (!location.pathname.startsWith("/watch")) return;

    ensureInjected();

    const actionBar = await waitForAnySelector(
      [
        "ytd-watch-metadata #top-level-buttons-computed",
        "#info #menu #top-level-buttons-computed",
        "ytd-video-primary-info-renderer #top-level-buttons-computed"
      ],
      6000
    );

    if (!actionBar) return;

    const ui = mountUI(actionBar);
    const data = await requestCaptionData();

    updateUI(ui, data);
  } catch {
    // no-op: YouTube DOM is volatile; we fail gracefully
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

function requestCaptionData(timeoutMs = 2000) {
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

function requestTranscriptFromPage(baseUrl, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const reqId = crypto.randomUUID();
    
    console.log("[YT Transcript Content] Requesting transcript with reqId:", reqId);
    console.log("[YT Transcript Content] BaseURL:", baseUrl);
    
    // Test: Can we access the URL directly from content script?
    console.log("[YT Transcript Content] Testing if baseUrl has required params...");
    const hasSignature = baseUrl.includes("signature=");
    const hasPot = baseUrl.includes("pot=");
    const hasExpire = baseUrl.includes("expire=");
    console.log("[YT Transcript Content] Has signature:", hasSignature);
    console.log("[YT Transcript Content] Has pot:", hasPot);
    console.log("[YT Transcript Content] Has expire:", hasExpire);
    
    const t = setTimeout(() => {
      window.removeEventListener("message", onMsg);
      reject(new Error("Timed out fetching transcript from page context"));
    }, timeoutMs);

    function onMsg(ev) {
      if (ev.source !== window) return;
      if (ev.data?.type !== "YT_TRANSCRIPT_RESPONSE") return;
      if (ev.data?.reqId !== reqId) return;

      console.log("[YT Transcript Content] Received response for reqId:", reqId);
      console.log("[YT Transcript Content] Has error?", !!ev.data.error);
      console.log("[YT Transcript Content] Transcript length:", ev.data.transcript?.length);

      clearTimeout(t);
      window.removeEventListener("message", onMsg);
      
      if (ev.data.error) {
        reject(new Error(ev.data.error));
      } else {
        resolve(ev.data.transcript);
      }
    }

    window.addEventListener("message", onMsg);
    window.postMessage({ 
      type: "YT_TRANSCRIPT_REQUEST", 
      reqId, 
      baseUrl 
    }, "*");
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
      msg.textContent = "Fetching…";

      const opt = track.selectedOptions[0];
      const baseUrl = opt?.value;
      const title = opt?.dataset?.title || "youtube_transcript";
      const languageCode = opt?.dataset?.lang || "lang";

      if (!baseUrl) throw new Error("No track selected");

      // Request the transcript from the injected script (page context)
      // because it has proper access to fetch with YouTube's security context
      const raw = await requestTranscriptFromPage(baseUrl);
      
      // Debug: log the response to see what we got
      console.log("[YT Transcript] Response length:", raw.length);
      console.log("[YT Transcript] First 500 chars:", raw.substring(0, 500));
      
      if (!raw || raw.trim().length === 0) {
        throw new Error("Empty response from YouTube captions API");
      }
      
      const { transcript } = extractTranscriptJson3(raw);

      const filename = safeFilename(`${title}.${languageCode}.txt`);

      const dl = await chrome.runtime.sendMessage({
        type: "DOWNLOAD_TEXT_FILE",
        filename,
        text: transcript
      });

      if (!dl?.ok) throw new Error(dl?.error || "Download failed");
      msg.textContent = "Downloaded ✅";
    } catch (e) {
      msg.textContent = String(e?.message || e);
    } finally {
      btn.disabled = false;
      track.disabled = false;
    }
  });

  host.__ui = { host, shadow, track, btn, msg };
  return host.__ui;
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

function withFmtJson3(baseUrl) {
  const joiner = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${joiner}fmt=json3`;
}

function extractTranscriptJson3(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error("JSON_PARSE_FAILED: " + e.message);
  }

  if (!Array.isArray(data?.events)) throw new Error("NO_EVENTS_ARRAY");

  const parts = [];
  for (let i = 0; i < data.events.length; i++) {
    const ev = data.events[i];
    const segs = ev?.segs;
    if (!Array.isArray(segs)) continue;

    for (let j = 0; j < segs.length; j++) {
      const seg = segs[j];
      if (!("utf8" in seg)) parts.push(`⟦MISSING_UTF8 event=${i} seg=${j}⟧`);
      else parts.push(seg.utf8);
    }
  }
  return { transcript: parts.join("") };
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
