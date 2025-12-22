/* =========================================================
   SerCucTech - app.js (DEFINITIVO)
   Compatibile con: vetrina.html (quello che hai incollato)
   CSS: stile.css (principale) + style.css (ponte)
   ========================================================= */

(() => {
  "use strict";

  // ---------- Helpers ----------
  const $ = (id) => document.getElementById(id);
  const qs = new URLSearchParams(location.search);
  const vId = (qs.get("id") || "renzo11").trim();
  const vCache = qs.get("v") || String(Date.now());

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const pad2 = (n) => String(n).padStart(2, "0");

  function safe(s){ return (s ?? "").toString(); }

  function waPhoneToDigits(phone){
    return safe(phone).replace(/\s+/g,"").replace(/^\+/, "");
  }

  function waEncode(text){ return encodeURIComponent(text); }

  // ---------- DOM ----------
  const pageTitle = $("pageTitle");
  const pageDesc  = $("pageDesc");
  const badgeId   = $("badgeId");

  const voicePanel      = $("voicePanel");
  const voicePanelInner = $("voicePanelInner");
  const voiceTextEl     = $("voiceText");
  const contactsRow     = $("contactsRow");

  const indexPanel      = $("indexPanel");
  const refreshIndexBtn = $("refreshIndexBtn");
  const indexList       = $("indexList");

  const prevBtn   = $("prevBtn");
  const nextBtn   = $("nextBtn");
  const heroImg   = $("heroImg");
  const imgWrap   = $("imgWrap");
  const imgCounter= $("imgCounter");
  const imgBadge  = $("imgBadge");
  const thumbRow  = $("thumbRow");
  const pinsLayer = $("pinsLayer");

  const waInfoBtn = $("waInfoBtn");

  const filesCard = $("filesCard");
  const filesList = $("filesList");

  const labelCard      = $("labelCard");
  const labelModeBadge = $("labelModeBadge");
  const labelToggleBtn = $("labelToggleBtn");
  const labelUndoBtn   = $("labelUndoBtn");
  const labelClearBtn  = $("labelClearBtn");
  const pinSizeRange   = $("pinSizeRange");
  const pinSizeValue   = $("pinSizeValue");
  const exportPinsBtn  = $("exportPinsBtn");
  const copyPinsBtn    = $("copyPinsBtn");
  const pinsJsonBox    = $("pinsJsonBox");

  const shareBtn = $("shareBtn");

  const homeBtn  = $("homeBtn");
  const voiceBtn = $("voiceBtn");
  const stopBtn  = $("stopBtn");
  const fullBtn  = $("fullBtn");
  const themeBtn = $("themeBtn");
  const kioskBtn = $("kioskBtn");

  const waModal     = $("waModal");
  const waModalText = $("waModalText");
  const waModalBtns = $("waModalBtns");
  const waCloseBtn  = $("waCloseBtn");

  // ---------- State ----------
  let data = null;

  let media = [];
  let files = [];
  let cur = 0;

  // Speech
  let speaking = false;
  let lastSpeakText = "";

  // Full / Theme / Kiosk
  let kiosk = false;
  let bright = false;

  // Label Mode + Pins
  let titleTapCount = 0;
  let tapTimer = null;

  let labelMode = false;
  const PINS_KEY = () => `SerCucTech:pins:${vId}`;
  let pinsByUrl = {};         // url -> [{n,x,y}]
  let nextPin = 1;

  // Zoom/Pan (solo labelMode)
  let zoomScale = 1;
  let lastScale = 1;
  let panX = 0;
  let panY = 0;
  let startDist = 0;
  let startX = 0;
  let startY = 0;
  let isPanning = false;
  let lastTap = 0;

  // ---------- Fetch ----------
  async function fetchJson(url){
    const r = await fetch(url, { cache:"no-store" });
    if(!r.ok) throw new Error(`Errore fetch: ${url} (${r.status})`);
    return r.json();
  }

  async function loadVetrina(){
    // nel tuo repo: data/renzo11.json
    const tries = [
      `data/${encodeURIComponent(vId)}.json?v=${vCache}`,
      `${encodeURIComponent(vId)}.json?v=${vCache}`,
    ];
    let err = null;
    for(const u of tries){
      try{ return await fetchJson(u); }catch(e){ err = e; }
    }
    throw err || new Error("JSON vetrina non trovato");
  }

  async function loadIndex(){
    // nel tuo repo: vetrine.json (root) oppure data/vetrine.json
    const tries = [
      `vetrine.json?v=${vCache}`,
      `data/vetrine.json?v=${vCache}`,
    ];
    let err = null;
    for(const u of tries){
      try{ return await fetchJson(u); }catch(e){ err = e; }
    }
    throw err || new Error("Indice vetrine non trovato");
  }

  // ---------- UI ----------
  function setHeader(){
    pageTitle.textContent = safe(data?.title || "Vetrina");
    pageDesc.textContent  = safe(data?.description || "");
    badgeId.textContent   = `id: ${safe(data?.id || vId)}`;
  }

  function buildVoiceAndContacts(){
    const text = safe(data?.voice?.text || data?.text || "");
    const contacts = Array.isArray(data?.contacts) ? data.contacts : [];

    if(!text && !contacts.length){
      voicePanel.hidden = true;
      return;
    }

    voicePanel.hidden = false;
    voiceTextEl.textContent = text;

    contactsRow.innerHTML = "";
    for(const c of contacts){
      const name  = safe(c.name || "Contatto");
      const phone = safe(c.phone || "");
      const digits= waPhoneToDigits(phone);
      if(!digits) continue;

      const wa = document.createElement("a");
      wa.className = "contactChip";
      wa.href = `https://wa.me/${digits}`;
      wa.target = "_blank";
      wa.rel = "noopener";
      wa.innerHTML = `💬 <b>${name}</b> ${phone}`;
      contactsRow.appendChild(wa);

      const tel = document.createElement("a");
      tel.className = "contactChip";
      tel.href = `tel:${phone}`;
      tel.innerHTML = `📞 <b>${name}</b> Chiama`;
      contactsRow.appendChild(tel);
    }

    // clic su pannello -> parla
    voicePanelInner.addEventListener("click", () => {
      trySpeak(text);
    });
  }

  function buildFiles(){
    files = Array.isArray(data?.files) ? data.files : [];
    if(!files.length){
      filesCard.hidden = true;
      return;
    }
    filesCard.hidden = false;
    filesList.innerHTML = "";
    for(const f of files){
      const a = document.createElement("a");
      a.className = "fileLink";
      a.href = safe(f.url || "#");
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = safe(f.label || f.url || "File");
      filesList.appendChild(a);
    }
  }

  function normalizeMedia(){
    const arr = Array.isArray(data?.media) ? data.media : [];
    media = arr
      .filter(m => m && (m.type === "image" || !m.type) && m.url)
      .map(m => ({
        type: "image",
        url: safe(m.url) + (safe(m.url).includes("?") ? `&v=${vCache}` : `?v=${vCache}`),
        label: safe(m.label || "")
      }));
  }

  function buildThumbs(){
    thumbRow.innerHTML = "";
    media.forEach((m, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "thumb" + (i===cur ? " active" : "");

      const img = document.createElement("img");
      img.loading = "lazy";
      img.alt = m.label || `Foto ${i+1}`;
      img.src = m.url;
      b.appendChild(img);

      b.addEventListener("click", () => goTo(i));
      thumbRow.appendChild(b);
    });
  }

  function updateCounters(){
    const total = Math.max(1, media.length);
    imgCounter.textContent = `${pad2(cur+1)}/${pad2(total)}`;
    imgBadge.textContent = pad2(cur+1);
    waInfoBtn.textContent = `WhatsApp: chiedi info su questa foto (${pad2(cur+1)}/${pad2(total)})`;
  }

  function setActiveThumb(){
    const thumbs = thumbRow.querySelectorAll(".thumb");
    thumbs.forEach((t, i) => {
      if(i===cur) t.classList.add("active");
      else t.classList.remove("active");
    });
  }

  function resetZoom(){
    zoomScale = 1;
    lastScale = 1;
    panX = 0;
    panY = 0;
    applyTransform();
  }

  function goTo(i){
    if(!media.length) return;
    cur = (i + media.length) % media.length;

    resetZoom();

    heroImg.src = media[cur].url;
    heroImg.alt = media[cur].label || `Foto ${cur+1}`;

    updateCounters();
    setActiveThumb();
    renderPinsForCurrent();
  }

  function prev(){ goTo(cur - 1); }
  function next(){ goTo(cur + 1); }

  // ---------- Index (Altre vetrine) ----------
  async function renderIndex(){
    try{
      const idx = await loadIndex();
      const list = Array.isArray(idx?.vetrine) ? idx.vetrine : (Array.isArray(idx?.items) ? idx.items : []);
      if(!list.length){
        indexPanel.hidden = true;
        return;
      }

      indexPanel.hidden = false;
      indexList.innerHTML = "";
      for(const it of list){
        const id = safe(it.id || "");
        if(!id) continue;

        const a = document.createElement("a");
        a.className = "indexLink";
        a.href = `vetrina.html?id=${encodeURIComponent(id)}&v=${vCache}`;
        a.innerHTML = `<span class="dot"></span> ${safe(it.title || id)}`;
        indexList.appendChild(a);
      }
    }catch(e){
      indexPanel.hidden = true;
    }
  }

  // ---------- WhatsApp modal ----------
  function openWaModal(){
    const contacts = Array.isArray(data?.contacts) ? data.contacts : [];
    const title = safe(data?.title || vId);
    const m = media[cur] || {};
    const url = location.href.split("#")[0];

    const msg =
      `Ciao! Vorrei informazioni.\n` +
      `Vetrina: ${title}\n` +
      `Foto: ${cur+1}/${media.length}${m.label ? " ("+m.label+")" : ""}\n` +
      `Link: ${url}`;

    waModalText.textContent = msg;
    waModalBtns.innerHTML = "";

    if(!contacts.length){
      const b = document.createElement("button");
      b.type = "button";
      b.className = "primary";
      b.textContent = "Apri WhatsApp";
      b.addEventListener("click", () => {
        window.open(`https://wa.me/?text=${waEncode(msg)}`, "_blank");
      });
      waModalBtns.appendChild(b);
    }else{
      for(const c of contacts){
        const name = safe(c.name || "Contatto");
        const digits = waPhoneToDigits(c.phone || "");
        if(!digits) continue;

        const b = document.createElement("button");
        b.type = "button";
        b.className = "primary";
        b.textContent = `💬 ${name}`;
        b.addEventListener("click", () => {
          window.open(`https://wa.me/${digits}?text=${waEncode(msg)}`, "_blank");
        });
        waModalBtns.appendChild(b);
      }
    }

    waModal.hidden = false;
  }

  function closeWaModal(){ waModal.hidden = true; }

  // ---------- Share ----------
  async function share(){
    const title = safe(data?.title || "Vetrina");
    const url = location.href.split("#")[0];

    if(navigator.share){
      try{
        await navigator.share({ title, text:title, url });
        return;
      }catch(e){}
    }
    window.open(`https://wa.me/?text=${waEncode(title + "\n" + url)}`, "_blank");
  }

  // ---------- Speech ----------
  function trySpeak(text){
    const t = safe(text).trim();
    if(!t) return;

    lastSpeakText = t;

    if(!("speechSynthesis" in window)){
      alert("Sintesi vocale non disponibile su questo browser.");
      return;
    }

    try{
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(t);
      u.lang = safe(data?.voice?.lang || "it-IT");
      u.rate = 1;

      u.onstart = () => { speaking = true; };
      u.onend   = () => { speaking = false; };
      u.onerror = () => { speaking = false; };

      window.speechSynthesis.speak(u);
    }catch(e){
      // se Android blocca (raro dopo gesto), almeno non rompiamo UI
      alert("Audio bloccato. Tocca ancora 'Voice' e riprova.");
    }
  }

  function stopSpeak(){
    if("speechSynthesis" in window) window.speechSynthesis.cancel();
    speaking = false;
  }

  // ---------- Fullscreen Mode ----------
  function toggleFull(){
    document.body.classList.toggle("fs");
  }

  // ---------- Theme ----------
  function toggleTheme(){
    bright = !bright;
    document.body.style.filter = bright ? "brightness(1.08) contrast(1.04)" : "none";
  }

  // ---------- Kiosk ----------
  function toggleKiosk(){
    kiosk = !kiosk;
    $("bottombar").style.display = kiosk ? "none" : "";
    $(".shareDock")?.style?.display; // (solo per non errorare se non trovato)
    shareBtn.style.display = kiosk ? "none" : "";
  }

  // ---------- Pins storage ----------
  function loadPins(){
    try{
      const raw = localStorage.getItem(PINS_KEY());
      pinsByUrl = raw ? JSON.parse(raw) : {};
    }catch(e){
      pinsByUrl = {};
    }
  }

  function savePins(){
    try{ localStorage.setItem(PINS_KEY(), JSON.stringify(pinsByUrl)); }catch(e){}
  }

  function curUrl(){ return safe(media[cur]?.url || ""); }

  function ensureArr(url){
    if(!pinsByUrl[url]) pinsByUrl[url] = [];
    return pinsByUrl[url];
  }

  function computeNext(url){
    const arr = ensureArr(url);
    const max = arr.reduce((m,p)=>Math.max(m, p.n||0), 0);
    nextPin = max + 1;
  }

  function setPinSize(px){
    const v = clamp(px, 14, 64);
    pinSizeRange.value = String(v);
    pinSizeValue.textContent = String(v);
    renderPinsForCurrent();
  }

  function renderPinsForCurrent(){
    pinsLayer.innerHTML = "";

    const url = curUrl();
    if(!url) return;

    const arr = ensureArr(url);
    if(!arr.length) return;

    // posizionamento: usa boundingRect reale dell'immagine (contain)
    const wrapRect = imgWrap.getBoundingClientRect();
    const imgRect  = heroImg.getBoundingClientRect();
    const offX = imgRect.left - wrapRect.left;
    const offY = imgRect.top  - wrapRect.top;

    const size = Number(pinSizeRange.value || 28);
    const font = Math.max(10, Math.round(size * 0.45));

    for(const p of arr){
      const el = document.createElement("div");
      el.className = "pin";
      el.textContent = String(p.n);

      const x = offX + (p.x * imgRect.width);
      const y = offY + (p.y * imgRect.height);

      el.style.left = `${x}px`;
      el.style.top  = `${y}px`;
      el.style.width  = `${size}px`;
      el.style.height = `${size}px`;
      el.style.fontSize = `${font}px`;

      pinsLayer.appendChild(el);
    }
  }

  function updatePinsBox(){
    const url = curUrl();
    const arr = ensureArr(url);
    pinsJsonBox.value = JSON.stringify({ image: url, pins: arr }, null, 2);
  }

  function setLabelMode(on){
    labelMode = !!on;
    labelModeBadge.textContent = labelMode ? "ON" : "OFF";
    labelCard.hidden = !labelCard.hidden ? false : false; // (la card la gestisci tu col tap)
    // abilita pinch solo in label mode
    imgWrap.style.touchAction = labelMode ? "none" : "manipulation";

    if(!labelMode) resetZoom();

    renderPinsForCurrent();
    updatePinsBox();
  }

  // ---------- Zoom/Pan (label mode) ----------
  function applyTransform(){
    heroImg.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomScale})`;
    requestAnimationFrame(renderPinsForCurrent);
  }

  function dist(t1, t2){
    const dx = t2.clientX - t1.clientX;
    const dy = t2.clientY - t1.clientY;
    return Math.hypot(dx, dy);
  }

  imgWrap.addEventListener("touchstart", (e) => {
    if(!labelMode) return;

    if(e.touches.length === 2){
      startDist = dist(e.touches[0], e.touches[1]);
      lastScale = zoomScale;
    }
    if(e.touches.length === 1){
      isPanning = true;
      startX = e.touches[0].clientX - panX;
      startY = e.touches[0].clientY - panY;
    }
  }, { passive:false });

  imgWrap.addEventListener("touchmove", (e) => {
    if(!labelMode) return;
    e.preventDefault();

    if(e.touches.length === 2){
      const d = dist(e.touches[0], e.touches[1]);
      zoomScale = clamp(lastScale * (d / startDist), 1, 5);
      applyTransform();
    }
    if(e.touches.length === 1 && isPanning && zoomScale > 1){
      panX = e.touches[0].clientX - startX;
      panY = e.touches[0].clientY - startY;
      applyTransform();
    }
  }, { passive:false });

  imgWrap.addEventListener("touchend", () => { isPanning = false; });

  // doppio tap (label mode)
  imgWrap.addEventListener("click", () => {
    if(!labelMode) return;
    const now = Date.now();
    if(now - lastTap < 300){
      if(zoomScale === 1) zoomScale = 2;
      else { zoomScale = 1; panX = 0; panY = 0; }
      applyTransform();
    }
    lastTap = now;
  });

  // aggiungi pin con tap preciso (label mode)
  imgWrap.addEventListener("pointerdown", (e) => {
    if(!labelMode) return;

    const url = curUrl();
    if(!url) return;

    const imgRect = heroImg.getBoundingClientRect();
    if(e.clientX < imgRect.left || e.clientX > imgRect.right || e.clientY < imgRect.top || e.clientY > imgRect.bottom){
      return;
    }

    const nx = (e.clientX - imgRect.left) / imgRect.width;
    const ny = (e.clientY - imgRect.top)  / imgRect.height;

    const arr = ensureArr(url);
    computeNext(url);

    arr.push({ n: nextPin, x: +nx.toFixed(5), y: +ny.toFixed(5) });
    nextPin++;

    savePins();
    renderPinsForCurrent();
    updatePinsBox();
  });

  // ---------- Swipe (solo non label mode) ----------
  let sx = 0, sy = 0, swipe = false;
  imgWrap.addEventListener("touchstart", (e) => {
    if(labelMode) return;
    if(e.touches.length !== 1) return;
    swipe = true;
    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
  }, { passive:true });

  imgWrap.addEventListener("touchend", (e) => {
    if(labelMode) return;
    if(!swipe) return;
    swipe = false;

    const t = e.changedTouches && e.changedTouches[0];
    if(!t) return;

    const dx = t.clientX - sx;
    const dy = t.clientY - sy;

    if(Math.abs(dx) > 40 && Math.abs(dy) < 60){
      if(dx < 0) next(); else prev();
    }
  }, { passive:true });

  // tap foto = fullscreen (solo non label mode)
  heroImg.addEventListener("click", () => {
    if(labelMode) return;
    toggleFull();
  });

  // ---------- Events ----------
  prevBtn.addEventListener("click", prev);
  nextBtn.addEventListener("click", next);

  waInfoBtn.addEventListener("click", openWaModal);
  waCloseBtn.addEventListener("click", closeWaModal);
  waModal.addEventListener("click", (e) => { if(e.target === waModal) closeWaModal(); });

  shareBtn.addEventListener("click", share);

  homeBtn.addEventListener("click", () => location.href = `index.html?v=${vCache}`);
  voiceBtn.addEventListener("click", () => trySpeak(safe(data?.voice?.text || data?.text || "")));
  stopBtn.addEventListener("click", stopSpeak);
  fullBtn.addEventListener("click", toggleFull);
  themeBtn.addEventListener("click", toggleTheme);
  kioskBtn.addEventListener("click", toggleKiosk);

  refreshIndexBtn.addEventListener("click", renderIndex);

  // 5 tap titolo -> mostra/nasconde tool numerini
  pageTitle.addEventListener("click", () => {
    titleTapCount++;
    if(tapTimer) clearTimeout(tapTimer);
    tapTimer = setTimeout(() => { titleTapCount = 0; }, 900);

    if(titleTapCount >= 5){
      titleTapCount = 0;
      labelCard.hidden = !labelCard.hidden;
      if(!labelCard.hidden){
        // quando apri la card, NON attivo subito: ti lasciamo scegliere col bottone
        setLabelMode(false);
        updatePinsBox();
      }
    }
  });

  // tool numerini
  labelToggleBtn.addEventListener("click", () => setLabelMode(!labelMode));
  labelUndoBtn.addEventListener("click", () => {
    const url = curUrl();
    const arr = ensureArr(url);
    arr.pop();
    savePins();
    renderPinsForCurrent();
    updatePinsBox();
  });
  labelClearBtn.addEventListener("click", () => {
    const url = curUrl();
    pinsByUrl[url] = [];
    savePins();
    renderPinsForCurrent();
    updatePinsBox();
  });

  pinSizeRange.addEventListener("input", () => setPinSize(Number(pinSizeRange.value || 28)));

  exportPinsBtn.addEventListener("click", () => {
    const url = curUrl();
    const arr = ensureArr(url);
    const blob = new Blob([JSON.stringify({ image:url, pins:arr }, null, 2)], { type:"application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${vId}-pins-${pad2(cur+1)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 400);
  });

  copyPinsBtn.addEventListener("click", async () => {
    try{
      await navigator.clipboard.writeText(pinsJsonBox.value || "");
      alert("JSON copiato ✅");
    }catch(e){
      alert("Copia non disponibile: seleziona e copia manualmente.");
    }
  });

  heroImg.addEventListener("load", () => {
    renderPinsForCurrent();
    updateCounters();
  });

  window.addEventListener("resize", () => {
    renderPinsForCurrent();
  });

  // ---------- Init ----------
  async function init(){
    try{
      data = await loadVetrina();
      setHeader();
      buildVoiceAndContacts();
      buildFiles();
      normalizeMedia();

      if(!media.length){
        pageDesc.textContent = "Nessuna foto trovata nella vetrina.";
        return;
      }

      loadPins();
      setPinSize(Number(pinSizeRange.value || 28));

      cur = 0;
      buildThumbs();
      goTo(0);

      // indice vetrine
      await renderIndex();

      // tool numerini nascosto di default
      labelCard.hidden = true;

    }catch(e){
      pageTitle.textContent = "Errore caricamento";
      pageDesc.textContent = safe(e?.message || e);
      console.error(e);
      alert("Errore: " + safe(e?.message || e));
    }
  }

  init();

})();
