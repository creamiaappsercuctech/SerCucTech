/* SerCucTech guide.js (v1.0)
   - Multi-language auto: IT / EN / UA (device language)
   - First-run prompt: enable guide + voice + ask only first time
   - Per-area toggles: admin / vetrina / checklist
   - Speech with mobile unlock + safe fallbacks
   - Debug overlay: add ?debug=1 to URL
*/

(function () {
  const LS = {
    firstRunDone: "sct_firstRunDone_v1",
    askOnFirstRun: "sct_askOnFirstRun_v1",
    guideAdmin: "sct_guide_admin_v1",
    guideVetrina: "sct_guide_vetrina_v1",
    guideChecklist: "sct_guide_checklist_v1",
    voiceEnabled: "sct_voice_enabled_v1"
  };

  const qs = new URL(location.href).searchParams;
  const DEBUG = qs.get("debug") === "1";

  const rawLang = (navigator.language || "it-IT").toLowerCase();
  const LANG = rawLang.startsWith("uk") ? "uk" : rawLang.startsWith("en") ? "en" : "it";

  const I18N = {
    it: {
      firstTitle: "Vuoi attivare la guida vocale?",
      firstBody: "La guida ti dice cosa fare passo dopo passo. Puoi spegnerla quando vuoi.",
      enableGuide: "Attiva guida",
      enableVoice: "Attiva voce del telefono",
      askAgain: "Chiedimelo solo al primo accesso (consigliato)",
      ok: "OK",
      cancel: "No, grazie",
      toastOn: "Guida attivata",
      toastOff: "Guida disattivata",
      voiceOn: "Voce attiva",
      voiceOff: "Voce disattiva",
      debugTitle: "DEBUG SerCucTech",
      debugSpeak: "PARLA ORA",
      debugClear: "PULISCI",
      debugClose: "CHIUDI",
      debugHint: "Se la voce non parte: fai un tap sulla pagina e riprova.",
      unlocked: "Audio sbloccato (tap rilevato)."
    },
    en: {
      firstTitle: "Enable voice guide?",
      firstBody: "The guide tells you what to do step by step. You can disable it anytime.",
      enableGuide: "Enable guide",
      enableVoice: "Enable phone voice",
      askAgain: "Ask only on first run (recommended)",
      ok: "OK",
      cancel: "No thanks",
      toastOn: "Guide enabled",
      toastOff: "Guide disabled",
      voiceOn: "Voice enabled",
      voiceOff: "Voice disabled",
      debugTitle: "SerCucTech DEBUG",
      debugSpeak: "SPEAK NOW",
      debugClear: "CLEAR",
      debugClose: "CLOSE",
      debugHint: "If voice doesn't start: tap the page once and try again.",
      unlocked: "Audio unlocked (tap detected)."
    },
    uk: {
      firstTitle: "Увімкнути голосовий гід?",
      firstBody: "Гід підказує крок за кроком. Можеш вимкнути будь-коли.",
      enableGuide: "Увімкнути гід",
      enableVoice: "Увімкнути голос телефону",
      askAgain: "Питати лише під час першого запуску (рекомендовано)",
      ok: "OK",
      cancel: "Ні, дякую",
      toastOn: "Гід увімкнено",
      toastOff: "Гід вимкнено",
      voiceOn: "Голос увімкнено",
      voiceOff: "Голос вимкнено",
      debugTitle: "SerCucTech DEBUG",
      debugSpeak: "ГОВОРИ ЗАРАЗ",
      debugClear: "ОЧИСТИТИ",
      debugClose: "ЗАКРИТИ",
      debugHint: "Якщо голос не стартує: торкнись сторінки і спробуй ще раз.",
      unlocked: "Аудіо розблоковано (тап)."
    }
  };

  const T = I18N[LANG];

  function getBool(k, def = false) {
    const v = localStorage.getItem(k);
    if (v === null) return def;
    return v === "1";
  }
  function setBool(k, v) {
    localStorage.setItem(k, v ? "1" : "0");
  }

  // ---------- Debug overlay ----------
  let dbgBox = null;
  let dbgLog = null;

  function debugEnsure() {
    if (!DEBUG) return;
    if (dbgBox) return;

    dbgBox = document.createElement("div");
    dbgBox.style.cssText =
      "position:fixed;left:12px;right:12px;bottom:12px;z-index:999999;" +
      "background:rgba(11,18,32,.96);color:#e8eefc;border:1px solid rgba(255,255,255,.12);" +
      "border-radius:16px;box-shadow:0 18px 60px rgba(0,0,0,.55);padding:12px;font:600 13px system-ui;";

    dbgBox.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
        <div style="font:900 14px system-ui;">${T.debugTitle} — ${LANG}</div>
        <button id="sct_dbg_close" style="border:0;border-radius:10px;padding:8px 10px;background:#22345f;color:#fff;font:900 12px system-ui;">${T.debugClose}</button>
      </div>
      <div style="margin-top:8px;opacity:.9;">${T.debugHint}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
        <button id="sct_dbg_speak" style="border:0;border-radius:10px;padding:8px 10px;background:#5ee1a2;color:#082016;font:900 12px system-ui;">${T.debugSpeak}</button>
        <button id="sct_dbg_clear" style="border:0;border-radius:10px;padding:8px 10px;background:#22345f;color:#fff;font:900 12px system-ui;">${T.debugClear}</button>
      </div>
      <div id="sct_dbg_log" style="margin-top:10px;max-height:180px;overflow:auto;background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:10px;white-space:pre-wrap;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;"></div>
    `;

    document.body.appendChild(dbgBox);
    dbgLog = dbgBox.querySelector("#sct_dbg_log");

    dbgBox.querySelector("#sct_dbg_close").onclick = () => dbgBox.remove();
    dbgBox.querySelector("#sct_dbg_clear").onclick = () => (dbgLog.textContent = "");
    dbgBox.querySelector("#sct_dbg_speak").onclick = () => speak("Test voce SerCucTech. Se mi senti, la sintesi vocale funziona.");

    logDebug("DEBUG attivo. URL=" + location.href);
    logDebug("voiceEnabled=" + getBool(LS.voiceEnabled, true));
    logDebug("guideAdmin=" + getBool(LS.guideAdmin, true) + " guideVetrina=" + getBool(LS.guideVetrina, true) + " guideChecklist=" + getBool(LS.guideChecklist, true));
    logDebug("speechSynthesis in browser=" + (typeof speechSynthesis !== "undefined"));
  }

  function logDebug(msg) {
    if (!DEBUG) return;
    debugEnsure();
    const line = `[${new Date().toLocaleTimeString()}] ${msg}\n`;
    if (dbgLog) dbgLog.textContent += line;
  }

  // Catch errors
  window.addEventListener("error", (e) => logDebug("ERROR: " + (e.message || e.type)));
  window.addEventListener("unhandledrejection", (e) => logDebug("PROMISE: " + (e.reason?.message || e.reason || "unknown")));

  // ---------- Toast ----------
  function toast(msg) {
    let el = document.getElementById("sct_toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "sct_toast";
      el.style.cssText =
        "position:fixed;left:12px;right:12px;bottom:16px;z-index:99999;" +
        "background:rgba(17,27,46,.95);color:#fff;padding:12px 14px;border-radius:14px;" +
        "font:700 14px system-ui;box-shadow:0 10px 30px rgba(0,0,0,.35);";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.display = "block";
    clearTimeout(window.__sctToastT);
    window.__sctToastT = setTimeout(() => (el.style.display = "none"), 1800);
  }

  // ---------- Speech (with unlock) ----------
  let unlocked = false;

  function unlockAudioOnce() {
    if (unlocked) return;
    unlocked = true;
    logDebug(T.unlocked);
    // on some browsers, touching once helps TTS permission
    try {
      // tiny speak+cancel to prime (safe)
      const u = new SpeechSynthesisUtterance(" ");
      u.lang = navigator.language || "it-IT";
      speechSynthesis.speak(u);
      speechSynthesis.cancel();
    } catch (e) {}
  }

  document.addEventListener("pointerdown", unlockAudioOnce, { once: true });
  document.addEventListener("touchstart", unlockAudioOnce, { once: true });

  function speak(text, force = false) {
    try {
      if (!force && !getBool(LS.voiceEnabled, true)) {
        logDebug("speak skipped (voice disabled). text=" + text);
        return;
      }
      if (typeof speechSynthesis === "undefined") {
        logDebug("speechSynthesis not available.");
        return;
      }
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text || ""));
      u.lang = navigator.language || "it-IT";
      u.rate = 1;
      u.pitch = 1;
      u.onstart = () => logDebug("TTS start: " + text);
      u.onerror = (e) => logDebug("TTS error: " + (e.error || "unknown"));
      u.onend = () => logDebug("TTS end.");
      speechSynthesis.speak(u);
    } catch (e) {
      logDebug("speak exception: " + (e.message || e));
    }
  }

  function stopSpeak() {
    try { speechSynthesis.cancel(); } catch (e) {}
  }

  // ---------- First-run prompt ----------
  function firstRunPrompt() {
    const done = getBool(LS.firstRunDone, false);
    const ask = getBool(LS.askOnFirstRun, true);
    if (done || !ask) return;

    const wrap = document.createElement("div");
    wrap.style.cssText =
      "position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.55);" +
      "display:flex;align-items:center;justify-content:center;padding:18px;";

    const card = document.createElement("div");
    card.style.cssText =
      "max-width:520px;width:100%;background:#0b1220;color:#e8eefc;border-radius:18px;" +
      "padding:16px;box-shadow:0 18px 60px rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.08);";

    card.innerHTML = `
      <div style="font:900 18px system-ui;margin-bottom:6px;">${T.firstTitle}</div>
      <div style="font:600 14px system-ui;opacity:.9;line-height:1.35;margin-bottom:12px;">${T.firstBody}</div>

      <label style="display:flex;gap:10px;align-items:center;margin:10px 0;font:800 14px system-ui;">
        <input id="sct_first_enable" type="checkbox" checked>
        ${T.enableGuide}
      </label>

      <label style="display:flex;gap:10px;align-items:center;margin:10px 0;font:800 14px system-ui;">
        <input id="sct_first_voice" type="checkbox" checked>
        ${T.enableVoice}
      </label>

      <label style="display:flex;gap:10px;align-items:center;margin:10px 0;font:800 14px system-ui;opacity:.95;">
        <input id="sct_first_ask" type="checkbox" checked>
        ${T.askAgain}
      </label>

      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px;">
        <button id="sct_first_no" style="padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:transparent;color:#fff;font:900 14px system-ui;">
          ${T.cancel}
        </button>
        <button id="sct_first_ok" style="padding:10px 12px;border-radius:12px;border:0;background:#5ee1a2;color:#082016;font:900 14px system-ui;">
          ${T.ok}
        </button>
      </div>
    `;

    wrap.appendChild(card);
    document.body.appendChild(wrap);

    card.querySelector("#sct_first_no").onclick = () => {
      setBool(LS.firstRunDone, true);
      setBool(LS.askOnFirstRun, false);
      wrap.remove();
      toast(T.toastOff);
    };

    card.querySelector("#sct_first_ok").onclick = () => {
      const enable = card.querySelector("#sct_first_enable").checked;
      const voice = card.querySelector("#sct_first_voice").checked;
      const askAgain = card.querySelector("#sct_first_ask").checked;

      setBool(LS.guideAdmin, enable);
      setBool(LS.guideVetrina, enable);
      setBool(LS.guideChecklist, enable);
      setBool(LS.voiceEnabled, voice);

      setBool(LS.askOnFirstRun, askAgain);
      setBool(LS.firstRunDone, true);

      wrap.remove();
      toast(enable ? T.toastOn : T.toastOff);
      if (enable && voice) speak(T.toastOn, true);
      logDebug("FirstRun saved: enable=" + enable + " voice=" + voice + " askAgain=" + askAgain);
    };
  }

  // auto create debug overlay if requested
  if (DEBUG) {
    window.addEventListener("DOMContentLoaded", () => debugEnsure());
  }

  // Public API
  window.SCTGuide = {
    LS,
    LANG,
    T,
    DEBUG,
    getBool,
    setBool,
    toast,
    speak,
    stopSpeak,
    logDebug,
    firstRunPrompt
  };
})();
