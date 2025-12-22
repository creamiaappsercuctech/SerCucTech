/* SerCucTech — app.js (vetrina)
   Fix: tasti sempre cliccabili, WA per foto (overlay), swipe, cache-safe, audio gate stabile.
*/

(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const els = {
    pageTitle: $("pageTitle"),
    pageDesc: $("pageDesc"),
    badgeId: $("badgeId"),

    voicePanel: $("voicePanel"),
    voicePanelInner: $("voicePanelInner"),
    voiceText: $("voiceText"),
    contactsRow: $("contactsRow"),

    indexPanel: $("indexPanel"),
    refreshIndexBtn: $("refreshIndexBtn"),
    indexList: $("indexList"),

    prevBtn: $("prevBtn"),
    nextBtn: $("nextBtn"),
    heroImg: $("heroImg"),
    imgCounter: $("imgCounter"),
    imgBadge: $("imgBadge"),
    thumbRow: $("thumbRow"),
    imgWrap: $("imgWrap"),

    waInfoBtn: $("waInfoBtn"),         // sotto foto
    waOnPhotoBtn: $("waOnPhotoBtn"),   // overlay sulla foto
    shareBtn: $("shareBtn"),

    homeBtn: $("homeBtn"),
    voiceBtn: $("voiceBtn"),
    stopBtn: $("stopBtn"),
    fullBtn: $("fullBtn"),
    themeBtn: $("themeBtn"),
    kioskBtn: $("kioskBtn"),

    audioGate: $("audioGate"),
    enableAudioBtn: $("enableAudioBtn"),
    noAudioBtn: $("noAudioBtn"),

    waModal: $("waModal"),
    waModalText: $("waModalText"),
    waModalBtns: $("waModalBtns"),
    waCloseBtn: $("waCloseBtn"),

    // numerini
    labelCard: $("labelCard"),
    labelModeBadge: $("labelModeBadge"),
    labelToggleBtn: $("labelToggleBtn"),
    labelUndoBtn: $("labelUndoBtn"),
    labelClearBtn: $("labelClearBtn"),
    pinSizeRange: $("pinSizeRange"),
    pinSizeValue: $("pinSizeValue"),
    exportPinsBtn: $("exportPinsBtn"),
    copyPinsBtn: $("copyPinsBtn"),
    pinsJsonBox: $("pinsJsonBox"),
  };

  // --------- utils
  function qs(name) {
    return new URLSearchParams(location.search).get(name);
  }
  function pad2(n) {
    return String(n).padStart(2, "0");
  }
  function safeText(s) {
    return (s ?? "").toString();
  }
  function nowTs() {
    return Date.now();
  }

  // --------- data
  const id = qs("id") || "scalvini10";
  els.badgeId.textContent = "id: " + id;

  let vetrina = null;
  let media = [];
  let idx = 0;

  // --------- speech
  let audioEnabled = false;
  let lastSpoken = "";
  let speaking = false;

  function canSpeak() {
    return "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
  }

  function speak(text, lang) {
    text = safeText(text).trim();
    if (!text) return;

    // blocco tipico mobile: serve gesture -> mostro gate
    if (!audioEnabled) {
      lastSpoken = text;
      showAudioGate();
      return;
    }

    if (!canSpeak()) return;

    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang || "it-IT";
      u.rate = 1;
      u.pitch = 1;
      u.volume = 1;

      speaking = true;
      u.onend = () => { speaking = false; };
      u.onerror = () => { speaking = false; };

      window.speechSynthesis.speak(u);
    } catch (e) {
      // se fallisce, riproponi gate
      lastSpoken = text;
      showAudioGate();
    }
  }

  function stopSpeak() {
    if (!canSpeak()) return;
    try { window.speechSynthesis.cancel(); } catch {}
    speaking = false;
  }

  function showAudioGate() {
    els.audioGate.hidden = false;
  }
  function hideAudioGate() {
    els.audioGate.hidden = true;
  }

  // --------- fetch helpers
  async function fetchJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} @ ${url}`);
    return res.json();
  }

  async function loadVetrinaJson() {
    // prova prima data/id.json poi id.json (compatibilità)
    const tries = [
      `data/${id}.json?ts=${nowTs()}`,
      `${id}.json?ts=${nowTs()}`
    ];

    let lastErr = null;
    for (const u of tries) {
      try {
        return await fetchJson(u);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("JSON non trovato");
  }

  async function loadIndexJson() {
    // prova data/vetrine.json poi vetrine.json poi index.json
    const tries = [
      `data/vetrine.json?ts=${nowTs()}`,
      `vetrine.json?ts=${nowTs()}`,
      `index.json?ts=${nowTs()}`
    ];
    for (const u of tries) {
      try {
        return await fetchJson(u);
      } catch {}
    }
    return null;
  }

  // --------- WhatsApp
  function normalizePhone(p) {
    return safeText(p).replace(/[^\d+]/g, "");
  }

  function waLink(phone, message) {
    const p = normalizePhone(phone).replace(/^\+/, "");
    const txt = encodeURIComponent(message);
    return `https://wa.me/${p}?text=${txt}`;
  }

  function openWaModal(message) {
    const contacts = Array.isArray(vetrina?.contacts) ? vetrina.contacts : [];
    if (!contacts.length) {
      alert("Nessun contatto WhatsApp configurato nella vetrina (contacts).");
      return;
    }

    els.waModalText.textContent = message;
    els.waModalBtns.innerHTML = "";

    // 1 bottone per ogni contatto
    contacts.forEach((c) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "primary";
      btn.textContent = `WhatsApp ${c.name || ""}`.trim();
      btn.addEventListener("click", () => {
        location.href = waLink(c.phone, message);
      });
      els.waModalBtns.appendChild(btn);
    });

    // bottone "a tutti" (apre 2 chat una dopo l'altra)
    if (contacts.length >= 2) {
      const btnAll = document.createElement("button");
      btnAll.type = "button";
      btnAll.textContent = "Invia a tutti (apre 2 chat)";
      btnAll.addEventListener("click", () => {
        // apre prima chat, poi seconda dopo 700ms (mobile)
        location.href = waLink(contacts[0].phone, message);
        setTimeout(() => {
          window.open(waLink(contacts[1].phone, message), "_blank");
        }, 700);
      });
      els.waModalBtns.appendChild(btnAll);
    }

    els.waModal.hidden = false;
  }

  function closeWaModal() {
    els.waModal.hidden = true;
  }

  // --------- render
  function setTitleTapUnlock() {
    // 5 tap sul titolo -> mostra tool numerini
    let taps = 0;
    let t0 = 0;
    els.pageTitle.addEventListener("click", () => {
      const t = Date.now();
      if (t - t0 > 1200) taps = 0;
      t0 = t;
      taps++;
      if (taps >= 5) {
        taps = 0;
        els.labelCard.hidden = !els.labelCard.hidden;
        els.labelModeBadge.textContent = els.labelCard.hidden ? "OFF" : "ON";
      }
    });
  }

  function renderContacts() {
    const contacts = Array.isArray(vetrina?.contacts) ? vetrina.contacts : [];
    els.contactsRow.innerHTML = "";
    contacts.forEach((c) => {
      const a = document.createElement("a");
      a.className = "contactChip";
      a.href = waLink(c.phone, `Ciao ${c.name || ""}, ti scrivo dalla vetrina ${vetrina?.title || id}.`);
      a.innerHTML = `💬 <b>${safeText(c.name || "WhatsApp")}</b> <span>${safeText(c.phone || "")}</span>`;
      a.target = "_blank";
      a.rel = "noopener";
      els.contactsRow.appendChild(a);

      const a2 = document.createElement("a");
      a2.className = "contactChip";
      a2.href = `tel:${normalizePhone(c.phone)}`;
      a2.innerHTML = `📞 <b>${safeText(c.name || "Chiama")}</b> <span>Chiama</span>`;
      els.contactsRow.appendChild(a2);
    });
  }

  function renderMedia() {
    if (!media.length) {
      els.heroImg.removeAttribute("src");
      els.imgCounter.textContent = "00/00";
      els.imgBadge.textContent = "00";
      return;
    }
    idx = Math.max(0, Math.min(idx, media.length - 1));

    const m = media[idx];
    const n = idx + 1;

    els.heroImg.src = m.url;
    els.heroImg.alt = m.label || `Foto ${pad2(n)}`;
    els.imgCounter.textContent = `${pad2(n)}/${pad2(media.length)}`;
    els.imgBadge.textContent = pad2(n);

    // evidenzia thumbs
    [...els.thumbRow.children].forEach((el, i) => {
      el.classList.toggle("active", i === idx);
    });

    // abilita overlay WA
    if (els.waOnPhotoBtn) els.waOnPhotoBtn.style.display = "inline-flex";
  }

  function renderThumbs() {
    els.thumbRow.innerHTML = "";
    media.forEach((m, i) => {
      const t = document.createElement("div");
      t.className = "thumb" + (i === idx ? " active" : "");
      const img = document.createElement("img");
      img.src = m.url;
      img.alt = m.label || `Thumb ${i + 1}`;
      t.appendChild(img);
      t.addEventListener("click", () => {
        idx = i;
        renderMedia();
      });
      els.thumbRow.appendChild(t);
    });
  }

  async function renderIndex() {
    const data = await loadIndexJson();
    if (!data) return;

    // supporta diversi formati
    const list = Array.isArray(data) ? data : (Array.isArray(data.vetrine) ? data.vetrine : []);
    if (!list.length) return;

    els.indexList.innerHTML = "";
    list.forEach((it) => {
      const vid = it.id || it;
      const title = it.title || vid;
      const a = document.createElement("a");
      a.className = "indexLink";
      a.href = `vetrina.html?id=${encodeURIComponent(vid)}`;
      a.innerHTML = `<span class="dot"></span> ${safeText(title)}`;
      els.indexList.appendChild(a);
    });

    els.indexPanel.hidden = false;
  }

  // --------- controls / events
  function goPrev() {
    if (!media.length) return;
    idx = (idx - 1 + media.length) % media.length;
    renderMedia();
  }
  function goNext() {
    if (!media.length) return;
    idx = (idx + 1) % media.length;
    renderMedia();
  }

  function setupSwipe() {
    let x0 = null;
    els.heroImg.addEventListener("touchstart", (e) => {
      if (!e.touches || !e.touches[0]) return;
      x0 = e.touches[0].clientX;
    }, { passive: true });

    els.heroImg.addEventListener("touchend", (e) => {
      if (x0 == null) return;
      const x1 = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientX : null;
      if (x1 == null) return;
      const dx = x1 - x0;
      x0 = null;
      if (Math.abs(dx) < 40) return;
      if (dx > 0) goPrev(); else goNext();
    }, { passive: true });
  }

  function setupFullscreenTap() {
    els.heroImg.addEventListener("click", () => {
      document.body.classList.toggle("fs");
    });
  }

  function setupButtons() {
    els.prevBtn.addEventListener("click", goPrev);
    els.nextBtn.addEventListener("click", goNext);

    const askPhoto = () => {
      const n = idx + 1;
      const msg = `Ciao! Vorrei info sulla foto ${pad2(n)}/${pad2(media.length)} della vetrina "${vetrina?.title || id}" (id: ${id}).`;
      openWaModal(msg);
    };

    els.waInfoBtn.addEventListener("click", askPhoto);
    if (els.waOnPhotoBtn) els.waOnPhotoBtn.addEventListener("click", askPhoto);

    els.shareBtn.addEventListener("click", () => {
      const msg = `Ciao! Ti mando la vetrina: ${location.href}`;
      // se c'è almeno un contatto, apri modale; altrimenti apri condivisione generica
      if (Array.isArray(vetrina?.contacts) && vetrina.contacts.length) openWaModal(msg);
      else location.href = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    });

    els.homeBtn.addEventListener("click", () => location.href = "index.html");
    els.voiceBtn.addEventListener("click", () => {
      speak(vetrina?.voiceText || vetrina?.description || vetrina?.title || id, vetrina?.voiceLang || "it-IT");
    });
    els.stopBtn.addEventListener("click", () => stopSpeak());
    els.fullBtn.addEventListener("click", () => document.body.classList.toggle("fs"));
    els.themeBtn.addEventListener("click", () => document.body.classList.toggle("altTheme"));
    els.kioskBtn.addEventListener("click", () => document.body.classList.toggle("kiosk"));

    els.voicePanelInner.addEventListener("click", () => {
      speak(vetrina?.voiceText || vetrina?.description || vetrina?.title || id, vetrina?.voiceLang || "it-IT");
    });

    els.refreshIndexBtn.addEventListener("click", () => renderIndex());

    // audio gate
    els.enableAudioBtn.addEventListener("click", () => {
      audioEnabled = true;
      hideAudioGate();
      if (lastSpoken) speak(lastSpoken, vetrina?.voiceLang || "it-IT");
    });
    els.noAudioBtn.addEventListener("click", () => hideAudioGate());

    // wa modal
    els.waCloseBtn.addEventListener("click", closeWaModal);
    els.waModal.addEventListener("click", (e) => {
      if (e.target === els.waModal) closeWaModal();
    });
  }

  // --------- numerini (semplice: overlay dal JSON, editor base locale)
  let pins = []; // {x,y,n}
  let pinSize = 28;
  let labelMode = false;

  function pinsKey() {
    return `pins_${id}_${idx}`;
  }

  function loadPinsLocal() {
    try {
      const s = localStorage.getItem(pinsKey());
      pins = s ? JSON.parse(s) : [];
    } catch { pins = []; }
  }
  function savePinsLocal() {
    try { localStorage.setItem(pinsKey(), JSON.stringify(pins)); } catch {}
  }

  function renderPins() {
    const layer = $("pinsLayer");
    if (!layer) return;
    layer.innerHTML = "";
    pins.forEach((p) => {
      const d = document.createElement("div");
      d.className = "pin";
      d.style.left = (p.x * 100) + "%";
      d.style.top = (p.y * 100) + "%";
      d.style.width = pinSize + "px";
      d.style.height = pinSize + "px";
      d.style.fontSize = Math.max(12, Math.round(pinSize * 0.45)) + "px";
      d.textContent = p.n;
      layer.appendChild(d);
    });
  }

  function setupLabels() {
    if (!els.labelToggleBtn) return;

    els.pinSizeRange.addEventListener("input", () => {
      pinSize = parseInt(els.pinSizeRange.value, 10) || 28;
      els.pinSizeValue.textContent = String(pinSize);
      renderPins();
    });

    els.labelToggleBtn.addEventListener("click", () => {
      labelMode = !labelMode;
      els.labelModeBadge.textContent = labelMode ? "ON" : "OFF";
    });

    els.labelUndoBtn.addEventListener("click", () => {
      pins.pop();
      savePinsLocal();
      renderPins();
      syncPinsBox();
    });

    els.labelClearBtn.addEventListener("click", () => {
      pins = [];
      savePinsLocal();
      renderPins();
      syncPinsBox();
    });

    function syncPinsBox() {
      if (!els.pinsJsonBox) return;
      els.pinsJsonBox.value = JSON.stringify(pins, null, 2);
    }

    els.exportPinsBtn.addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(pins, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${id}-foto${pad2(idx + 1)}-pins.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    });

    els.copyPinsBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(JSON.stringify(pins, null, 2));
        alert("Copiato!");
      } catch {
        alert("Non riesco a copiare (clipboard bloccato).");
      }
    });

    // click sulla foto per aggiungere pin (solo in labelMode)
    els.imgWrap.addEventListener("click", (e) => {
      if (!labelMode) return;
      const rect = els.imgWrap.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      const n = pins.length + 1;
      pins.push({ x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)), n });
      savePinsLocal();
      renderPins();
      els.pinsJsonBox.value = JSON.stringify(pins, null, 2);
    });

    // quando cambio foto ricarico pins locali di quella foto
    const oldRender = renderMedia;
    window.__renderMediaOverride = () => {}; // no-op
  }

  // --------- init
  async function init() {
    setTitleTapUnlock();

    try {
      vetrina = await loadVetrinaJson();

      els.pageTitle.textContent = vetrina.title || id;
      els.pageDesc.textContent = vetrina.description || "";

      // voice panel
      const voiceText = vetrina.voiceText || vetrina.description || "";
      if (voiceText.trim()) {
        els.voiceText.textContent = voiceText;
        renderContacts();
        els.voicePanel.hidden = false;
      }

      // media
      const arr = Array.isArray(vetrina.media) ? vetrina.media : [];
      media = arr
        .filter(m => m && (m.type === "image" || !m.type))
        .map((m) => ({
          url: m.url,
          label: m.label || ""
        }));

      if (!media.length) {
        // fallback: se hai "images" o "photos"
        const alt = Array.isArray(vetrina.images) ? vetrina.images : (Array.isArray(vetrina.photos) ? vetrina.photos : []);
        media = alt.map((u, i) => ({ url: u, label: `Foto ${pad2(i + 1)}` }));
      }

      // index
      renderIndex().catch(() => {});

      // build UI
      renderThumbs();
      renderMedia();

      setupButtons();
      setupSwipe();
      setupFullscreenTap();
      setupLabels();

      // pins init
      loadPinsLocal();
      renderPins();

    } catch (e) {
      els.pageTitle.textContent = "Errore";
      els.pageDesc.textContent = "Non riesco a leggere il JSON della vetrina.";
      console.error(e);
      alert(String(e.message || e));
    }
  }

  init();
})();
