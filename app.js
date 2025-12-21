/* =========================================================
   SerCucTech Vetrina - app.js
   - Fix audio su Android (SpeechSynthesis unlock + retry)
   - WhatsApp molto visibile su ogni foto
   - Click su testo messaggio = avvia audio
   ========================================================= */

(function () {
  const $ = (id) => document.getElementById(id);

  const els = {
    pageTitle: $("pageTitle"),
    pageDesc: $("pageDesc"),
    badgeId: $("badgeId"),

    voicePanel: $("voicePanel"),
    voiceText: $("voiceText"),
    contactsRow: $("contactsRow"),

    prevBtn: $("prevBtn"),
    nextBtn: $("nextBtn"),
    heroImg: $("heroImg"),
    imgCounter: $("imgCounter"),
    imgBadge: $("imgBadge"),
    thumbRow: $("thumbRow"),
    mediaStage: $("mediaStage"),
    imgWrap: $("imgWrap"),

    // bottom bar
    homeBtn: $("homeBtn"),
    voiceBtn: $("voiceBtn"),
    stopBtn: $("stopBtn"),
    fullBtn: $("fullBtn"),
    themeBtn: $("themeBtn"),
    kioskBtn: $("kioskBtn"),

    // audio gate
    audioGate: $("audioGate"),
    enableAudioBtn: $("enableAudioBtn"),
    skipAudioBtn: $("skipAudioBtn"),

    // share
    shareBtn: $("shareBtn"),
  };

  // ---------- State ----------
  let data = null;
  let media = [];
  let idx = 0;

  // SpeechSynthesis
  let audioUnlocked = false;
  let speaking = false;
  let currentUtter = null;

  // WhatsApp overlay button (creato runtime)
  let waOverlayBtn = null;

  // ---------- Helpers ----------
  function qs(name) {
    return new URLSearchParams(location.search).get(name);
  }

  function cacheBust() {
    return "v=" + Date.now();
  }

  function normalizePhone(raw) {
    if (!raw) return "";
    // tieni + e cifre
    const s = String(raw).trim().replace(/[^\d+]/g, "");
    // se è senza + e inizia con 3 e 10 cifre, aggiungi +39
    if (!s.startsWith("+") && s.length === 10 && s.startsWith("3")) return "+39" + s;
    return s;
  }

  function formatPhoneForRead(phone) {
    // per farla pronunciare “a gruppi”, meglio mettere spazi
    // es: +393332927842 -> +39 333 292 7842
    const p = normalizePhone(phone).replace(/^\+/, "");
    if (p.startsWith("39") && p.length >= 12) {
      const rest = p.slice(2);
      const a = rest.slice(0, 3);
      const b = rest.slice(3, 6);
      const c = rest.slice(6, 10);
      return `+39 ${a} ${b} ${c}`;
    }
    // fallback: separa ogni 3-4 cifre
    return normalizePhone(phone).replace(/(\d{3})(?=\d)/g, "$1 ");
  }

  function buildWhatsAppLink(phone, message) {
    const p = normalizePhone(phone).replace("+", "");
    const text = encodeURIComponent(message || "");
    return `https://wa.me/${p}?text=${text}`;
  }

  function buildCallLink(phone) {
    return `tel:${normalizePhone(phone)}`;
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  // ---------- Audio unlock + speak ----------
  function showAudioGate() {
    if (!els.audioGate) return;
    els.audioGate.hidden = false;
  }
  function hideAudioGate() {
    if (!els.audioGate) return;
    els.audioGate.hidden = true;
  }

  function pickVoice(lang) {
    const voices = window.speechSynthesis?.getVoices?.() || [];
    if (!voices.length) return null;

    // prova match stretto
    let v = voices.find((x) => (x.lang || "").toLowerCase() === (lang || "").toLowerCase());
    if (v) return v;

    // prova match per prefisso (it-IT -> it)
    const pref = (lang || "").split("-")[0]?.toLowerCase();
    if (pref) {
      v = voices.find((x) => (x.lang || "").toLowerCase().startsWith(pref));
      if (v) return v;
    }
    return voices[0] || null;
  }

  async function unlockAudioAndSpeak() {
    audioUnlocked = true;
    hideAudioGate();

    // trucco Android: “warm-up” con utterance vuoto/cortissimo
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      u.rate = 1;
      u.pitch = 1;
      window.speechSynthesis.speak(u);
      window.speechSynthesis.cancel();
    } catch (e) {}

    // aspetta un attimo e poi parla
    setTimeout(() => speakVoiceText(), 120);
  }

  function speak(text, lang) {
    if (!("speechSynthesis" in window)) {
      alert("Il tuo browser non supporta la voce.");
      return;
    }
    if (!audioUnlocked) {
      showAudioGate();
      return;
    }

    const finalText = String(text || "").trim();
    if (!finalText) return;

    // stop eventuale parlato
    try {
      window.speechSynthesis.cancel();
    } catch (e) {}

    speaking = true;

    const utter = new SpeechSynthesisUtterance(finalText);
    currentUtter = utter;

    // voce
    const voice = pickVoice(lang || "it-IT");
    if (voice) utter.voice = voice;
    utter.lang = (lang || voice?.lang || "it-IT");

    utter.rate = 1.0;
    utter.pitch = 1.0;
    utter.volume = 1.0;

    utter.onend = () => {
      speaking = false;
      currentUtter = null;
      // chiude eventuale popup testo se lo vuoi: qui no
    };
    utter.onerror = () => {
      speaking = false;
      currentUtter = null;

      // retry dopo caricamento voci (Android a volte)
      setTimeout(() => {
        try {
          const v2 = pickVoice(lang || "it-IT");
          if (v2) utter.voice = v2;
          window.speechSynthesis.speak(utter);
        } catch (e) {}
      }, 250);
    };

    // **Importantissimo**: a volte serve attendere voiceschanged
    const voices = window.speechSynthesis.getVoices();
    if (!voices || !voices.length) {
      window.speechSynthesis.onvoiceschanged = () => {
        try {
          const v3 = pickVoice(lang || "it-IT");
          if (v3) utter.voice = v3;
          window.speechSynthesis.speak(utter);
        } catch (e) {}
      };
      // prova anche subito
      try { window.speechSynthesis.speak(utter); } catch (e) {}
    } else {
      try { window.speechSynthesis.speak(utter); } catch (e) {}
    }
  }

  function stopSpeak() {
    try { window.speechSynthesis.cancel(); } catch (e) {}
    speaking = false;
    currentUtter = null;
  }

  function speakVoiceText() {
    if (!data?.voice?.text) return;
    speak(data.voice.text, data.voice.lang || "it-IT");
  }

  // ---------- UI render ----------
  function setTitleAndDesc() {
    els.pageTitle.textContent = data?.title || "Vetrina";
    els.pageDesc.textContent = data?.description || "";
    els.badgeId.textContent = `id: ${data?.id || "-"}`;

    // voice panel
    if (data?.voice?.text) {
      els.voicePanel.hidden = false;

      // Nel testo visibile: evidenzia numeri come link WA/call sotto
      els.voiceText.innerHTML = escapeHtml(data.voice.text);

      // click ovunque sul pannello -> audio
      els.voicePanel.onclick = () => {
        if (!audioUnlocked) showAudioGate();
        else speakVoiceText();
      };
      els.voiceText.onclick = () => {
        if (!audioUnlocked) showAudioGate();
        else speakVoiceText();
      };
    } else {
      els.voicePanel.hidden = true;
    }
  }

  function renderContacts() {
    const c = Array.isArray(data?.contacts) ? data.contacts : [];

    els.contactsRow.innerHTML = "";
    if (!c.length) return;

    c.forEach((x) => {
      const name = x.name || "Contatto";
      const phone = normalizePhone(x.phone || "");
      const chip = document.createElement("a");
      chip.className = "contactChip";
      chip.href = buildWhatsAppLink(phone, `Ciao ${name}, vorrei informazioni sulla vetrina "${data.title}".`);
      chip.target = "_blank";
      chip.rel = "noopener";

      chip.innerHTML = `🟢 <b>${escapeHtml(name)}</b> <span style="opacity:.9">${escapeHtml(phone)}</span>`;

      const call = document.createElement("a");
      call.className = "contactChip";
      call.href = buildCallLink(phone);
      call.innerHTML = `📞 <b>${escapeHtml(name)}</b> <span style="opacity:.9">Chiama</span>`;

      els.contactsRow.appendChild(chip);
      els.contactsRow.appendChild(call);
    });
  }

  function ensureWaOverlayBtn() {
    if (waOverlayBtn) return;
    waOverlayBtn = document.createElement("button");
    waOverlayBtn.className = "waOnPhoto";
    waOverlayBtn.type = "button";
    waOverlayBtn.textContent = "🟢 WhatsApp: chiedi info su questa foto";
    waOverlayBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openWhatsAppChooser();
    });
    els.mediaStage.appendChild(waOverlayBtn);
  }

  function openWhatsAppChooser() {
    const contacts = Array.isArray(data?.contacts) ? data.contacts : [];
    if (!contacts.length) {
      alert("Nessun contatto WhatsApp configurato in JSON (contacts).");
      return;
    }

    const item = media[idx];
    const photoLabel = item?.label || `Foto ${String(idx + 1).padStart(2, "0")}`;
    const photoUrlAbs = new URL(item?.url || "", location.href).href;

    const msg =
      `Ciao! Chiedo informazioni per la vetrina "${data.title}".\n` +
      `Foto: ${photoLabel}\n` +
      `Link foto: ${photoUrlAbs}\n` +
      `Domanda: (scrivi qui cosa ti interessa)`;

    // MODALE con 2 bottoni (unico tasto sulla foto -> scelta contatto)
    const modal = document.createElement("div");
    modal.className = "waModal";
    modal.innerHTML = `
      <div class="waModalCard">
        <div class="waModalTitle">Invia richiesta WhatsApp</div>
        <div class="waModalText">${escapeHtml(msg)}</div>
        <div class="waModalBtns" id="waBtns"></div>
        <div style="margin-top:10px; font-size:12px; color:rgba(255,255,255,.7)">
          Tip: se vuoi, modifica il testo direttamente in WhatsApp prima di inviare.
        </div>
      </div>
    `;
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });

    const btns = modal.querySelector("#waBtns");
    contacts.slice(0, 4).forEach((c) => {
      const b = document.createElement("button");
      b.className = "primary";
      b.type = "button";
      const name = c.name || "Contatto";
      b.textContent = `Apri WhatsApp: ${name}`;
      b.onclick = () => {
        const url = buildWhatsAppLink(c.phone, msg);
        window.open(url, "_blank", "noopener");
        modal.remove();
      };
      btns.appendChild(b);
    });

    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "Chiudi";
    close.onclick = () => modal.remove();
    close.className = "";
    btns.appendChild(close);

    document.body.appendChild(modal);
  }

  function renderThumbs() {
    els.thumbRow.innerHTML = "";
    media.forEach((m, i) => {
      const t = document.createElement("button");
      t.className = "thumb" + (i === idx ? " active" : "");
      t.type = "button";
      t.innerHTML = `<img src="${m.url}" alt="thumb ${i + 1}">`;
      t.onclick = () => {
        idx = i;
        renderImage();
      };
      els.thumbRow.appendChild(t);
    });
  }

  function renderImage() {
    if (!media.length) return;

    const item = media[idx];
    els.heroImg.src = item.url;
    els.heroImg.alt = item.label || `Foto ${idx + 1}`;

    els.imgCounter.textContent = `${String(idx + 1).padStart(2, "0")}/${String(media.length).padStart(2, "0")}`;
    els.imgBadge.textContent = String(idx + 1).padStart(2, "0");

    // evidenzia thumb attivo
    [...els.thumbRow.children].forEach((c, i) => {
      c.classList.toggle("active", i === idx);
    });

    ensureWaOverlayBtn();
  }

  function next() {
    if (!media.length) return;
    idx = (idx + 1) % media.length;
    renderImage();
  }

  function prev() {
    if (!media.length) return;
    idx = (idx - 1 + media.length) % media.length;
    renderImage();
  }

  function toggleFullscreen() {
    // usa la tua classe già presente in CSS: fullscreenMode
    document.body.classList.toggle("fullscreenMode");
  }

  function setupEvents() {
    els.nextBtn.onclick = next;
    els.prevBtn.onclick = prev;

    // Tap foto = fullscreen toggle
    els.heroImg.addEventListener("click", () => toggleFullscreen());

    // Bottom bar
    if (els.voiceBtn) els.voiceBtn.onclick = () => {
      if (!audioUnlocked) showAudioGate();
      else speakVoiceText();
    };

    if (els.stopBtn) els.stopBtn.onclick = () => stopSpeak();

    if (els.fullBtn) els.fullBtn.onclick = () => toggleFullscreen();

    if (els.homeBtn) els.homeBtn.onclick = () => {
      // torna a index o root
      location.href = "./";
    };

    // Share (vetrina)
    if (els.shareBtn) {
      els.shareBtn.onclick = () => {
        const url = location.href;
        const msg = `Guarda questa vetrina: ${data?.title || "Vetrina"}\n${url}`;
        const wa = `https://wa.me/?text=${encodeURIComponent(msg)}`;
        window.open(wa, "_blank", "noopener");
      };
    }

    // Audio gate
    if (els.enableAudioBtn) {
      els.enableAudioBtn.onclick = () => unlockAudioAndSpeak();
    }
    if (els.skipAudioBtn) {
      els.skipAudioBtn.onclick = () => hideAudioGate();
    }

    // se l'utente fa un tap qualsiasi, possiamo “pre-sbloccare” ma senza parlare
    document.addEventListener("touchend", () => {
      // non forziamo, ma aiutiamo voci a caricare
      try { window.speechSynthesis.getVoices(); } catch (e) {}
    }, { passive: true });
  }

  // ---------- Load JSON ----------
  async function loadData() {
    const id = qs("id") || "renzo11";
    els.badgeId.textContent = `id: ${id}`;

    const url = `data/${id}.json?${cacheBust()}`;
    let res;
    try {
      res = await fetch(url, { cache: "no-store" });
    } catch (e) {
      throw new Error(`Errore rete: non riesco a caricare ${url}`);
    }
    if (!res.ok) throw new Error(`Non riesco a leggere ${url} (HTTP ${res.status})`);

    const j = await res.json();
    return j;
  }

  function prepareMedia() {
    const arr = Array.isArray(data?.media) ? data.media : [];
    // solo immagini per ora
    media = arr.filter((m) => m && m.type === "image" && m.url);
    if (!media.length) {
      media = [{ type: "image", url: "media/placeholder.jpg", label: "Nessuna immagine" }];
    }
    idx = 0;
  }

  async function init() {
    setupEvents();

    try {
      data = await loadData();

      // compat: se contacts non c'è, prova a estrarre dai testi (non obbligatorio)
      if (!Array.isArray(data.contacts)) data.contacts = [];

      setTitleAndDesc();
      renderContacts();

      prepareMedia();
      renderThumbs();
      renderImage();

      // Se c'è testo audio, mostra gate subito
      if (data?.voice?.text) showAudioGate();
      else hideAudioGate();

    } catch (err) {
      els.pageTitle.textContent = "Errore";
      els.pageDesc.textContent = err.message || String(err);
      hideAudioGate();
      console.error(err);
    }
  }

  init();
})();
