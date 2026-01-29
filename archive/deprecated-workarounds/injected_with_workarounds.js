// injected.js
(() => {
  // ============================================
  // WORKAROUND MODE SELECTOR
  // Change this to test different approaches:
  // 1 = XHR with exact headers (copy from Network tab)
  // 2 = iframe loader trick
  // 3 = DOM caption collector (watches video captions)
  // 0 = Original XHR/fetch approach (currently broken)
  // ============================================
  const WORKAROUND_MODE = 3; // Change this value to 0, 1, 2, or 3
  
  function getPlayerResponse() {
    return window.ytInitialPlayerResponse || null;
  }

  function extract(pr) {
    const tracks =
      pr?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];

    const title = pr?.videoDetails?.title || document.title.replace(" - YouTube", "");
    return {
      title,
      captionTracks: tracks.map(t => ({
        baseUrl: t.baseUrl,
        languageCode: t.languageCode,
        kind: t.kind || null, // e.g. "asr"
        name:
          t.name?.simpleText ||
          (t.name?.runs ? t.name.runs.map(r => r.text).join("") : "") ||
          t.languageCode ||
          "unknown"
      }))
    };
  }

  window.addEventListener("message", (ev) => {
    if (ev.source !== window) return;
    if (!ev.data) return;

    if (ev.data.type === "YT_CAPTION_DATA_REQUEST") {
      const pr = getPlayerResponse();
      window.postMessage(
        {
          type: "YT_CAPTION_DATA",
          reqId: ev.data.reqId,
          payload: extract(pr)
        },
        "*"
      );
    }

    if (ev.data.type === "YT_TRANSCRIPT_REQUEST") {
      const reqId = ev.data.reqId;
      const baseUrl = ev.data.baseUrl;
      
      console.log("[YT Transcript Injected] Received request for:", baseUrl);
      console.log("[YT Transcript Injected] Using WORKAROUND_MODE:", WORKAROUND_MODE);
      
      // Add fmt=json3 if not present
      const url = baseUrl.includes("fmt=") 
        ? baseUrl 
        : baseUrl + (baseUrl.includes("?") ? "&" : "?") + "fmt=json3";
      
      console.log("[YT Transcript Injected] Final URL:", url);
      
      // ========================================
      // WORKAROUND MODE 0: Original (Broken)
      // ========================================
      if (WORKAROUND_MODE === 0) {
        console.log("[YT Transcript Injected] Mode 0: Original XHR/fetch approach");
        fetchWithXHR(url, reqId);
        return;
      }
      
      // ========================================
      // WORKAROUND MODE 1: Exact Headers
      // ========================================
      if (WORKAROUND_MODE === 1) {
        console.log("[YT Transcript Injected] Mode 1: XHR with exact headers from Network tab");
        console.log("[YT Transcript Injected] Instructions: Copy headers from DevTools Network → timedtext request");
        
        // TODO: Replace these with YOUR actual headers from Network tab!
        // Steps:
        // 1. Open DevTools → Network tab
        // 2. Turn on captions
        // 3. Find timedtext request
        // 4. Right-click → Copy → Copy as fetch
        // 5. Paste headers here
        
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        
        // Add headers that YouTube expects
        // CRITICAL: Get these from your actual Network tab request!
        const videoId = new URL(location.href).searchParams.get('v');
        xhr.setRequestHeader('Accept', '*/*');
        xhr.setRequestHeader('Accept-Language', 'en-US,en;q=0.9');
        xhr.setRequestHeader('Referer', `https://www.youtube.com/watch?v=${videoId}`);
        xhr.setRequestHeader('Sec-Fetch-Dest', 'empty');
        xhr.setRequestHeader('Sec-Fetch-Mode', 'cors');
        xhr.setRequestHeader('Sec-Fetch-Site', 'same-origin');
        xhr.setRequestHeader('X-YouTube-Client-Name', '1');
        xhr.setRequestHeader('X-YouTube-Client-Version', '2.20260128.01.00');
        
        console.log("[YT Transcript Injected] Headers set, sending request...");
        
        xhr.onload = function() {
          console.log("[YT Transcript Injected] XHR status:", xhr.status);
          console.log("[YT Transcript Injected] Response length:", xhr.responseText.length);
          console.log("[YT Transcript Injected] First 200 chars:", xhr.responseText.substring(0, 200));
          
          if (xhr.status === 200 && xhr.responseText.length > 0) {
            window.postMessage({
              type: "YT_TRANSCRIPT_RESPONSE",
              reqId,
              transcript: xhr.responseText
            }, "*");
          } else {
            window.postMessage({
              type: "YT_TRANSCRIPT_RESPONSE",
              reqId,
              error: `Mode 1 failed: Status ${xhr.status}, Length ${xhr.responseText.length}`
            }, "*");
          }
        };
        
        xhr.onerror = function() {
          window.postMessage({
            type: "YT_TRANSCRIPT_RESPONSE",
            reqId,
            error: "Mode 1: XHR network error"
          }, "*");
        };
        
        xhr.send();
        return;
      }
      
      // ========================================
      // WORKAROUND MODE 2: iframe Loader
      // ========================================
      if (WORKAROUND_MODE === 2) {
        console.log("[YT Transcript Injected] Mode 2: iframe loader trick");
        
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = url;
        
        iframe.onload = function() {
          try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            const text = iframeDoc.body.textContent || iframeDoc.body.innerText;
            
            console.log("[YT Transcript Injected] iframe loaded, text length:", text.length);
            console.log("[YT Transcript Injected] First 200 chars:", text.substring(0, 200));
            
            document.body.removeChild(iframe);
            
            if (text && text.length > 0) {
              window.postMessage({
                type: "YT_TRANSCRIPT_RESPONSE",
                reqId,
                transcript: text
              }, "*");
            } else {
              window.postMessage({
                type: "YT_TRANSCRIPT_RESPONSE",
                reqId,
                error: "Mode 2 failed: iframe empty"
              }, "*");
            }
          } catch (e) {
            console.error("[YT Transcript Injected] iframe error:", e);
            document.body.removeChild(iframe);
            window.postMessage({
              type: "YT_TRANSCRIPT_RESPONSE",
              reqId,
              error: "Mode 2 failed: " + String(e.message)
            }, "*");
          }
        };
        
        iframe.onerror = function() {
          document.body.removeChild(iframe);
          window.postMessage({
            type: "YT_TRANSCRIPT_RESPONSE",
            reqId,
            error: "Mode 2: iframe failed to load"
          }, "*");
        };
        
        document.body.appendChild(iframe);
        return;
      }
      
      // ========================================
      // WORKAROUND MODE 3: DOM Caption Collector
      // ========================================
      if (WORKAROUND_MODE === 3) {
        console.log("[YT Transcript Injected] Mode 3: Collecting captions from DOM");
        console.log("[YT Transcript Injected] Instructions: Play the video for a few seconds...");
        
        const captionTexts = [];
        const seenTexts = new Set();
        
        // Find caption container
        const captionWindow = document.querySelector('.ytp-caption-window-container');
        
        if (!captionWindow) {
          window.postMessage({
            type: "YT_TRANSCRIPT_RESPONSE",
            reqId,
            error: "Mode 3 failed: Caption window not found. Turn on captions!"
          }, "*");
          return;
        }
        
        console.log("[YT Transcript Injected] Caption window found, starting observer...");
        
        const observer = new MutationObserver((mutations) => {
          const captions = document.querySelectorAll('.ytp-caption-segment');
          captions.forEach(cap => {
            const text = cap.textContent.trim();
            if (text && !seenTexts.has(text)) {
              seenTexts.add(text);
              captionTexts.push(text);
              console.log("[YT Transcript Injected] Captured:", text);
            }
          });
        });
        
        observer.observe(captionWindow, {
          childList: true,
          subtree: true,
          characterData: true
        });
        
        // Collect for 30 seconds, then return
        setTimeout(() => {
          observer.disconnect();
          console.log("[YT Transcript Injected] Collection complete. Total segments:", captionTexts.length);
          
          if (captionTexts.length > 0) {
            // Create events/segs/utf8 structure like YouTube's JSON3 format
            const fakeJson = {
              events: captionTexts.map((text, i) => ({
                tStartMs: i * 1000,
                segs: [{ utf8: text }]
              }))
            };
            
            window.postMessage({
              type: "YT_TRANSCRIPT_RESPONSE",
              reqId,
              transcript: JSON.stringify(fakeJson)
            }, "*");
          } else {
            window.postMessage({
              type: "YT_TRANSCRIPT_RESPONSE",
              reqId,
              error: "Mode 3 failed: No captions collected. Is video playing with captions on?"
            }, "*");
          }
        }, 30000); // 30 seconds
        
        return;
      }
    }
    
    // Helper function for Mode 0
    function fetchWithXHR(url, reqId) {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      
      xhr.onload = function() {
        console.log("[YT Transcript Injected] XHR status:", xhr.status);
        console.log("[YT Transcript Injected] XHR responseText length:", xhr.responseText.length);
        
        if (xhr.status === 200) {
          const text = xhr.responseText;
          
          if (!text || text.length === 0) {
            console.error("[YT Transcript Injected] Got 200 but empty body");
            window.postMessage({
              type: "YT_TRANSCRIPT_RESPONSE",
              reqId,
              error: "Mode 0 failed: Empty response body"
            }, "*");
            return;
          }
          
          window.postMessage({
            type: "YT_TRANSCRIPT_RESPONSE",
            reqId,
            transcript: text
          }, "*");
        } else {
          window.postMessage({
            type: "YT_TRANSCRIPT_RESPONSE",
            reqId,
            error: `Mode 0 failed: HTTP ${xhr.status}`
          }, "*");
        }
      };
      
      xhr.onerror = function() {
        window.postMessage({
          type: "YT_TRANSCRIPT_RESPONSE",
          reqId,
          error: "Mode 0: XHR network error"
        }, "*");
      };
      
      xhr.send();
    }
  });
})();
