/* SerCucTech - Guide Engine (voice + interactive steps)
   - Multi-language auto via device language
   - First-run prompt (ask enable guide yes/no)
   - Per-area toggles: admin / vetrina / checklist
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

  const lang = (navigator.language || "it-IT").toLowerCase();
  const L = lang.startsWith("uk") ? "uk" : lang.startsWith("en") ? "en" : "it";

  const T = {
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
      next: "Prossimo passo:",
      adminMode: "Guida Admin",
      vetrinaMode: "Guida Vetrina",
      checklistMode: "Guida Checklist",
      openGuide: "Apri guida",
      close: "Chiudi"
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
      next: "Next step:",
      adminMode: "Admin guide",
      vetrinaMode: "Showcase guide",
      checklistMode: "Checklist guide",
      openGuide: "Open guide",
      close: "Close"
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
      next: "Наступний крок:",
      adminMode: "Гід Admin",
      vetrinaMode: "Гід Вітрина",
      checklistMode: "Гід Checklist",
      openGuide: "Відкрити гід",
      close: "Закрити"
    }
  }[L];

  function getBool(k, def = false) {
    const v = localStorage.getItem(k);
    if (v === null) return def;
    return v === "1";
  }
  function setBool(k, v) {
    localStorage.setItem(k, v ? "1" : "0");
  }

  function speak(text) {
    if (!getBool(LS.voiceEnabled, true)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = navigator.language || "it-IT";
      u.rate = 1;
      u.pitch = 1;
      speechSynthesis.speak(u);
    } catch (e) {}
  }

  function toast(msg) {
    let el = document.getElementById("sct_toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "sct_toast";
      el.style.cssText =
        "position:fixed;left:12px;right:12px;bottom:16px;z-index:99999;" +
        "background:rgba(17,27,46,.95);color:#fff;padding:12px 14px;border-radius:14px;" +
        "font:600 14px system-ui;box-shadow:0 10px 30px rgba(0,0,0,.35);";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.display = "block";
    clearTimeout(window.__sctToastT);
    window.__sctToastT = setTimeout(() => (el.style.display = "none"), 1800);
  }

  function firstRunPrompt() {
    const done = getBool(LS.firstRunDone, false);
    const ask = getBool(LS.askOnFirstRun, true);
    if (done || !ask) return;

    const wrap = document.createElement("div");
    wrap.style.cssText =
      "position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:18px;";

    const card = document.createElement("div");
    card.style.cssText =
      "max-width:520px;width:100%;background:#0b1220;color:#e8eefc;border-radius:18px;" +
      "padding:16px;box-shadow:0 18px 60px rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.08);";

    card.innerHTML = `
      <div style="font:800 18px system-ui;margin-bottom:6px;">${T.firstTitle}</div>
      <div style="font:500 14px system-ui;opacity:.9;line-height:1.35;margin-bottom:12px;">${T.firstBody}</div>

      <label style="display:flex;gap:10px;align-items:center;margin:10px 0;font:700 14px system-ui;">
        <input id="sct_first_enable" type="checkbox" checked>
        ${T.enableGuide}
      </label>

      <label style="display:flex;gap:10px;align-items:center;margin:10px 0;font:700 14px system-ui;">
        <input id="sct_first_voice" type="checkbox" checked>
        ${T.enableVoice}
      </label>

      <label style="display:flex;gap:10px;align-items:center;margin:10px 0;font:700 14px system-ui;opacity:.95;">
        <input id="sct_first_ask" type="checkbox" checked>
        ${T.askAgain}
      </label>

      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px;">
        <button id="sct_first_no" style="padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:transparent;color:#fff;font:800 14px system-ui;">
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
    };

    card.querySelector("#sct_first_ok").onclick = () => {
      const enable = card.querySelector("#sct_first_enable").checked;
      const voice = card.querySelector("#sct_first_voice").checked;
      const askAgain = card.querySelector("#sct_first_ask").checked;

      // Enable guide everywhere (user can refine later)
      setBool(LS.guideAdmin, enable);
      setBool(LS.guideVetrina, enable);
      setBool(LS.guideChecklist, enable);
      setBool(LS.voiceEnabled, voice);

      setBool(LS.askOnFirstRun, askAgain);
      setBool(LS.firstRunDone, true);

      wrap.remove();
      toast(enable ? T.toastOn : T.toastOff);
      if (enable) speak(T.toastOn);
    };
  }

  // Public API
  window.SCTGuide = {
    LS,
    T,
    getBool,
    setBool,
    speak,
    toast,
    firstRunPrompt
  };
})();
