/* ===================== SerCucTech Vetrina - app.js ===================== */
(() => {
  "use strict";

  const qs = (s) => document.querySelector(s);
  const qsa = (s) => Array.from(document.querySelectorAll(s));

  // --- Elements (dal tuo vetrina.html) ---
  const pageTitle = qs("#pageTitle");
  const pageDesc  = qs("#pageDesc");
  const badgeId   = qs("#badgeId");

  const voicePanel = qs("#voicePanel");
  const voiceTextEl = qs("#voiceText");
  const contactsRow = qs("#contactsRow");

  const heroImg = qs("#heroImg");
  const imgWrap = qs("#imgWrap");
  const mediaStage = qs("#mediaStage");
  const thumbRow = qs("#thumbRow");
  const imgCounter = qs("#imgCounter");
  const imgBadge = qs("#imgBadge");
  const prevBtn = qs("#prevBtn");
  const nextBtn = qs("#nextBtn");

  const filesCard = qs("#filesCard");
  const filesList = qs("#filesList");

  const shareBtn = qs("#shareBtn");

  const homeBtn = qs("#homeBtn");
  const voiceBtn = qs("#voiceBtn");
  const stopBtn = qs("#stopBtn");
  const fullBtn = qs("#fullBtn");

  const audioGate = qs("#audioGate");
  const enableAudioBtn = qs("#enableAudioBtn");
  const skipAudioBtn = qs("#skipAudioBtn");

  const pinsLayer = qs("#pinsLayer");

  // Label tool (nascosto)
  const labelCard = qs("#labelCard");
  const labelModeBadge = qs("#labelModeBadge");
  const labelToggleBtn = qs("#labelToggleBtn");
  const labelUndoBtn = qs("#labelUndoBtn");
  const labelClearBtn = qs("#labelClearBtn");
  const pinSizeRange = qs("#pinSizeRange");
  const pinSizeValue = qs("#pinSizeValue");
  const exportPinsBtn = qs("#exportPinsBtn");
  const copyPinsBtn = qs("#copyPinsBtn");
  const pinsJsonBox = qs("#pinsJsonBox");

  // --- State ---
  let vetrina = null;
  let media = [];
  let currentIndex = 0;

  let speechEnabled = false; // sblocco dopo gesto
  let lastSpokenText = "";

  // Fullscreen state (toggling)
  let isFull = false;

  // Manual pins
  let labelMode = false;
  let pinsData = {}; // { "mediaUrl": { size: 28, pins: [ {x,y,n} ] } }
  let pinSize = 28;

  // Tap counter to unlock label mode (5 taps)
  let titleTapCount = 0;
  let titleTapTimer = null;

  // WhatsApp row under photo
  let photoWaRow = null;
  let photoWaBtn = null;

  // ---- Helpers ----
  function getIdFromUrl() {
    const u = new URL(location.href);
    return (u.searchParams.get("id") || "").trim();
  }

  function safeText(x) {
    return (x ?? "").toString();
  }

  function formatPhoneForSpeech(phone) {
    const p = safeText(phone).replace(/\s+/g, "");
    if (!p) return "";
    const cleaned = p.replace(/[^\d+]/g, "");

    if (cleaned.startsWith("+39") && cleaned.length > 3) {
      const rest = cleaned.slice(3);
      const a = rest.slice(0, 3);
      const b = rest.slice(3, 6);
      const c = rest.slice(6);
      return `+39 ${a} ${b} ${c}`.trim();
    }

    const digits = cleaned.replace("+", "");
    const groups = digits.match(/.{1,3}/g) || [digits];
    return (cleaned.startsWith("+") ? "+" : "") + groups.join(" ");
  }

  function whatsappLink(phone, message) {
    const p = safeText(phone).replace(/[^\d]/g, "");
    const txt = encodeURIComponent(message || "");
    return `https://wa.me/${p}?text=${txt}`;
  }

  function telLink(phone) {
    return `tel:${safeText(phone).replace(/\s+/g, "")}`;
  }

  function showError(msg) {
    document.body.innerHTML = `
      <div style="padding:16px;font-family:system-ui;color:#111;background:#fff">
        <h1>Errore</h1>
        <p>${msg}</p>
      </div>
    `;
  }

  function stopSpeech() {
    try { window.speechSynthesis?.cancel(); } catch(e){}
  }

  function showAudioGate(on) {
    if (!audioGate) return;
    audioGate.hidden = !on;
  }

  function buildSpeakText() {
    const base = safeText(vetrina?.voice?.text || "").trim();
    const contacts = Array.isArray(vetrina?.contacts) ? vetrina.contacts : [];

    if (!contacts.length) return base;

    const spokenPhones = contacts
      .map(c => `${safeText(c.name)}: ${formatPhoneForSpeech(c.phone)}`)
      .filter(Boolean)
      .join(". ");

    return base ? `${base}. ${spokenPhones}.` : spokenPhones;
  }

  function speak(text, lang) {
    const t = safeText(text).trim();
    if (!t) return;

    if (!speechEnabled) {
      lastSpokenText = t;
      showAudioGate(true);
      return;
    }

    try {
      stopSpeech();
      const u = new SpeechSynthesisUtterance(t);
      u.lang = lang || "it-IT";
      u.rate = 1;
      u.pitch = 1;
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }

  function enableSpeechAndAutoPlay() {
    speechEnabled = true;
    showAudioGate(false);
    if (vetrina?.voice?.text) {
      speak(buildSpeakText(), vetrina.voice.lang || "it-IT");
    }
  }

  // ---- Load JSON ----
  async function loadVetrina(id) {
    const url = `data/${encodeURIComponent(id)}.json?ts=${Date.now()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Non riesco a leggere ${url}`);
    return await res.json();
  }

  // ---- Render ----
  function renderHeader() {
    const title = safeText(vetrina.title || "Vetrina");
    const desc  = safeText(vetrina.description || "");
    pageTitle.textContent = title;
    pageDesc.textContent = desc;
    badgeId.textContent = `id: ${safeText(vetrina.id || "-")}`;

    pageTitle.addEventListener("click", () => {
      titleTapCount++;
      clearTimeout(titleTapTimer);
      titleTapTimer = setTimeout(() => (titleTapCount = 0), 900);
      if (titleTapCount >= 5) {
        titleTapCount = 0;
        toggleLabelCard(true);
      }
    });
  }

  function renderVoicePanel() {
    const hasVoice = !!safeText(vetrina?.voice?.text).trim();
    const contacts = Array.isArray(vetrina?.contacts) ? vetrina.contacts : [];

    if (!hasVoice && !contacts.length) {
      voicePanel.hidden = true;
      return;
    }
    voicePanel.hidden = false;

    const msg = safeText(vetrina?.voice?.text || "");
    voiceTextEl.textContent = msg;

    voiceTextEl.addEventListener("click", () => {
      speak(buildSpeakText(), vetrina.voice?.lang || "it-IT");
    });

    contactsRow.innerHTML = "";
    contacts.forEach((c) => {
      const name = safeText(c.name || "Contatto");
      const phone = safeText(c.phone || "");
      if (!phone) return;

      const pill = document.createElement("a");
      pill.className = "contactPill";
      pill.href = whatsappLink(phone, `Ciao ${name}, ho visto la vetrina "${vetrina.title}". Vorrei informazioni.`);
      pill.target = "_blank";
      pill.rel = "noopener";

      const strong = document.createElement("strong");
      strong.textContent = `💬 ${name}`;

      const span = document.createElement("span");
      span.textContent = formatPhoneForSpeech(phone);

      pill.appendChild(strong);
      pill.appendChild(span);
      contactsRow.appendChild(pill);

      const call = document.createElement("a");
      call.className = "contactPill";
      call.href = telLink(phone);
      call.innerHTML = `<strong>📞 ${name}</strong><span>Chiama</span>`;
      contactsRow.appendChild(call);
    });
  }

  function renderThumbs() {
    thumbRow.innerHTML = "";
    media.forEach((m, idx) => {
      const t = document.createElement("div");
      t.className = "thumb" + (idx === currentIndex ? " active" : "");
      const img = document.createElement("img");
      img.alt = m.label || `Foto ${idx + 1}`;
      img.src = m.url;
      img.loading = "lazy";
      t.appendChild(img);
      t.addEventListener("click", () => goTo(idx));
      thumbRow.appendChild(t);
    });
  }

  function renderFiles() {
    const files = Array.isArray(vetrina.files) ? vetrina.files : [];
    if (!files.length) {
      filesCard.hidden = true;
      return;
    }
    filesCard.hidden = false;
    filesList.innerHTML = "";
    files.forEach((f) => {
      const row = document.createElement("div");
      row.className = "fileItem";
      const a = document.createElement("a");
      a.href = f.url;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = f.label || f.url;
      const meta = document.createElement("small");
      meta.textContent = f.type || "";
      row.appendChild(a);
      row.appendChild(meta);
      filesList.appendChild(row);
    });
  }

  function updateCounter() {
    const total = media.length || 1;
    const a = String(currentIndex + 1).padStart(2, "0");
    const b = String(total).padStart(2, "0");
    imgCounter.textContent = `${a}/${b}`;
    imgBadge.textContent = a;
  }

  function setActiveThumb() {
    const thumbs = qsa(".thumb");
    thumbs.forEach((t, i) => t.classList.toggle("active", i === currentIndex));
    const t = thumbs[currentIndex];
    if (t && t.scrollIntoView) {
      t.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }

  function renderPinsForCurrent() {
    pinsLayer.innerHTML = "";
    const item = media[currentIndex];
    if (!item) return;

    const key = item.url;
    const entry = pinsData[key];
    if (!entry || !Array.isArray(entry.pins)) return;

    const size = Number(entry.size || pinSize || 28);
    pinsLayer.style.setProperty("--pinSize", `${size}px`);

    entry.pins.forEach((p) => {
      const el = document.createElement("div");
      el.className = "pin";
      el.textContent = String(p.n);
      el.style.left = `${p.x * 100}%`;
      el.style.top  = `${p.y * 100}%`;
      pinsLayer.appendChild(el);
    });
  }

  function showImage(idx) {
    if (!media.length) return;

    currentIndex = (idx + media.length) % media.length;
    const item = media[currentIndex];

    heroImg.src = item.url;
    heroImg.alt = item.label || "Immagine vetrina";

    updateCounter();
    setActiveThumb();
    renderPinsForCurrent();

    updatePhotoWhatsAppButtonUnderPhoto();
  }

  function goTo(idx) { showImage(idx); }
  function next() { showImage(currentIndex + 1); }
  function prev() { showImage(currentIndex - 1); }

  // ---- Fullscreen toggle (tap on image) ----
  function toggleFull() {
    isFull = !isFull;
    if (isFull) {
      const el = mediaStage || imgWrap || heroImg;
      if (el?.requestFullscreen) {
        el.requestFullscreen().catch(() => {});
      } else {
        document.body.style.overflow = "hidden";
        mediaStage.style.position = "fixed";
        mediaStage.style.inset = "0";
        mediaStage.style.zIndex = "200";
        mediaStage.style.borderRadius = "0";
      }
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      } else {
        document.body.style.overflow = "";
        mediaStage.style.position = "";
        mediaStage.style.inset = "";
        mediaStage.style.zIndex = "";
        mediaStage.style.borderRadius = "";
      }
    }
  }

  // ---- Swipe support ----
  function attachSwipe() {
    let startX = 0;
    let startY = 0;
    let moved = false;

    heroImg.addEventListener("touchstart", (e) => {
      if (!e.touches?.length) return;
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      moved = false;
    }, { passive: true });

    heroImg.addEventListener("touchmove", (e) => {
      if (!e.touches?.length) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (Math.abs(dx) > 18 && Math.abs(dx) > Math.abs(dy)) moved = true;
    }, { passive: true });

    heroImg.addEventListener("touchend", (e) => {
      if (labelMode) return;
      if (!moved) return;

      const endX = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientX : startX;
      const dx = endX - startX;
      if (dx < -40) next();
      else if (dx > 40) prev();
    }, { passive: true });
  }

  // ✅ WhatsApp button UNDER ALL PHOTOS (sotto la foto)
  function ensurePhotoWaRow() {
    if (photoWaRow && photoWaBtn) return;

    const heroCard = qs(".heroCard");
    if (!heroCard) return;

    const hero = heroCard.querySelector(".hero");
    if (!hero) return;

    // crea riga sotto foto (sotto .hero e prima delle miniature)
    photoWaRow = document.createElement("div");
    photoWaRow.id = "photoWaRow";
    photoWaRow.style.margin = "12px 0 6px";
    photoWaRow.style.display = "flex";
    photoWaRow.style.justifyContent = "center";

    photoWaBtn = document.createElement("button");
    photoWaBtn.id = "photoWaBtn";
    photoWaBtn.className = "shareBtn";
    photoWaBtn.style.width = "min(520px, 92%)";
    photoWaBtn.style.padding = "12px 14px";
    photoWaBtn.style.borderRadius = "14px";
    photoWaBtn.style.fontWeight = "900";
    photoWaBtn.style.border = "1px solid rgba(255,255,255,.14)";
    photoWaBtn.style.background = "rgba(46,204,113,.20)";
    photoWaBtn.style.backdropFilter = "blur(10px)";
    photoWaBtn.style.webkitBackdropFilter = "blur(10px)";
    photoWaBtn.textContent = "💬 WhatsApp (Foto) • Chiedi info";

    photoWaRow.appendChild(photoWaBtn);

    // inserisci sotto hero (e sopra thumbRow)
    hero.insertAdjacentElement("afterend", photoWaRow);
  }

  function updatePhotoWhatsAppButtonUnderPhoto() {
    ensurePhotoWaRow();
    if (!photoWaBtn) return;

    photoWaBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const a = Array.isArray(vetrina?.contacts) ? vetrina.contacts : [];
      if (!a.length) {
        alert("Contatti non configurati nel JSON (contacts).");
        return;
      }

      const photoNum = String(currentIndex + 1).padStart(2, "0");
      const linkVetrina = location.href;
      const msg =
        `Ciao! Vorrei informazioni.\n` +
        `Vetrina: ${vetrina.title}\n` +
        `Foto #: ${photoNum}\n` +
        `Link: ${linkVetrina}\n\n` +
        `Scrivo per chiedere info sull’oggetto/numero che mi interessa.`;

      openWhatsAppChooser(a, msg);
    };
  }

  function openWhatsAppChooser(contacts, msg) {
    let modal = qs("#waChooser");
    if (modal) modal.remove();

    modal = document.createElement("div");
    modal.id = "waChooser";
    modal.style.position = "fixed";
    modal.style.inset = "0";
    modal.style.zIndex = "300";
    modal.style.background = "rgba(0,0,0,.55)";
    modal.style.display = "flex";
    modal.style.alignItems = "center";
    modal.style.justifyContent = "center";
    modal.style.padding = "16px";

    const card = document.createElement("div");
    card.style.width = "min(560px, 100%)";
    card.style.borderRadius = "18px";
    card.style.background = "rgba(14,22,37,.98)";
    card.style.border = "1px solid rgba(255,255,255,.14)";
    card.style.boxShadow = "0 12px 30px rgba(0,0,0,.45)";
    card.style.padding = "14px";

    const h = document.createElement("div");
    h.style.fontWeight = "900";
    h.style.fontSize = "16px";
    h.textContent = "Scegli a chi inviare su WhatsApp";
    card.appendChild(h);

    const p = document.createElement("div");
    p.style.marginTop = "6px";
    p.style.color = "rgba(255,255,255,.75)";
    p.style.fontSize = "13px";
    p.textContent = "WhatsApp non invia a 2 numeri insieme con un solo click: scegli Renzo o Sergio.";
    card.appendChild(p);

    const list = document.createElement("div");
    list.style.display = "flex";
    list.style.flexDirection = "column";
    list.style.gap = "10px";
    list.style.marginTop = "12px";

    contacts.forEach((c) => {
      const b = document.createElement("a");
      b.href = whatsappLink(c.phone, msg);
      b.target = "_blank";
      b.rel = "noopener";
      b.style.display = "block";
      b.style.textDecoration = "none";
      b.style.padding = "12px 12px";
      b.style.borderRadius = "14px";
      b.style.border = "1px solid rgba(255,255,255,.12)";
      b.style.background = "rgba(255,255,255,.06)";
      b.style.color = "#e9eef7";
      b.style.fontWeight = "900";
      b.textContent = `💬 ${c.name} • ${formatPhoneForSpeech(c.phone)}`;
      list.appendChild(b);
    });

    card.appendChild(list);

    const close = document.createElement("button");
    close.textContent = "Chiudi";
    close.style.marginTop = "12px";
    close.style.width = "100%";
    close.style.padding = "12px";
    close.style.borderRadius = "14px";
    close.style.border = "1px solid rgba(255,255,255,.12)";
    close.style.background = "rgba(255,255,255,.04)";
    close.style.color = "#e9eef7";
    close.style.fontWeight = "900";
    close.addEventListener("click", () => modal.remove());
    card.appendChild(close);

    modal.appendChild(card);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });

    document.body.appendChild(modal);
  }

  // ---- Bottom share button (share vetrina) ----
  function shareVetrina() {
    const link = location.href;
    const msg = `Guarda questa vetrina: ${vetrina?.title || "Vetrina"}\n${link}`;
    const a = Array.isArray(vetrina?.contacts) ? vetrina.contacts : [];

    if (a.length) {
      openWhatsAppChooser(a, msg);
      return;
    }

    if (navigator.share) {
      navigator.share({ title: vetrina?.title || "Vetrina", text: msg, url: link }).catch(() => {});
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
    }
  }

  // ---- Label tool (pins manuali) ----
  function storageKeyPins() {
    return `sercuctech_pins_${safeText(vetrina?.id || "noid")}`;
  }

  function loadPinsFromStorage() {
    try {
      const raw = localStorage.getItem(storageKeyPins());
      pinsData = raw ? JSON.parse(raw) : {};
    } catch {
      pinsData = {};
    }
  }

  function savePinsToStorage() {
    try {
      localStorage.setItem(storageKeyPins(), JSON.stringify(pinsData));
    } catch {}
  }

  function toggleLabelCard(forceOn) {
    const on = typeof forceOn === "boolean" ? forceOn : !labelCard.hidden;
    labelCard.hidden = !on;
  }

  function setLabelMode(on) {
    labelMode = !!on;
    labelModeBadge.textContent = labelMode ? "ON" : "OFF";
    labelModeBadge.style.color = labelMode ? "rgba(56,210,122,.95)" : "rgba(255,255,255,.6)";
  }

  function getCurrentPinsEntry() {
    const item = media[currentIndex];
    if (!item) return null;
    const key = item.url;
    if (!pinsData[key]) {
      pinsData[key] = { size: pinSize, pins: [] };
    }
    if (!pinsData[key].pins) pinsData[key].pins = [];
    return pinsData[key];
  }

  function placePinAtClientXY(clientX, clientY) {
    const rect = heroImg.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;

    if (x < 0 || x > 1 || y < 0 || y > 1) return;

    const entry = getCurrentPinsEntry();
    if (!entry) return;

    entry.size = pinSize;
    const nextN = (entry.pins.length ? Math.max(...entry.pins.map(p => p.n)) : 0) + 1;

    entry.pins.push({ x, y, n: nextN });
    savePinsToStorage();
    renderPinsForCurrent();
  }

  function undoPin() {
    const entry = getCurrentPinsEntry();
    if (!entry || !entry.pins.length) return;
    entry.pins.pop();
    savePinsToStorage();
    renderPinsForCurrent();
  }

  function clearPins() {
    const item = media[currentIndex];
    if (!item) return;
    delete pinsData[item.url];
    savePinsToStorage();
    renderPinsForCurrent();
  }

  function exportPinsJSON() {
    const out = JSON.stringify(pinsData, null, 2);
    pinsJsonBox.value = out;
  }

  async function copyPinsJSON() {
    exportPinsJSON();
    try {
      await navigator.clipboard.writeText(pinsJsonBox.value);
      alert("JSON copiato!");
    } catch {
      pinsJsonBox.select();
      document.execCommand("copy");
      alert("JSON copiato!");
    }
  }

  // ---- Events ----
  function bindEvents() {
    prevBtn.addEventListener("click", prev);
    nextBtn.addEventListener("click", next);

    heroImg.addEventListener("click", (e) => {
      if (labelMode) {
        placePinAtClientXY(e.clientX, e.clientY);
        return;
      }
      toggleFull();
    });

    heroImg.addEventListener("touchend", (e) => {
      if (!labelMode) return;
      const t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      placePinAtClientXY(t.clientX, t.clientY);
    }, { passive: true });

    attachSwipe();

    shareBtn.addEventListener("click", shareVetrina);

    homeBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
    voiceBtn.addEventListener("click", () => speak(buildSpeakText(), vetrina?.voice?.lang || "it-IT"));
    stopBtn.addEventListener("click", stopSpeech);
    fullBtn.addEventListener("click", toggleFull);

    enableAudioBtn.addEventListener("click", enableSpeechAndAutoPlay);
    skipAudioBtn.addEventListener("click", () => showAudioGate(false));

    labelToggleBtn.addEventListener("click", () => setLabelMode(!labelMode));
    labelUndoBtn.addEventListener("click", undoPin);
    labelClearBtn.addEventListener("click", () => {
      if (confirm("Vuoi cancellare tutti i numerini di questa foto?")) clearPins();
    });

    pinSizeRange.addEventListener("input", () => {
      pinSize = Number(pinSizeRange.value || 28);
      pinSizeValue.textContent = String(pinSize);
      const entry = getCurrentPinsEntry();
      if (entry) {
        entry.size = pinSize;
        savePinsToStorage();
        renderPinsForCurrent();
      }
    });

    exportPinsBtn.addEventListener("click", exportPinsJSON);
    copyPinsBtn.addEventListener("click", copyPinsJSON);

    document.addEventListener("fullscreenchange", () => {
      if (!document.fullscreenElement) isFull = false;
    });

    voicePanel.addEventListener("click", (e) => {
      const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
      if (tag === "a" || tag === "button") return;
      speak(buildSpeakText(), vetrina?.voice?.lang || "it-IT");
    });
  }

  // ---- Boot ----
  async function boot() {
    const id = getIdFromUrl();
    if (!id) {
      showError("Manca parametro id. Esempio: vetrina.html?id=renzo11");
      return;
    }

    try {
      vetrina = await loadVetrina(id);
    } catch (e) {
      showError(safeText(e.message || e));
      return;
    }

    const rawMedia = Array.isArray(vetrina.media) ? vetrina.media : [];
    media = rawMedia
      .filter(m => m && m.type === "image" && m.url)
      .map(m => ({ url: m.url, label: m.label || "" }));

    if (!media.length) {
      showError("Questa vetrina non ha immagini in 'media'.");
      return;
    }

    loadPinsFromStorage();

    renderHeader();
    renderVoicePanel();
    renderFiles();
    renderThumbs();
    bindEvents();

    showImage(0);
    showAudioGate(false);
  }

  boot();
})();
