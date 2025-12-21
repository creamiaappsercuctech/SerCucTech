(function(){
  "use strict";

  const qs = (s)=>document.querySelector(s);
  const qsa = (s)=>Array.from(document.querySelectorAll(s));

  const params = new URLSearchParams(location.search);
  const id = (params.get("id") || "renzo11").trim();

  const pageTitle = qs("#pageTitle");
  const pageDesc  = qs("#pageDesc");
  const badgeId   = qs("#badgeId");

  const voicePanel = qs("#voicePanel");
  const voiceTextEl = qs("#voiceText");
  const contactsRow = qs("#contactsRow");

  const heroImg   = qs("#heroImg");
  const imgCounter= qs("#imgCounter");
  const imgBadge  = qs("#imgBadge");
  const thumbRow  = qs("#thumbRow");
  const pinsLayer = qs("#pinsLayer");
  const imgWrap   = qs("#imgWrap");

  const prevBtn   = qs("#prevBtn");
  const nextBtn   = qs("#nextBtn");

  const filesCard = qs("#filesCard");
  const filesList = qs("#filesList");

  const shareBtn  = qs("#shareBtn");

  const homeBtn   = qs("#homeBtn");
  const voiceBtn  = qs("#voiceBtn");
  const stopBtn   = qs("#stopBtn");
  const fullBtn   = qs("#fullBtn");
  const themeBtn  = qs("#themeBtn");
  const kioskBtn  = qs("#kioskBtn");

  const audioGate = qs("#audioGate");
  const enableAudioBtn = qs("#enableAudioBtn");
  const skipAudioBtn   = qs("#skipAudioBtn");

  // Label tool
  const labelCard = qs("#labelCard");
  const labelModeBadge = qs("#labelModeBadge");
  const labelToggleBtn = qs("#labelToggleBtn");
  const labelUndoBtn = qs("#labelUndoBtn");
  const labelClearBtn = qs("#labelClearBtn");
  const pinSizeRange = qs("#pinSizeRange");
  const pinSizeValue = qs("#pinSizeValue");
  const pinsJsonBox = qs("#pinsJsonBox");
  const exportPinsBtn = qs("#exportPinsBtn");
  const copyPinsBtn = qs("#copyPinsBtn");

  let data = null;
  let media = [];
  let current = 0;

  // === THEME ===
  const THEME_KEY = "sercuctech_theme";
  function applyTheme(){
    const t = localStorage.getItem(THEME_KEY) || "dark";
    document.documentElement.setAttribute("data-theme", t);
  }
  function toggleTheme(){
    const cur = document.documentElement.getAttribute("data-theme") || "dark";
    const next = (cur === "light") ? "dark" : "light";
    localStorage.setItem(THEME_KEY, next);
    applyTheme();
  }
  applyTheme();

  // === FULLSCREEN IMAGE (tap) ===
  let overlayEl = null;
  function openImageFullscreen(src, alt){
    if(overlayEl) return;
    overlayEl = document.createElement("div");
    overlayEl.className = "fullOverlay";
    overlayEl.innerHTML = `<img src="${src}" alt="${escapeHtml(alt||"Immagine")}">`;
    overlayEl.addEventListener("click", closeImageFullscreen, {passive:true});
    document.body.appendChild(overlayEl);
  }
  function closeImageFullscreen(){
    if(!overlayEl) return;
    overlayEl.remove();
    overlayEl = null;
  }

  heroImg.addEventListener("click", ()=>{
    const item = media[current];
    if(!item) return;
    openImageFullscreen(item.url, item.label || `Foto ${current+1}`);
  }, {passive:true});

  // === SWIPE ===
  let startX = 0, startY = 0, moved = false;
  heroImg.addEventListener("touchstart", (e)=>{
    if(!e.touches || !e.touches[0]) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    moved = false;
  }, {passive:true});

  heroImg.addEventListener("touchmove", (e)=>{
    if(!e.touches || !e.touches[0]) return;
    const dx = Math.abs(e.touches[0].clientX - startX);
    const dy = Math.abs(e.touches[0].clientY - startY);
    if(dx > 12 && dx > dy) moved = true;
  }, {passive:true});

  heroImg.addEventListener("touchend", (e)=>{
    if(!moved) return;
    const endX = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientX : startX;
    const diff = endX - startX;
    if(diff < -30) next();
    if(diff >  30) prev();
  }, {passive:true});

  // === NAV ===
  prevBtn.addEventListener("click", prev);
  nextBtn.addEventListener("click", next);

  function prev(){
    if(!media.length) return;
    current = (current - 1 + media.length) % media.length;
    renderHero();
  }
  function next(){
    if(!media.length) return;
    current = (current + 1) % media.length;
    renderHero();
  }

  // === SHARE ===
  function getPublicLink(){
    return `${location.origin}${location.pathname.replace(/\/index\.html$/,"/")}vetrina.html?id=${encodeURIComponent(id)}`;
  }

  shareBtn.addEventListener("click", async ()=>{
    const link = getPublicLink();
    const title = (data && data.title) ? data.title : id;
    const text = `${title}\n${link}`;

    if(navigator.share){
      try{
        await navigator.share({ title, text, url: link });
        return;
      }catch(e){}
    }
    const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(wa, "_blank");
  });

  // === BOTTOM BAR ===
  homeBtn.addEventListener("click", ()=> location.href = `vetrina.html?id=${encodeURIComponent(id)}`);
  themeBtn.addEventListener("click", toggleTheme);

  fullBtn.addEventListener("click", ()=>{
    const item = media[current];
    if(!item) return;
    openImageFullscreen(item.url, item.label || `Foto ${current+1}`);
  });

  kioskBtn.addEventListener("click", async ()=>{
    const el = document.documentElement;
    try{
      if(!document.fullscreenElement){
        await el.requestFullscreen();
      }else{
        await document.exitFullscreen();
      }
    }catch(e){
      alert("Kiosk/Fullscreen non supportato dal browser.");
    }
  });

  // === VOICE (TTS) ===
  const VOICE_KEY = "sercuctech_audio_enabled";
  function isAudioEnabled(){ return localStorage.getItem(VOICE_KEY) === "1"; }
  function markAudioEnabled(){ localStorage.setItem(VOICE_KEY, "1"); }

  function stopSpeech(){
    try{ speechSynthesis.cancel(); }catch(e){}
  }

  function formatPhoneNumbersForSpeech(text){
    // legge i telefoni come cifre separate
    return text.replace(/\b\d{7,}\b/g, (m)=> m.split("").join(" "));
  }

  function speak(text, lang){
    stopSpeech();
    const t = (text || "").trim();
    if(!t) return;
    const u = new SpeechSynthesisUtterance(formatPhoneNumbersForSpeech(t));
    u.lang = lang || "it-IT";
    u.rate = 1.03;
    u.pitch = 1.0;
    speechSynthesis.speak(u);
  }

  function buildSingleSpeechText(){
    // UN SOLO BLOCCO = meno pause
    const t = [];
    if(data?.description) t.push(data.description);
    if(data?.voice?.text) t.push(data.voice.text);
    return t.join(". ").replace(/\.\s*\./g,".").trim();
  }

  function tryAutoSpeakFirstTime(){
    if(!data) return;
    const lang = data?.voice?.lang || "it-IT";
    const text = buildSingleSpeechText();

    if(isAudioEnabled()){
      try{ speak(text, lang); }catch(e){}
      return;
    }
    audioGate.hidden = false;
  }

  enableAudioBtn.addEventListener("click", ()=>{
    markAudioEnabled();
    audioGate.hidden = true;
    if(!data) return;
    speak(buildSingleSpeechText(), data?.voice?.lang || "it-IT");
  });

  skipAudioBtn.addEventListener("click", ()=>{ audioGate.hidden = true; });

  voiceBtn.addEventListener("click", ()=>{
    if(!data) return;
    if(!isAudioEnabled()){
      audioGate.hidden = false;
      return;
    }
    speak(buildSingleSpeechText(), data?.voice?.lang || "it-IT");
  });

  stopBtn.addEventListener("click", stopSpeech);

  // === CONTACTS clickable ===
  function extractPhones(text){
    const s = (text || "");
    const matches = s.match(/\b\d{7,}\b/g) || [];
    // unique
    const set = new Set(matches);
    return Array.from(set);
  }

  function normalizePhoneForWa(num){
    // WhatsApp vuole solo cifre. Se è italiano e inizia con 3/0, mettiamo 39 davanti (come default)
    const digits = String(num).replace(/\D/g,"");
    if(!digits) return "";
    if(digits.startsWith("39")) return digits;
    // default Italia
    return "39" + digits;
  }

  function renderVoicePanel(){
    if(!data) return;

    const speechText = buildSingleSpeechText();
    if(!speechText){
      voicePanel.hidden = true;
      return;
    }

    voicePanel.hidden = false;
    voiceTextEl.textContent = speechText;

    // telefoni: prendiamoli da description + voice.text
    const allText = `${data.description || ""} ${data.voice?.text || ""}`;
    const phones = extractPhones(allText);

    contactsRow.innerHTML = "";
    if(!phones.length) return;

    // etichette “migliori”: se nel testo c’è “Renzo” e “Sergio” usiamo quelli, altrimenti generiche
    const hasRenzo = /renzo/i.test(allText);
    const hasSergio = /sergio/i.test(allText);

    phones.forEach((p, idx)=>{
      const waNum = normalizePhoneForWa(p);
      const waLink = waNum ? `https://wa.me/${waNum}` : `https://wa.me/`;
      const telLink = `tel:${p.replace(/\D/g,"")}`;

      let name = `Contatto ${idx+1}`;
      if(hasRenzo && idx === 0) name = "Renzo (WhatsApp/Chiamata)";
      if(hasSergio && ((hasRenzo && idx===1) || (!hasRenzo && idx===0))) name = "Sergio (WhatsApp/Chiamata)";

      const chip = document.createElement("div");
      chip.className = "contactChip";
      chip.innerHTML = `
        <div class="contactLeft">
          <div class="contactName">${escapeHtml(name)}</div>
          <div class="contactNum">${escapeHtml(p)}</div>
        </div>
        <div class="contactBtns">
          <a class="cBtn wa" href="${waLink}" target="_blank" rel="noopener">WhatsApp</a>
          <a class="cBtn tel" href="${telLink}">Chiama</a>
        </div>
      `;
      contactsRow.appendChild(chip);
    });
  }

  // === LABEL TOOL (manual pins) ===
  const PINS_KEY = (imgUrl)=> `sercuctech_pins_${id}__${imgUrl}`;
  const PINS_SIZE_KEY = `sercuctech_pin_size_${id}`;
  let labelUIUnlocked = false;
  let labelMode = false;
  let pinSize = Number(localStorage.getItem(PINS_SIZE_KEY) || 28);

  function getCurrentImgUrl(){
    return media[current]?.url || "";
  }

  function loadPins(imgUrl){
    try{
      return JSON.parse(localStorage.getItem(PINS_KEY(imgUrl))) || [];
    }catch(e){
      return [];
    }
  }

  function savePins(imgUrl, pins){
    localStorage.setItem(PINS_KEY(imgUrl), JSON.stringify(pins));
  }

  function setLabelMode(on){
    labelMode = !!on;
    labelModeBadge.textContent = labelMode ? "ON" : "OFF";
    labelModeBadge.style.opacity = labelMode ? "1" : ".7";
    labelToggleBtn.textContent = labelMode ? "Modalità: ON (tocca immagine per numerare)" : "Attiva/Disattiva";
    // quando ON, rendiamo cliccabile l’area immagine per mettere pins
    pinsLayer.style.pointerEvents = labelMode ? "auto" : "none";
    imgWrap.style.cursor = labelMode ? "crosshair" : "default";
  }

  function applyPinSize(){
    pinSizeValue.textContent = String(pinSize);
    pinSizeRange.value = String(pinSize);
    // aggiorna pins visibili
    qsa(".pin").forEach(el=>{
      el.style.width = `${pinSize}px`;
      el.style.height = `${pinSize}px`;
      el.style.fontSize = `${Math.max(10, Math.round(pinSize*0.5))}px`;
    });
  }

  pinSizeRange.addEventListener("input", ()=>{
    pinSize = Number(pinSizeRange.value);
    localStorage.setItem(PINS_SIZE_KEY, String(pinSize));
    applyPinSize();
  });

  function renderPins(){
    pinsLayer.innerHTML = "";
    const imgUrl = getCurrentImgUrl();
    if(!imgUrl) return;

    const pins = loadPins(imgUrl);
    pins.forEach(pin=>{
      const el = document.createElement("div");
      el.className = "pin";
      el.textContent = String(pin.n);
      el.style.left = `${pin.xPct}%`;
      el.style.top  = `${pin.yPct}%`;
      el.style.width = `${pinSize}px`;
      el.style.height = `${pinSize}px`;
      el.style.fontSize = `${Math.max(10, Math.round(pinSize*0.5))}px`;
      pinsLayer.appendChild(el);
    });
  }

  // piazza pin al tap quando labelMode ON
  imgWrap.addEventListener("click", (e)=>{
    if(!labelUIUnlocked || !labelMode) return;
    // coordinate relative al wrap
    const rect = imgWrap.getBoundingClientRect();
    const x = (e.clientX - rect.left);
    const y = (e.clientY - rect.top);
    const xPct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    const yPct = Math.max(0, Math.min(100, (y / rect.height) * 100));

    const imgUrl = getCurrentImgUrl();
    if(!imgUrl) return;

    const pins = loadPins(imgUrl);
    const nextN = (pins.length ? pins[pins.length-1].n : 0) + 1;
    pins.push({ n: nextN, xPct: round2(xPct), yPct: round2(yPct) });
    savePins(imgUrl, pins);
    renderPins();
    updatePinsBox();
  });

  labelToggleBtn.addEventListener("click", ()=> setLabelMode(!labelMode));

  labelUndoBtn.addEventListener("click", ()=>{
    const imgUrl = getCurrentImgUrl();
    if(!imgUrl) return;
    const pins = loadPins(imgUrl);
    pins.pop();
    savePins(imgUrl, pins);
    renderPins();
    updatePinsBox();
  });

  labelClearBtn.addEventListener("click", ()=>{
    const imgUrl = getCurrentImgUrl();
    if(!imgUrl) return;
    if(!confirm("Sicuro? Cancello TUTTI i numerini su questa foto.")) return;
    savePins(imgUrl, []);
    renderPins();
    updatePinsBox();
  });

  function exportPinsJson(){
    const imgUrl = getCurrentImgUrl();
    const pins = imgUrl ? loadPins(imgUrl) : [];
    return {
      id,
      image: imgUrl,
      pinSize,
      pins
    };
  }

  function updatePinsBox(){
    if(!labelUIUnlocked) return;
    const obj = exportPinsJson();
    pinsJsonBox.value = JSON.stringify(obj, null, 2);
  }

  exportPinsBtn.addEventListener("click", ()=>{
    updatePinsBox();
    pinsJsonBox.focus();
    pinsJsonBox.select();
  });

  copyPinsBtn.addEventListener("click", async ()=>{
    updatePinsBox();
    try{
      await navigator.clipboard.writeText(pinsJsonBox.value);
      alert("JSON copiato ✅");
    }catch(e){
      // fallback
      pinsJsonBox.focus();
      pinsJsonBox.select();
      document.execCommand("copy");
      alert("JSON copiato ✅");
    }
  });

  // Sblocco label UI: tap titolo 5 volte
  let titleTaps = 0;
  let titleTapTimer = null;
  pageTitle.addEventListener("click", ()=>{
    titleTaps++;
    clearTimeout(titleTapTimer);
    titleTapTimer = setTimeout(()=>{ titleTaps = 0; }, 900);

    if(titleTaps >= 5){
      titleTaps = 0;
      labelUIUnlocked = !labelUIUnlocked;
      labelCard.hidden = !labelUIUnlocked;
      if(labelUIUnlocked){
        setLabelMode(true);
        applyPinSize();
        updatePinsBox();
      }else{
        setLabelMode(false);
      }
    }
  }, {passive:true});

  // === LOAD JSON ===
  async function load(){
    badgeId.textContent = `id: ${id}`;
    const jsonUrl = `data/${encodeURIComponent(id)}.json`;

    let ok = false;
    try{
      const res = await fetch(jsonUrl, {cache:"no-store"});
      if(res.ok){
        data = await res.json();
        ok = true;
      }
    }catch(e){}

    if(!ok){
      data = { id, title: id, description: "Vetrina", voice:{lang:"it-IT", text:""}, media:[], files:[] };
    }

    // titolo “con SerCucTech” se non presente
    const baseTitle = (data.title || id).trim();
    data.title = /SerCucTech/i.test(baseTitle) ? baseTitle : `${baseTitle} con SerCucTech`;

    document.title = data.title;
    pageTitle.textContent = data.title;
    pageDesc.textContent  = data.description || "";

    // voice panel sotto titolo + contatti cliccabili
    renderVoicePanel();

    media = Array.isArray(data.media) ? data.media.filter(m=>m && m.url) : [];

    // ✅ ORDINE: ultima caricata = ultima della lista
    // (se GitHub ti ha salvato i file con numeri, basta ordinare per url)
    media.sort((a,b)=> String(a.url).localeCompare(String(b.url), "it", {numeric:true}));

    // mostra l'ULTIMA come prima
    current = media.length ? (media.length - 1) : 0;

    renderThumbs();
    await renderHero(true);
    renderFiles();

    // label tool size
    applyPinSize();
    renderPins();
    tryAutoSpeakFirstTime();
  }

  async function renderHero(first=false){
    if(!media.length){
      heroImg.removeAttribute("src");
      heroImg.alt = "Nessuna immagine";
      imgCounter.textContent = "00/00";
      imgBadge.textContent = "--";
      pinsLayer.innerHTML = "";
      return;
    }

    const item = media[current];
    const total = media.length;

    const idx = current + 1;
    imgBadge.textContent = String(idx).padStart(2,"0");
    imgCounter.textContent = `${String(idx).padStart(2,"0")}/${String(total).padStart(2,"0")}`;

    heroImg.src = item.url;
    heroImg.alt = item.label || `Foto ${idx}`;

    // thumb active
    qsa(".thumb").forEach((t,i)=> t.classList.toggle("active", i===current));
    const active = qsa(".thumb")[current];
    if(active) active.scrollIntoView({behavior:"smooth", inline:"center", block:"nearest"});

    // se overlay aperto, aggiorna immagine
    if(overlayEl){
      const img = overlayEl.querySelector("img");
      if(img) img.src = item.url;
    }

    // pins
    renderPins();
    updatePinsBox();
  }

  function renderThumbs(){
    thumbRow.innerHTML = "";
    if(!media.length) return;

    media.forEach((m,i)=>{
      const t = document.createElement("button");
      t.className = "thumb" + (i===current ? " active" : "");
      t.type = "button";
      t.innerHTML = `
        <span class="thumbNum">${String(i+1).padStart(2,"0")}</span>
        <img src="${m.url}" alt="thumb ${i+1}">
      `;
      t.addEventListener("click", ()=>{
        current = i;
        renderHero();
      });
      thumbRow.appendChild(t);
    });
  }

  function renderFiles(){
    const files = Array.isArray(data.files) ? data.files : [];
    if(!files.length){
      filesCard.hidden = true;
      return;
    }
    filesCard.hidden = false;
    filesList.innerHTML = "";

    files.forEach((f)=>{
      const row = document.createElement("div");
      row.className = "fileItem";
      const label = f.label || f.name || "File";
      const url = f.url || "";
      const type = f.type || "";
      row.innerHTML = `
        <div>
          <a href="${url}" target="_blank" rel="noopener">${escapeHtml(label)}</a><br>
          <small>${escapeHtml(type)}</small>
        </div>
        <small>Apri</small>
      `;
      filesList.appendChild(row);
    });
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, (c)=>({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[c]));
  }

  function round2(n){ return Math.round(n*100)/100; }

  // START
  load();

})();
