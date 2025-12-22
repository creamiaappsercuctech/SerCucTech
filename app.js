/* SerCucTech Vetrina - app.js
   ✅ anti-blocco overlay
   ✅ whatsapp per foto (sotto + sopra)
   ✅ click + touch sempre
   ✅ modalità numerini con export JSON + PNG
*/
(function () {
  "use strict";

  // ---------------------------
  // Helpers
  // ---------------------------
  const $ = (id) => document.getElementById(id);

  function onTap(el, fn) {
    if (!el) return;
    el.addEventListener("click", (e) => { e.preventDefault(); fn(e); }, { passive: false });
    el.addEventListener("touchstart", (e) => { fn(e); }, { passive: true });
  }

  function qsParam(name, fallback = "") {
    const u = new URL(location.href);
    return u.searchParams.get(name) || fallback;
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  // ---------------------------
  // Elements
  // ---------------------------
  const pageTitle = $("pageTitle");
  const pageDesc = $("pageDesc");
  const badgeId = $("badgeId");

  const voicePanel = $("voicePanel");
  const voicePanelInner = $("voicePanelInner");
  const voiceText = $("voiceText");
  const contactsRow = $("contactsRow");

  const indexPanel = $("indexPanel");
  const refreshIndexBtn = $("refreshIndexBtn");
  const indexList = $("indexList");

  const prevBtn = $("prevBtn");
  const nextBtn = $("nextBtn");
  const heroImg = $("heroImg");
  const imgCounter = $("imgCounter");
  const imgBadge = $("imgBadge");
  const thumbRow = $("thumbRow");

  const waInfoBtn = $("waInfoBtn");
  const waOnPhotoBtn = $("waOnPhotoBtn");
  const shareBtn = $("shareBtn");

  const waModal = $("waModal");
  const waModalText = $("waModalText");
  const waModalBtns = $("waModalBtns");
  const waCloseBtn = $("waCloseBtn");

  const homeBtn = $("homeBtn");
  const voiceBtn = $("voiceBtn");
  const stopBtn = $("stopBtn");
  const fullBtn = $("fullBtn");
  const themeBtn = $("themeBtn");
  const kioskBtn = $("kioskBtn");

  // numerini tool
  const labelCard = $("labelCard");
  const labelModeBadge = $("labelModeBadge");
  const labelToggleBtn = $("labelToggleBtn");
  const labelUndoBtn = $("labelUndoBtn");
  const labelClearBtn = $("labelClearBtn");
  const pinSizeRange = $("pinSizeRange");
  const pinSizeValue = $("pinSizeValue");
  const pinsLayer = $("pinsLayer");
  const pinsJsonBox = $("pinsJsonBox");
  const exportPinsBtn = $("exportPinsBtn");
  const copyPinsBtn = $("copyPinsBtn");
  const exportPngBtn = $("exportPngBtn");

  // ---------------------------
  // Data model (fallback)
  // ---------------------------
  const id = qsParam("id", "renzo11");
  const DATA_URL = `data/vetrine.json?v=${qsParam("v", "1")}`;

  // fallback se JSON non carica
  const fallbackVetrina = {
    id,
    title: "Vetrina SerCucTech",
    desc: "",
    voiceLang: "it-IT",
    voiceText: "",
    contacts: [
      { name: "Renzo", phone: "+393332927842" },
      { name: "Sergio", phone: "+393208852858" }
    ],
    images: [
      `media/${id}-010.jpg`
    ],
    index: [
      { label: "Indice link", url: "link.html" }
    ]
  };

  let vetrina = null;
  let images = [];
  let current = 0;
// ---------------------------
// WhatsApp Modal (FIX DEFINITIVO CHIUDI)
// ---------------------------
function closeWaModal() {
  if (!waModal) return;

  // Spegne davvero tutto
  waModal.setAttribute("hidden", "");
  waModal.classList.remove("open");
  waModal.style.display = "none";

  if (waModalBtns) waModalBtns.innerHTML = "";

  // sicurezza: se per caso restano blocchi
  document.body.classList.remove("modalOpen");
}

function openWaModal(text, contacts) {
  if (!waModal) return;

  if (waModalText) waModalText.textContent = text || "";
  if (waModalBtns) waModalBtns.innerHTML = "";

  (contacts || []).forEach((c) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "primary";
    btn.textContent = `Apri WhatsApp: ${c.name}`;

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const phone = (c.phone || "").replace(/\s+/g, "");
      const url = `https://wa.me/${phone.replace(/^\+/, "")}?text=${encodeURIComponent(text || "")}`;
      window.open(url, "_blank");
      closeWaModal();
    }, { passive: false });

    waModalBtns.appendChild(btn);
  });

  waModal.removeAttribute("hidden");
  waModal.classList.add("open");
  waModal.style.display = "flex";
  document.body.classList.add("modalOpen");
}

// ✅ listener super-robusti: pointerdown + click
if (waCloseBtn) {
  waCloseBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeWaModal();
  }, { passive: false });

  waCloseBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeWaModal();
  }, { passive: false });
   function closeWaModal() {
  const waModal = document.getElementById("waModal");
  if (!waModal) return;
  waModal.hidden = true;
  waModal.style.display = "none";
  waModal.classList.remove("open");
}

const waCloseBtn = document.getElementById("waCloseBtn");
if (waCloseBtn) {
  const handler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeWaModal();
  };
  waCloseBtn.addEventListener("pointerdown", handler, { passive:false });
  waCloseBtn.addEventListener("touchstart", handler, { passive:false });
  waCloseBtn.addEventListener("click", handler, { passive:false });

  // ✅ fallback brutale (se Android mangia eventi)
  waCloseBtn.onclick = handler;
}
}

// ✅ click fuori = chiude sempre
if (waModal) {
  waModal.addEventListener("pointerdown", (e) => {
    if (e.target === waModal) closeWaModal();
  }, { passive: true });

  waModal.addEventListener("click", (e) => {
    if (e.target === waModal) closeWaModal();
  }, { passive: true });
}

// ✅ sicurezza all'avvio
closeWaModal();
  function closeWaModal() {
    if (!waModal) return;
    waModal.hidden = true;
    waModal.style.display = "none";
    if (waModalBtns) waModalBtns.innerHTML = "";
  }

  function openWaModal(text, contacts) {
    if (!waModal) return;
    if (waModalText) waModalText.textContent = text || "";
    if (waModalBtns) waModalBtns.innerHTML = "";

    (contacts || []).forEach((c) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "primary";
      btn.textContent = `Apri WhatsApp: ${c.name}`;
      onTap(btn, () => {
        const phone = (c.phone || "").replace(/\s+/g, "");
        const url = `https://wa.me/${phone.replace(/^\+/, "")}?text=${encodeURIComponent(text || "")}`;
        window.open(url, "_blank");
        // non lasciare overlay appeso
        closeWaModal();
      });
      waModalBtns.appendChild(btn);
    });

    waModal.hidden = false;
    waModal.style.display = "flex";
  }

  // chiudi sempre
  onTap(waCloseBtn, closeWaModal);
  // click fuori chiude
  if (waModal) {
    waModal.addEventListener("click", (e) => {
      if (e.target === waModal) closeWaModal();
    });
  }
  // sicurezza all'avvio
  closeWaModal();

  // ---------------------------
  // Render base
  // ---------------------------
  function renderHeader() {
    pageTitle.textContent = vetrina.title || vetrina.id || "Vetrina";
    pageDesc.textContent = vetrina.desc || "";
    badgeId.textContent = `id: ${vetrina.id || "-"}`;
  }

  function renderContacts() {
    const txt = (vetrina.voiceText || "").trim();
    if (!txt && (!vetrina.contacts || !vetrina.contacts.length)) {
      voicePanel.hidden = true;
      return;
    }

    voicePanel.hidden = false;
    voiceText.textContent = txt || "Messaggio disponibile.";

    contactsRow.innerHTML = "";
    (vetrina.contacts || []).forEach((c) => {
      const phoneClean = (c.phone || "").replace(/\s+/g, "");

      const wa = document.createElement("a");
      wa.className = "contactChip";
      wa.href = `https://wa.me/${phoneClean.replace(/^\+/, "")}`;
      wa.target = "_blank";
      wa.rel = "noopener";
      wa.innerHTML = `💬 <b>${c.name}</b> ${c.phone}`;
      contactsRow.appendChild(wa);

      const call = document.createElement("a");
      call.className = "contactChip";
      call.href = `tel:${phoneClean}`;
      call.innerHTML = `📞 <b>${c.name}</b> Chiama`;
      contactsRow.appendChild(call);
    });

    // voice click (autorizzazione audio)
    onTap(voicePanelInner, () => speakText(vetrina.voiceText || "", vetrina.voiceLang || "it-IT"));
  }

  function renderIndex() {
    const arr = vetrina.index || [];
    if (!arr.length) {
      indexPanel.hidden = true;
      return;
    }
    indexPanel.hidden = false;
    indexList.innerHTML = "";
    arr.forEach((it) => {
      const a = document.createElement("a");
      a.className = "indexLink";
      a.href = it.url;
      a.innerHTML = `<span class="dot"></span> ${it.label}`;
      indexList.appendChild(a);
    });
  }

  // ---------------------------
  // Gallery
  // ---------------------------
  function setImage(i) {
    if (!images.length) return;
    current = (i + images.length) % images.length;

    const src = images[current];
    heroImg.src = src;

    const n = current + 1;
    imgCounter.textContent = `${pad2(n)}/${pad2(images.length)}`;
    imgBadge.textContent = pad2(n);

    // thumbs active
    [...thumbRow.querySelectorAll(".thumb")].forEach((t) => t.classList.remove("active"));
    const t = thumbRow.querySelector(`[data-i="${current}"]`);
    if (t) t.classList.add("active");

    // pins overlay
    renderPins();
  }

  function renderThumbs() {
    thumbRow.innerHTML = "";
    images.forEach((src, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "thumb";
      b.dataset.i = String(i);
      b.innerHTML = `<img alt="thumb ${i + 1}" src="${src}">`;
      onTap(b, () => setImage(i));
      thumbRow.appendChild(b);
    });
  }

  onTap(prevBtn, () => setImage(current - 1));
  onTap(nextBtn, () => setImage(current + 1));

  // Fullscreen: tap foto
  onTap(heroImg, () => {
    document.body.classList.toggle("fullscreenMode");
  });

  // ---------------------------
  // WhatsApp per foto
  // ---------------------------
  function getPhotoInfoText() {
    const num = current + 1;
    const title = vetrina.title || vetrina.id || "Vetrina";
    return `Ciao! Vorrei info sulla foto ${pad2(num)}/${pad2(images.length)} della vetrina "${title}" (id: ${vetrina.id}).`;
  }

  function openWhatsAppForCurrent() {
    const text = getPhotoInfoText();
    openWaModal(text, vetrina.contacts || []);
  }

  onTap(waInfoBtn, openWhatsAppForCurrent);
  onTap(waOnPhotoBtn, openWhatsAppForCurrent);

  // Share vetrina
  onTap(shareBtn, () => {
    const url = location.href;
    const text = `Guarda questa vetrina: ${url}`;
    const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(wa, "_blank");
  });

  // ---------------------------
  // Bottom bar (tasti grandi = CSS)
  // ---------------------------
  onTap(homeBtn, () => location.href = "index.html");
  onTap(voiceBtn, () => {
    // scroll su voice panel
    if (voicePanel && !voicePanel.hidden) voicePanel.scrollIntoView({ behavior: "smooth", block: "start" });
    else alert("Nessun messaggio vocale in questa vetrina.");
  });
  onTap(stopBtn, () => stopSpeak());
  onTap(fullBtn, () => document.body.classList.toggle("fullscreenMode"));
  onTap(themeBtn, () => {
    document.body.classList.toggle("themeAlt");
  });
  onTap(kioskBtn, () => {
    document.body.classList.toggle("kioskMode");
  });

  // ---------------------------
  // Speech (Android: parte solo dopo interazione)
  // ---------------------------
  let utter = null;
  function stopSpeak() {
    try { window.speechSynthesis.cancel(); } catch {}
    utter = null;
  }

  function speakText(text, lang) {
    const t = (text || "").trim();
    if (!t) return;

    stopSpeak();

    try {
      utter = new SpeechSynthesisUtterance(t);
      utter.lang = lang || "it-IT";
      window.speechSynthesis.speak(utter);
    } catch (e) {
      alert("Audio non disponibile su questo browser.");
    }
  }

  // ---------------------------
  // Modalità segreta numerini (tap titolo 5 volte)
  // ---------------------------
  const LS_PINS = (vId) => `pins_${vId}`;
  const LS_PIN_SIZE = (vId) => `pinSize_${vId}`;
  const LS_LABEL_ON = (vId) => `labelOn_${vId}`;

  let titleTapCount = 0;
  let titleTapTimer = null;

  if (pageTitle) {
    onTap(pageTitle, () => {
      titleTapCount++;
      clearTimeout(titleTapTimer);
      titleTapTimer = setTimeout(() => (titleTapCount = 0), 900);

      if (titleTapCount >= 5) {
        titleTapCount = 0;
        labelCard.hidden = false;
        alert("Modalità numerini: pannello visibile.");
        syncLabelUI();
      }
    });
  }

  function getPins() {
    try {
      return JSON.parse(localStorage.getItem(LS_PINS(vetrina.id)) || "[]");
    } catch {
      return [];
    }
  }

  function setPins(arr) {
    localStorage.setItem(LS_PINS(vetrina.id), JSON.stringify(arr));
  }

  function getPinSize() {
    return Number(localStorage.getItem(LS_PIN_SIZE(vetrina.id)) || "28");
  }

  function setPinSize(n) {
    localStorage.setItem(LS_PIN_SIZE(vetrina.id), String(n));
  }

  function isLabelOn() {
    return localStorage.getItem(LS_LABEL_ON(vetrina.id)) === "1";
  }

  function setLabelOn(v) {
    localStorage.setItem(LS_LABEL_ON(vetrina.id), v ? "1" : "0");
  }

  function syncLabelUI() {
    const size = getPinSize();
    if (pinSizeRange) pinSizeRange.value = String(size);
    if (pinSizeValue) pinSizeValue.textContent = String(size);

    const on = isLabelOn();
    if (labelModeBadge) labelModeBadge.textContent = on ? "ON" : "OFF";
    if (pinsJsonBox) pinsJsonBox.value = JSON.stringify(getPins(), null, 2);
    renderPins();
  }

  function renderPins() {
    if (!pinsLayer) return;
    pinsLayer.innerHTML = "";

    const pins = getPins().filter(p => p.img === current);
    const size = getPinSize();

    pins.forEach((p) => {
      const el = document.createElement("div");
      el.className = "pin";
      el.textContent = String(p.n);
      el.style.left = `${p.x * 100}%`;
      el.style.top = `${p.y * 100}%`;
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.fontSize = `${Math.max(12, Math.round(size * 0.55))}px`;
      pinsLayer.appendChild(el);
    });
  }

  // piazza pin su tap foto (solo se ON)
  if (heroImg) {
    heroImg.addEventListener("click", (e) => {
      if (!vetrina || !isLabelOn()) return;

      const rect = heroImg.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      const pins = getPins();
      const nextN = (pins.filter(p => p.img === current).length) + 1;

      pins.push({ img: current, n: nextN, x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) });
      setPins(pins);
      syncLabelUI();
    }, { passive: true });
  }

  onTap(labelToggleBtn, () => { setLabelOn(!isLabelOn()); syncLabelUI(); });
  onTap(labelUndoBtn, () => {
    const pins = getPins();
    // rimuove ultimo della foto corrente
    for (let i = pins.length - 1; i >= 0; i--) {
      if (pins[i].img === current) { pins.splice(i, 1); break; }
    }
    setPins(pins);
    syncLabelUI();
  });
  onTap(labelClearBtn, () => {
    const pins = getPins().filter(p => p.img !== current);
    setPins(pins);
    syncLabelUI();
  });

  if (pinSizeRange) {
    pinSizeRange.addEventListener("input", () => {
      const v = Number(pinSizeRange.value || "28");
      setPinSize(v);
      if (pinSizeValue) pinSizeValue.textContent = String(v);
      renderPins();
    });
  }

  onTap(exportPinsBtn, () => {
    const json = JSON.stringify(getPins(), null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `pins-${vetrina.id}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  onTap(copyPinsBtn, async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(getPins(), null, 2));
      alert("Copiato!");
    } catch {
      alert("Clipboard non disponibile.");
    }
  });

  // Export PNG con pins
  onTap(exportPngBtn, async () => {
    try {
      const src = images[current];
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = src;

      await new Promise((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error("Immagine non caricata"));
      });

      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");

      ctx.drawImage(img, 0, 0);

      const pins = getPins().filter(p => p.img === current);
      const size = getPinSize();
      const r = size * 1.1;

      pins.forEach((p) => {
        const x = p.x * canvas.width;
        const y = p.y * canvas.height;

        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,.45)";
        ctx.fill();

        ctx.lineWidth = Math.max(2, r * 0.18);
        ctx.strokeStyle = "rgba(255,255,255,.9)";
        ctx.stroke();

        ctx.fillStyle = "white";
        ctx.font = `bold ${Math.max(18, Math.round(r * 1.15))}px system-ui, Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(p.n), x, y);
      });

      canvas.toBlob((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${vetrina.id}-${pad2(current + 1)}-numerini.png`;
        a.click();
        URL.revokeObjectURL(a.href);
      }, "image/png");
    } catch (e) {
      alert("Errore export PNG: " + (e.message || e));
    }
  });

  // ---------------------------
  // Load JSON
  // ---------------------------
  async function loadData() {
    try {
      const r = await fetch(DATA_URL, { cache: "no-store" });
      if (!r.ok) throw new Error("JSON non trovato");
      const all = await r.json();

      // supporta sia array che oggetto {vetrine:[]}
      const arr = Array.isArray(all) ? all : (all.vetrine || []);
      const found = arr.find(x => (x.id || "").toLowerCase() === id.toLowerCase());

      vetrina = found || fallbackVetrina;
    } catch {
      vetrina = fallbackVetrina;
    }

    // immagini
    images = (vetrina.images && vetrina.images.length) ? vetrina.images : fallbackVetrina.images;

    renderHeader();
    renderContacts();
    renderIndex();

    renderThumbs();
    setImage(0);

    // label panel init
    if (labelCard) labelCard.hidden = true;
    syncLabelUI();
  }

  // refresh index button: ricarica pagina (semplice)
  onTap(refreshIndexBtn, () => location.reload());

  // sicurezza: nessun modal aperto all'avvio
  closeWaModal();

  loadData();
})();
