(() => {
  "use strict";

  // ========= Helpers =========
  const $ = (id) => document.getElementById(id);

  function getParam(name) {
    const u = new URL(location.href);
    return u.searchParams.get(name);
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function safeJsonParse(str, fallback = null) {
    try { return JSON.parse(str); } catch { return fallback; }
  }

  function normalizePhone(phone) {
    // accetta "+39 333..." / "333..." / ecc
    const p = String(phone || "").trim();
    const digits = p.replace(/[^\d+]/g, "");
    if (digits.startsWith("+")) return digits;
    // se è italiano e manca +39, lo aggiungiamo
    if (/^\d{9,11}$/.test(digits)) return "+39" + digits;
    return digits;
  }

  function formatPhoneReadable(phone) {
    // solo per display leggibile
    const p = normalizePhone(phone).replace(/[^\d+]/g, "");
    if (p.startsWith("+39")) {
      const d = p.replace("+39", "");
      // 333 123 4567 (se 10 cifre) o 320 885 2858
      if (d.length === 10) return `+39 ${d.slice(0,3)} ${d.slice(3,6)} ${d.slice(6)}`;
      if (d.length === 9)  return `+39 ${d.slice(0,3)} ${d.slice(3,6)} ${d.slice(6)}`;
      return `+39 ${d}`;
    }
    return p;
  }

  function speakText(text, lang = "it-IT") {
    // SpeechSynthesis deve partire da gesto utente: noi lo chiamiamo solo su click
    stopSpeak();
    if (!("speechSynthesis" in window)) {
      alert("Questo telefono non supporta la sintesi vocale (TTS).");
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    window.speechSynthesis.speak(u);
  }

  function stopSpeak() {
    try {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    } catch {}
  }

  function buildWhatsAppLink(phone, message) {
    const p = normalizePhone(phone).replace(/[^\d+]/g, "");
    const digits = p.startsWith("+") ? p.slice(1) : p;
    return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  }

  function buildTelLink(phone) {
    const p = normalizePhone(phone);
    const digits = p.replace(/[^\d+]/g, "");
    return `tel:${digits}`;
  }

  function currentVetrinaLink(id) {
    const u = new URL(location.href);
    u.searchParams.set("id", id);
    return u.toString();
  }

  // ========= State =========
  let vetrina = null;
  let media = [];
  let idx = 0;

  let labelMode = false;
  let pinSize = 28;
  let pinsData = {}; // { mediaUrl: [ {x,y,n,size} ] }
  let tapCountTitle = 0;
  let tapTimer = null;

  // ========= Elements =========
  const pageTitle = $("pageTitle");
  const pageDesc = $("pageDesc");
  const badgeId = $("badgeId");

  const voicePanel = $("voicePanel");
  const voicePanelInner = $("voicePanelInner");
  const voiceText = $("voiceText");
  const contactsRow = $("contactsRow");

  const indexPanel = $("indexPanel");
  const indexList = $("indexList");
  const refreshIndexBtn = $("refreshIndexBtn");

  const heroImg = $("heroImg");
  const pinsLayer = $("pinsLayer");
  const prevBtn = $("prevBtn");
  const nextBtn = $("nextBtn");
  const imgCounter = $("imgCounter");
  const imgBadge = $("imgBadge");
  const thumbRow = $("thumbRow");
  const imgWrap = $("imgWrap");

  const waInfoBtn = $("waInfoBtn");
  const shareBtn = $("shareBtn");

  const homeBtn = $("homeBtn");
  const voiceBtn = $("voiceBtn");
  const stopBtn = $("stopBtn");
  const fullBtn = $("fullBtn");
  const themeBtn = $("themeBtn");
  const kioskBtn = $("kioskBtn");

  const labelCard = $("labelCard");
  const labelModeBadge = $("labelModeBadge");
  const labelToggleBtn = $("labelToggleBtn");
  const labelUndoBtn = $("labelUndoBtn");
  const labelClearBtn = $("labelClearBtn");
  const pinSizeRange = $("pinSizeRange");
  const pinSizeValue = $("pinSizeValue");
  const exportPinsBtn = $("exportPinsBtn");
  const copyPinsBtn = $("copyPinsBtn");
  const pinsJsonBox = $("pinsJsonBox");

  const waModal = $("waModal");
  const waModalText = $("waModalText");
  const waModalBtns = $("waModalBtns");
  const waCloseBtn = $("waCloseBtn");

  // ========= Load pins from localStorage =========
  function pinsStorageKey(vetrinaId) {
    return `SCT_PINS_${vetrinaId || "unknown"}`;
  }

  function loadPinsFromStorage(vId) {
    const raw = localStorage.getItem(pinsStorageKey(vId));
    const obj = safeJsonParse(raw, {});
    pinsData = obj && typeof obj === "object" ? obj : {};
  }

  function savePinsToStorage(vId) {
    localStorage.setItem(pinsStorageKey(vId), JSON.stringify(pinsData || {}));
  }

  // ========= Render pins =========
  function renderPinsForCurrent() {
    pinsLayer.innerHTML = "";
    const item = media[idx];
    if (!item) return;

    const list = pinsData[item.url] || [];
    for (const p of list) {
      const el = document.createElement("div");
      el.className = "pin";
      el.textContent = String(p.n);
      el.style.left = (p.x * 100) + "%";
      el.style.top = (p.y * 100) + "%";
      el.style.width = (p.size || pinSize) + "px";
      el.style.height = (p.size || pinSize) + "px";
      pinsLayer.appendChild(el);
    }
  }

  function addPinAtClientXY(clientX, clientY) {
    const item = media[idx];
    if (!item) return;

    const rect = heroImg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    // posizione relativa all'IMG (non al wrap)
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;

    if (x < 0 || x > 1 || y < 0 || y > 1) return;

    const list = pinsData[item.url] || [];
    const nextNumber = list.length ? Math.max(...list.map(a => a.n)) + 1 : 1;

    list.push({ x, y, n: nextNumber, size: pinSize });
    pinsData[item.url] = list;

    savePinsToStorage(vetrina.id);
    renderPinsForCurrent();
    refreshWhatsAppButton(); // messaggio include numeri pins
  }

  function undoPin() {
    const item = media[idx];
    if (!item) return;
    const list = pinsData[item.url] || [];
    list.pop();
    pinsData[item.url] = list;
    savePinsToStorage(vetrina.id);
    renderPinsForCurrent();
    refreshWhatsAppButton();
  }

  function clearPins() {
    const item = media[idx];
    if (!item) return;
    pinsData[item.url] = [];
    savePinsToStorage(vetrina.id);
    renderPinsForCurrent();
    refreshWhatsAppButton();
  }

  // ========= Gallery =========
  function setIndex(n) {
    if (!media.length) return;
    idx = (n + media.length) % media.length;
    const item = media[idx];

    heroImg.src = item.url;
    heroImg.alt = item.label || `Foto ${pad2(idx + 1)}`;

    imgCounter.textContent = `${pad2(idx + 1)}/${pad2(media.length)}`;
    imgBadge.textContent = pad2(idx + 1);

    // thumbs active
    [...thumbRow.querySelectorAll(".thumb")].forEach((t, i) => {
      t.classList.toggle("active", i === idx);
    });

    renderPinsForCurrent();
    refreshWhatsAppButton();
  }

  function buildThumbs() {
    thumbRow.innerHTML = "";
    media.forEach((m, i) => {
      const t = document.createElement("button");
      t.type = "button";
      t.className = "thumb";
      t.title = m.label || `Foto ${pad2(i + 1)}`;

      const im = document.createElement("img");
      im.src = m.url;
      im.alt = m.label || `Foto ${pad2(i + 1)}`;
      t.appendChild(im);

      t.addEventListener("click", () => setIndex(i), { passive: true });
      thumbRow.appendChild(t);
    });
  }

  // Swipe
  function enableSwipe() {
    let x0 = null, y0 = null;

    heroImg.addEventListener("touchstart", (e) => {
      const t = e.touches && e.touches[0];
      if (!t) return;
      x0 = t.clientX;
      y0 = t.clientY;
    }, { passive: true });

    heroImg.addEventListener("touchend", (e) => {
      if (x0 == null || y0 == null) return;
      const t = e.changedTouches && e.changedTouches[0];
      if (!t) return;

      const dx = t.clientX - x0;
      const dy = t.clientY - y0;

      // solo swipe orizzontale evidente
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) setIndex(idx + 1);
        else setIndex(idx - 1);
      }
      x0 = y0 = null;
    }, { passive: true });
  }

  // Fullscreen toggle
  function toggleFullscreen() {
    document.body.classList.toggle("fs");
  }

  // ========= WhatsApp request info =========
  function getPinsSummaryForCurrentPhoto() {
    const item = media[idx];
    if (!item) return "";
    const list = pinsData[item.url] || [];
    if (!list.length) return "Nessun numerino inserito.";
    const nums = list.map(p => p.n).sort((a,b)=>a-b);
    return `Numerini presenti: ${nums.join(", ")}.`;
  }

  function buildInfoMessage() {
    const item = media[idx];
    const photoNum = `${pad2(idx + 1)}/${pad2(media.length)}`;
    const link = currentVetrinaLink(vetrina.id);
    const pinsInfo = getPinsSummaryForCurrentPhoto();

    return `Ciao! Vorrei informazioni su questa foto (${photoNum}) della vetrina "${vetrina.title}".\n` +
           `Link: ${link}\n` +
           `${pinsInfo}\n` +
           `Mi interessa il numero (scrivilo qui):`;
  }

  function refreshWhatsAppButton() {
    // rende più visibile anche solo con testo
    if (!waInfoBtn) return;
    waInfoBtn.textContent = "WhatsApp: chiedi info su questa foto";
  }

  function openWaModal() {
    if (!vetrina) return;

    const msg = buildInfoMessage();
    waModalText.textContent = msg;

    waModalBtns.innerHTML = "";

    const contacts = Array.isArray(vetrina.contacts) ? vetrina.contacts : [];

    if (!contacts.length) {
      const p = document.createElement("div");
      p.style.color = "rgba(255,255,255,.8)";
      p.textContent = "Nessun contatto configurato nel JSON (contacts).";
      waModalBtns.appendChild(p);
    } else {
      // un bottone per ogni contatto
      for (const c of contacts) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "primary";
        b.textContent = `Invia a ${c.name}`;
        b.addEventListener("click", () => {
          const url = buildWhatsAppLink(c.phone, msg);
          window.open(url, "_blank");
        });
        waModalBtns.appendChild(b);
      }

      // "Entrambi" = mostra istruzione e apre uno (il secondo lo fai tu)
      if (contacts.length >= 2) {
        const both = document.createElement("button");
        both.type = "button";
        both.textContent = "Invia a entrambi (uno alla volta)";
        both.addEventListener("click", () => {
          const url1 = buildWhatsAppLink(contacts[0].phone, msg);
          window.open(url1, "_blank");
          alert(`Poi torna qui e premi anche "Invia a ${contacts[1].name}".`);
        });
        waModalBtns.appendChild(both);
      }
    }

    waModal.hidden = false;
  }

  function closeWaModal() {
    waModal.hidden = true;
  }

  // ========= Contacts chips =========
  function buildContacts() {
    contactsRow.innerHTML = "";
    const contacts = Array.isArray(vetrina.contacts) ? vetrina.contacts : [];

    for (const c of contacts) {
      const phoneDisp = formatPhoneReadable(c.phone);

      const wa = document.createElement("a");
      wa.className = "contactChip";
      wa.href = buildWhatsAppLink(c.phone, "Ciao!");
      wa.target = "_blank";
      wa.rel = "noopener";
      wa.innerHTML = `🟢 <b>${c.name}</b> <span>${phoneDisp}</span>`;

      const call = document.createElement("a");
      call.className = "contactChip";
      call.href = buildTelLink(c.phone);
      call.innerHTML = `📞 <b>${c.name}</b> <span>Chiama</span>`;

      contactsRow.appendChild(wa);
      contactsRow.appendChild(call);
    }
  }

  // ========= Index (altre vetrine) =========
  async function loadIndex() {
    try {
      const r = await fetch("data/vetrine.json?v=" + Date.now(), { cache: "no-store" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json();

      const list = Array.isArray(j.vetrine) ? j.vetrine : [];
      if (!list.length) {
        indexPanel.hidden = true;
        return;
      }

      indexList.innerHTML = "";
      for (const it of list) {
        const a = document.createElement("a");
        a.className = "indexLink";
        a.href = `vetrina.html?id=${encodeURIComponent(it.id)}&v=99`;
        a.innerHTML = `<span class="dot"></span><span>${it.title || it.id}</span>`;
        indexList.appendChild(a);
      }
      indexPanel.hidden = false;
    } catch (e) {
      // se fallisce, non bloccare nulla
      indexPanel.hidden = true;
      console.warn("Index load error:", e);
    }
  }

  // ========= Voice panel (click ovunque) =========
  function buildVoicePanel() {
    const v = vetrina.voice || {};
    const text = String(v.text || "").trim();
    if (!text) {
      voicePanel.hidden = true;
      return;
    }

    voiceText.textContent = text;
    voicePanel.hidden = false;

    const lang = v.lang || "it-IT";

    // click ovunque sul pannello => parla
    voicePanelInner.addEventListener("click", () => {
      // formatto i numeri lunghi con spazi per farli leggere meglio
      const spoken = text.replace(/(\+?\d[\d\s]{8,}\d)/g, (m) => {
        const digits = m.replace(/[^\d+]/g, "");
        // trasformo in: 3 3 3 2 9 2...
        const justDigits = digits.replace("+", "");
        return justDigits.split("").join(" ");
      });
      speakText(spoken, lang);
    });
  }

  // ========= Secret tap on title (5 taps) to show label tool =========
  function setupSecretLabelMode() {
    pageTitle.addEventListener("click", () => {
      tapCountTitle++;
      clearTimeout(tapTimer);
      tapTimer = setTimeout(() => (tapCountTitle = 0), 1000);

      if (tapCountTitle >= 5) {
        tapCountTitle = 0;
        labelCard.hidden = !labelCard.hidden;
      }
    });
  }

  function updateLabelUI() {
    labelModeBadge.textContent = labelMode ? "ON" : "OFF";
  }

  function setupLabelTool() {
    if (!pinSizeRange) return;

    pinSizeRange.addEventListener("input", () => {
      pinSize = Number(pinSizeRange.value || 28);
      pinSizeValue.textContent = String(pinSize);
      renderPinsForCurrent();
    });

    labelToggleBtn.addEventListener("click", () => {
      labelMode = !labelMode;
      updateLabelUI();
    });

    labelUndoBtn.addEventListener("click", () => {
      undoPin();
    });

    labelClearBtn.addEventListener("click", () => {
      if (confirm("Vuoi cancellare tutti i numerini di questa foto?")) clearPins();
    });

    exportPinsBtn.addEventListener("click", () => {
      const item = media[idx];
      if (!item) return;
      const out = {
        id: vetrina.id,
        photo: item.url,
        pins: pinsData[item.url] || []
      };
      pinsJsonBox.value = JSON.stringify(out, null, 2);
    });

    copyPinsBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(pinsJsonBox.value || "");
        alert("JSON copiato!");
      } catch {
        alert("Copia non riuscita. Seleziona il testo e copia manualmente.");
      }
    });

    // click su foto: se labelMode ON => aggiungi pin, altrimenti fullscreen
    heroImg.addEventListener("click", (e) => {
      if (labelMode) {
        addPinAtClientXY(e.clientX, e.clientY);
      } else {
        toggleFullscreen();
      }
    });
  }

  // ========= Bottom buttons =========
  function setupBottomBar() {
    prevBtn.addEventListener("click", () => setIndex(idx - 1));
    nextBtn.addEventListener("click", () => setIndex(idx + 1));

    waInfoBtn.addEventListener("click", openWaModal);
    waCloseBtn.addEventListener("click", closeWaModal);
    waModal.addEventListener("click", (e) => { if (e.target === waModal) closeWaModal(); });

    shareBtn.addEventListener("click", () => {
      const url = currentVetrinaLink(vetrina.id);
      const msg = `Guarda questa vetrina: ${vetrina.title}\n${url}`;
      const shareUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;
      window.open(shareUrl, "_blank");
    });

    homeBtn.addEventListener("click", () => location.href = "index.html?v=99");
    voiceBtn.addEventListener("click", () => {
      if (!vetrina?.voice?.text) return;
      voicePanelInner.click();
    });
    stopBtn.addEventListener("click", stopSpeak);
    fullBtn.addEventListener("click", toggleFullscreen);
    themeBtn.addEventListener("click", () => document.body.classList.toggle("themeAlt"));
    kioskBtn.addEventListener("click", () => document.body.classList.toggle("kiosk"));

    refreshIndexBtn.addEventListener("click", loadIndex);
  }

  // ========= Load vetrina JSON =========
  async function loadVetrina() {
    const id = getParam("id") || "";
    const vId = id.trim() || "renzo11";

    badgeId.textContent = `id: ${vId}`;

    // 1) prova data/ID.json
    let data = null;
    try {
      const r = await fetch(`data/${encodeURIComponent(vId)}.json?v=${Date.now()}`, { cache: "no-store" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      data = await r.json();
    } catch (e) {
      // 2) fallback: prova data/renzo11.json ecc senza bloccare tutta la pagina
      console.warn("Non riesco a leggere data/" + vId + ".json", e);
      pageTitle.textContent = "Errore";
      pageDesc.textContent = `Non riesco a leggere data/${vId}.json`;
      throw e;
    }

    vetrina = data;

    pageTitle.textContent = vetrina.title || vId;
    pageDesc.textContent = vetrina.description || "";
    badgeId.textContent = `id: ${vetrina.id || vId}`;

    // media
    media = Array.isArray(vetrina.media) ? vetrina.media.filter(x => x && x.type === "image" && x.url) : [];
    if (!media.length) {
      pageDesc.textContent = (pageDesc.textContent ? pageDesc.textContent + " — " : "") + "Nessuna immagine trovata.";
    }

    // pins local
    loadPinsFromStorage(vetrina.id);

    // voice + contacts
    buildVoicePanel();
    buildContacts();

    // index
    await loadIndex();

    // thumbs + show first
    buildThumbs();
    setIndex(0);
  }

  // ========= Start =========
  async function init() {
    // evita “blocchi” da service worker vecchi (se presenti)
    // (non distrugge l’app: semplicemente evita cache corrotta)
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(r => r.unregister());
      }).catch(()=>{});
    }

    setupSecretLabelMode();
    setupLabelTool();
    setupBottomBar();
    enableSwipe();

    try {
      await loadVetrina();
    } catch {
      // non bloccare i bottoni: almeno lascia la pagina viva
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
