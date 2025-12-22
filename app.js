/* =========================
   SerCucTech - Vetrina app.js
   (compatibile con vetrina.html che hai incollato)
   ========================= */

(() => {
  "use strict";

  // ---- Helpers
  const $ = (id) => document.getElementById(id);
  const qs = new URLSearchParams(location.search);
  const vParam = qs.get("v") || String(Date.now());

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const pad2 = (n) => String(n).padStart(2, "0");

  function safeText(t) {
    return (t ?? "").toString();
  }

  function encodeWA(text) {
    return encodeURIComponent(text);
  }

  // ---- DOM
  const pageTitle = $("pageTitle");
  const pageDesc = $("pageDesc");
  const badgeId = $("badgeId");

  const voicePanel = $("voicePanel");
  const voicePanelInner = $("voicePanelInner");
  const voiceTextEl = $("voiceText");
  const contactsRow = $("contactsRow");

  const indexPanel = $("indexPanel");
  const refreshIndexBtn = $("refreshIndexBtn");
  const indexList = $("indexList");

  const prevBtn = $("prevBtn");
  const nextBtn = $("nextBtn");
  const heroImg = $("heroImg");
  const imgWrap = $("imgWrap");
  const imgCounter = $("imgCounter");
  const imgBadge = $("imgBadge");
  const thumbRow = $("thumbRow");
  const pinsLayer = $("pinsLayer");

  const waInfoBtn = $("waInfoBtn");

  const filesCard = $("filesCard");
  const filesList = $("filesList");

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

  const shareBtn = $("shareBtn");

  const homeBtn = $("homeBtn");
  const voiceBtn = $("voiceBtn");
  const stopBtn = $("stopBtn");
  const fullBtn = $("fullBtn");
  const themeBtn = $("themeBtn");
  const kioskBtn = $("kioskBtn");

  const waModal = $("waModal");
  const waModalText = $("waModalText");
  const waModalBtns = $("waModalBtns");
  const waCloseBtn = $("waCloseBtn");

  // ---- State
  let vetrinaId = (qs.get("id") || "renzo11").trim();
  let vetrinaData = null;

  let media = []; // [{type:'image', url, label}]
  let files = []; // [{label,url}]
  let cur = 0;

  // audio
  let speechEnabled = true;
  let speechRate = 1.0;
  let isSpeaking = false;
  let pendingSpeakText = "";

  // theme/kiosk/full
  let darkTheme = true; // CSS già scuro
  let kiosk = false;

  // secret label mode
  let titleTapCount = 0;
  let titleTapTimer = null;
  let labelMode = false;

  // pins: per immagine
  // pinsByUrl[url] = [{n, x, y}]  x,y in normalized image coords (0..1)
  let pinsByUrl = {};
  let nextPinNumber = 1;

  // zoom/pan (solo label mode)
  let zoomScale = 1;
  let lastScale = 1;
  let panX = 0;
  let panY = 0;
  let startDist = 0;
  let startX = 0;
  let startY = 0;
  let isPanning = false;
  let lastTap = 0;

  // ---- Storage keys
  const LS_KEY = () => `SerCucTech:pins:${vetrinaId}`;

  // ---- Loaders
  async function fetchJsonTry(urls) {
    for (const u of urls) {
      try {
        const r = await fetch(u, { cache: "no-store" });
        if (r.ok) return await r.json();
      } catch (e) {}
    }
    throw new Error("JSON non trovato: " + urls.join(" | "));
  }

  async function loadVetrina(id) {
    // Nel tuo repo hai: /data/renzo11.json (si vede dallo screenshot)
    const urls = [
      `data/${id}.json?v=${vParam}`,
      `${id}.json?v=${vParam}`, // fallback
    ];
    return await fetchJsonTry(urls);
  }

  async function loadIndex() {
    // nel tuo repo c'è "vetrine.json" in root (si vede dallo screenshot)
    const urls = [
      `vetrine.json?v=${vParam}`,
      `data/vetrine.json?v=${vParam}`,
      `index.json?v=${vParam}`,
      `data/index.json?v=${vParam}`,
    ];
    return await fetchJsonTry(urls);
  }

  // ---- UI builders
  function setHeader(data) {
    pageTitle.textContent = safeText(data.title || "Vetrina");
    pageDesc.textContent = safeText(data.description || "");
    badgeId.textContent = `id: ${safeText(data.id || vetrinaId)}`;
  }

  function buildContacts(data) {
    const contacts = Array.isArray(data.contacts) ? data.contacts : [];
    if (!contacts.length && !safeText(data.text)) {
      voicePanel.hidden = true;
      return;
    }

    voicePanel.hidden = false;
    voiceTextEl.textContent = safeText(data.text || "");

    contactsRow.innerHTML = "";
    for (const c of contacts) {
      const name = safeText(c.name || "Contatto");
      const phone = safeText(c.phone || "").replace(/\s+/g, "");
      if (!phone) continue;

      // WhatsApp
      const a1 = document.createElement("a");
      a1.className = "contactChip";
      a1.href = `https://wa.me/${phone.replace(/^\+/, "")}`;
      a1.target = "_blank";
      a1.rel = "noopener";
      a1.innerHTML = `💬 <b>${name}</b> ${phone} <span style="opacity:.8">WhatsApp</span>`;
      contactsRow.appendChild(a1);

      // Call
      const a2 = document.createElement("a");
      a2.className = "contactChip";
      a2.href = `tel:${phone}`;
      a2.innerHTML = `📞 <b>${name}</b> <span style="opacity:.85">Chiama</span>`;
      contactsRow.appendChild(a2);
    }
  }

  function buildFiles(data) {
    files = Array.isArray(data.files) ? data.files : [];
    if (!files.length) {
      filesCard.hidden = true;
      return;
    }
    filesCard.hidden = false;
    filesList.innerHTML = "";
    for (const f of files) {
      const a = document.createElement("a");
      a.className = "fileLink";
      a.href = f.url || "#";
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = f.label || f.url || "File";
      filesList.appendChild(a);
    }
  }

  function buildThumbs() {
    thumbRow.innerHTML = "";
    media.forEach((m, i) => {
      const b = document.createElement("button");
      b.className = "thumb" + (i === cur ? " active" : "");
      b.type = "button";
      const img = document.createElement("img");
      img.alt = m.label || `Foto ${i + 1}`;
      img.loading = "lazy";
      img.src = m.url;
      b.appendChild(img);
      b.addEventListener("click", () => {
        goTo(i);
      });
      thumbRow.appendChild(b);
    });
  }

  function updateCounter() {
    const total = media.length || 1;
    imgCounter.textContent = `${pad2(cur + 1)}/${pad2(total)}`;
    imgBadge.textContent = pad2(cur + 1);
  }

  function setActiveThumb() {
    [...thumbRow.querySelectorAll(".thumb")].forEach((t, i) => {
      if (i === cur) t.classList.add("active");
      else t.classList.remove("active");
    });
  }

  function goTo(i) {
    if (!media.length) return;
    cur = (i + media.length) % media.length;

    // reset zoom when changing photo (soprattutto in numerini)
    zoomScale = 1;
    panX = 0;
    panY = 0;
    applyTransform();

    heroImg.src = media[cur].url;
    heroImg.alt = media[cur].label || `Foto ${cur + 1}`;

    updateCounter();
    setActiveThumb();
    renderPinsForCurrent();
    updateWaButton();
  }

  function prev() { goTo(cur - 1); }
  function next() { goTo(cur + 1); }

  function updateWaButton() {
    // rende più visibile e sempre coerente col numero foto
    const total = media.length || 1;
    waInfoBtn.textContent = `WhatsApp: chiedi info su questa foto (${pad2(cur + 1)}/${pad2(total)})`;
  }

  // ---- WhatsApp modal
  function openWaModal() {
    const contacts = Array.isArray(vetrinaData?.contacts) ? vetrinaData.contacts : [];
    const m = media[cur] || {};
    const title = safeText(vetrinaData?.title || vetrinaId);
    const photoLabel = m.label ? ` - ${m.label}` : "";
    const link = location.href.split("#")[0];

    const msg =
      `Ciao! Info su: ${title}\n` +
      `Foto ${cur + 1}/${media.length}${photoLabel}\n` +
      `Link: ${link}`;

    waModalText.text
