/* ===================== SERCUCTECH VETRINA APP.JS ===================== */
(() => {
  "use strict";

  // ---------- Helpers ----------
  const $ = (id) => document.getElementById(id);
  const qs = new URLSearchParams(location.search);
  const VETRINA_ID = (qs.get("id") || "").trim() || "renzo11";

  // URL base repo
  const BASE = location.origin + location.pathname.replace(/\/[^\/]*$/, "/");
  const LINK_PUBLIC = `${BASE}link.html?id=${encodeURIComponent(VETRINA_ID)}`;
  const DATA_URL = `data/${encodeURIComponent(VETRINA_ID)}.json`;

  // ---------- UI refs ----------
  const pageTitle = $("pageTitle");
  const pageDesc  = $("pageDesc");
  const badgeId   = $("badgeId");

  const heroImg   = $("heroImg");
  const imgCounter= $("imgCounter");
  const imgBadge  = $("imgBadge");
  const thumbRow  = $("thumbRow");
  const prevBtn   = $("prevBtn");
  const nextBtn   = $("nextBtn");

  const voicePanel= $("voicePanel");
  const voiceTextEl = $("voiceText");
  const contactsRow = $("contactsRow");

  const voiceBtn  = $("voiceBtn");
  const stopBtn   = $("stopBtn");
  const fullBtn   = $("fullBtn");
  const themeBtn  = $("themeBtn");
  const kioskBtn  = $("kioskBtn");
  const homeBtn   = $("homeBtn");

  // WhatsApp buttons in vetrina.html
  const waPhotoRenzo = $("waPhotoRenzo");
  const waPhotoSergio= $("waPhotoSergio");
  const waVetrinaRenzo = $("waVetrinaRenzo");
  const waVetrinaSergio= $("waVetrinaSergio");

  // Audio gate (optional)
  const audioGate = $("audioGate");
  const enableAudioBtn = $("enableAudioBtn");
  const skipAudioBtn = $("skipAudioBtn");

  // ---------- State ----------
  let data = null;
  let media = []; // array of {type,url,label}
  let idx = 0;
  let isFull = false;
  let kiosk = false;

  // Contacts: expects in JSON: contacts[], but you currently don't have it.
  // We'll auto-detect phone numbers from voice.text for click-to-WhatsApp + click-to-call if contacts missing.
  let contacts = []; // {name, phone}

  // ---------- Theme ----------
  const THEME_KEY = "sercuctech_theme";
  function setTheme(mode){
    document.documentElement.dataset.theme = mode; // if your css uses it
    localStorage.setItem(THEME_KEY, mode);
  }
  function toggleTheme(){
    const cur = localStorage.getItem(THEME_KEY) || "dark";
    setTheme(cur === "dark" ? "light" : "dark");
  }

  // ---------- Kiosk ----------
  function setKiosk(on){
    kiosk = !!on;
    document.body.classList.toggle("kiosk", kiosk);
    try{
      if(kiosk){
        document.documentElement.requestFullscreen?.().catch(()=>{});
        screen.orientation?.lock?.("portrait").catch(()=>{});
      }else{
        document.exitFullscreen?.().catch(()=>{});
        screen.orientation?.unlock?.();
      }
    }catch(e){}
  }

  // ---------- Fullscreen image (toggle) ----------
  function setFull(on){
    isFull = !!on;
    document.body.classList.toggle("imgFull", isFull);
    heroImg?.classList.toggle("full", isFull);
  }
  function toggleFull(){
    setFull(!isFull);
  }

  // ---------- Speech ----------
  function speak(text, lang){
    if(!text) return false;
    if(!("speechSynthesis" in window)) return false;
    try{
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang || (navigator.language || "it-IT");
      u.rate = 1;
      u.pitch = 1;
      u.volume = 1;
      speechSynthesis.speak(u);
      return true;
    }catch(e){
      return false;
    }
  }
  function stopSpeak(){
    try{ speechSynthesis.cancel(); }catch(e){}
  }

  // ---------- Autoplay audio on open (best-effort) ----------
  // Mobile often blocks autoplay. We'll try, else show audioGate if exists.
  function tryAutoVoice(){
    const t = data?.voice?.text || "";
    const lang = data?.voice?.lang || "it-IT";
    if(!t) return;

    const ok = speak(t, lang);
    if(!ok && audioGate){
      audioGate.hidden = false;
    }
  }

  // ---------- Contacts: from JSON OR detect phones from voice.text ----------
  function extractPhonesFromText(text){
    // catches italian mobile forms like 3332927842 or 320 885 2858
    const raw = String(text||"");
    const matches = raw.match(/(\+?\d[\d\s]{7,}\d)/g) || [];
    const phones = [];
    for(const m of matches){
      const digits = m.replace(/\D/g,"");
      if(digits.length >= 8 && digits.length <= 15) phones.push(digits);
    }
    // unique
    return [...new Set(phones)];
  }

  function formatPhonePretty(digits){
    const s = String(digits||"").replace(/\D/g,"");
    // simple grouping for IT 10 digits
    if(s.length === 10) return s.replace(/(\d{3})(\d{3})(\d{4})/,"$1 $2 $3");
    return s;
  }

  function waUrl(phone, msg){
    const digits = String(phone||"").replace(/\D/g,"");
    if(digits) return `https://wa.me/${digits}?text=${encodeURIComponent(msg||"")}`;
    return `https://wa.me/?text=${encodeURIComponent(msg||"")}`;
  }

  function msgForVetrina(name){
    return `Ciao ${name || ""}! 👋
Ti mando la vetrina con foto e numeri degli oggetti.

✅ Apri qui:
${LINK_PUBLIC}

📌 Dimmi il numero dell’oggetto che ti interessa.`;
  }

  function msgForFoto(name){
    const n = String((idx+1)).padStart(2,"0");
    const cur = media[idx];
    const photo = cur?.url ? (BASE + cur.url.replace(/^\/+/,"")) : "";
    return `Ciao ${name || ""}! 👋
Vorrei informazioni per il numero ${n}.

🏷️ Vetrina: ${data?.title || VETRINA_ID}
🔗 Link vetrina: ${LINK_PUBLIC}
📷 Foto: ${photo}

✅ Se disponibile, mandatemi prezzo e disponibilità.`;
  }

  function renderContacts(){
    if(!contactsRow) return;
    contactsRow.innerHTML = "";

    // If JSON has contacts -> use them
    if(Array.isArray(data?.contacts) && data.contacts.length){
      contacts = data.contacts
        .filter(c => c && c.phone)
        .map(c => ({ name: c.name || "Contatto", phone: String(c.phone) }));
    } else {
      // fallback from voice text
      const phones = extractPhonesFromText(data?.voice?.text || "");
      // assign default names if possible
      contacts = phones.slice(0,2).map((p,i)=>({
        name: i===0 ? "Renzo" : (i===1 ? "Sergio" : "Contatto"),
        phone: p
      }));
    }

    // Create clickable pills (WhatsApp + Call)
    contacts.slice(0,2).forEach((c)=>{
      const wrap = document.createElement("div");
      wrap.style.display = "flex";
      wrap.style.gap = "10px";
      wrap.style.flexWrap = "wrap";

      const wa = document.createElement("button");
      wa.className = "contactBtn wa";
      wa.textContent = `WhatsApp ${c.name} (${formatPhonePretty(c.phone)})`;
      wa.onclick = () => window.open(waUrl(c.phone, msgForVetrina(c.name)), "_blank");

      const call = document.createElement("a");
      call.className = "contactBtn";
      call.href = "tel:" + String(c.phone).replace(/\D/g,"");
      call.textContent = `Chiama ${c.name}`;

      wrap.appendChild(wa);
      wrap.appendChild(call);

      contactsRow.appendChild(wrap);
    });

    // Wire the 4 fixed WA buttons (if exist)
    const c1 = contacts[0] || null;
    const c2 = contacts[1] || null;

    function setBtn(btn, c, label){
      if(!btn) return;
      if(!c){
        btn.textContent = label + " (non configurato)";
        btn.classList.add("gray");
        btn.disabled = true;
        return;
      }
      btn.textContent = label.replace("{NAME}", c.name);
      btn.classList.remove("gray");
      btn.disabled = false;
    }

    setBtn(waVetrinaRenzo, c1, "🟢 WhatsApp {NAME} (Vetrina)");
    setBtn(waVetrinaSergio, c2, "🟢 WhatsApp {NAME} (Vetrina)");
    setBtn(waPhotoRenzo, c1, "🟢 WhatsApp {NAME} (Foto)");
    setBtn(waPhotoSergio, c2, "🟢 WhatsApp {NAME} (Foto)");

    if(waVetrinaRenzo && c1) waVetrinaRenzo.onclick = ()=>window.open(waUrl(c1.phone, msgForVetrina(c1.name)), "_blank");
    if(waVetrinaSergio && c2) waVetrinaSergio.onclick = ()=>window.open(waUrl(c2.phone, msgForVetrina(c2.name)), "_blank");
    if(waPhotoRenzo && c1) waPhotoRenzo.onclick = ()=>window.open(waUrl(c1.phone, msgForFoto(c1.name)), "_blank");
    if(waPhotoSergio && c2) waPhotoSergio.onclick = ()=>window.open(waUrl(c2.phone, msgForFoto(c2.name)), "_blank");
  }

  // ---------- Media slider ----------
  function setImage(i){
    if(!media.length) return;
    idx = (i + media.length) % media.length;

    const item = media[idx];
    if(!item) return;

    // for now: images only (your JSON uses type:image)
    if(item.type !== "image"){
      // if video later: could extend
    }

    const url = item.url || item.src || "";
    heroImg.src = url;
    heroImg.alt = item.label || `Foto ${idx+1}`;

    const cur = String(idx+1).padStart(2,"0");
    const tot = String(media.length).padStart(2,"0");
    if(imgCounter) imgCounter.textContent = `${cur}/${tot}`;
    if(imgBadge) imgBadge.textContent = cur;

    // thumbs highlight
    if(thumbRow){
      [...thumbRow.querySelectorAll(".thumb")].forEach((el, n)=>{
        el.classList.toggle("active", n === idx);
      });
    }
  }

  function renderThumbs(){
    if(!thumbRow) return;
    thumbRow.innerHTML = "";
    media.forEach((m, i)=>{
      const b = document.createElement("button");
      b.className = "thumb";
      b.type = "button";
      b.title = m.label || `Foto ${i+1}`;
      b.innerHTML = `<img src="${m.url}" alt="">`;
      b.onclick = ()=>setImage(i);
      thumbRow.appendChild(b);
    });
  }

  function bindNav(){
    prevBtn?.addEventListener("click", ()=>setImage(idx-1));
    nextBtn?.addEventListener("click", ()=>setImage(idx+1));

    // swipe on hero image
    let x0 = null;
    heroImg?.addEventListener("touchstart", (e)=>{
      x0 = e.touches?.[0]?.clientX ?? null;
    }, {passive:true});
    heroImg?.addEventListener("touchend", (e)=>{
      if(x0==null) return;
      const x1 = e.changedTouches?.[0]?.clientX ?? null;
      if(x1==null) return;
      const dx = x1 - x0;
      if(Math.abs(dx) > 40){
        if(dx < 0) setImage(idx+1);
        else setImage(idx-1);
      }
      x0 = null;
    }, {passive:true});

    // tap image toggles full
    heroImg?.addEventListener("click", ()=>toggleFull());
  }

  // ---------- Load JSON ----------
  async function load(){
    if(badgeId) badgeId.textContent = "id: " + VETRINA_ID;

    try{
      const res = await fetch(DATA_URL, {cache:"no-store"});
      if(!res.ok) throw new Error("HTTP " + res.status);
      data = await res.json();

      // Title/desc
      if(pageTitle) pageTitle.textContent = data.title || VETRINA_ID;
      if(pageDesc) pageDesc.textContent  = data.description || "";

      // Voice panel text visible always if exists
      if(data.voice?.text){
        if(voiceTextEl) voiceTextEl.textContent = data.voice.text;
        if(voicePanel) voicePanel.hidden = false;
      }else{
        if(voicePanel) voicePanel.hidden = true;
      }

      // Media
      media = Array.isArray(data.media) ? data.media.filter(m=>m && (m.url||m.src)) : [];
      if(!media.length){
        // fallback: show nothing, but don't crash
        if(heroImg){ heroImg.removeAttribute("src"); heroImg.alt = "Nessuna immagine"; }
        if(imgCounter) imgCounter.textContent = "00/00";
        if(imgBadge) imgBadge.textContent = "--";
      }else{
        renderThumbs();
        setImage(0);
      }

      // Contacts (or fallback from voice text)
      renderContacts();

      // Events
      bindNav();

      // Buttons in bottom bar
      voiceBtn?.addEventListener("click", ()=>{
        const t = data?.voice?.text || "";
        const lang = data?.voice?.lang || "it-IT";
        const ok = speak(t, lang);
        if(!ok && audioGate) audioGate.hidden = false;
      });
      stopBtn?.addEventListener("click", ()=>stopSpeak());
      fullBtn?.addEventListener("click", ()=>toggleFull());
      themeBtn?.addEventListener("click", ()=>toggleTheme());
      kioskBtn?.addEventListener("click", ()=>setKiosk(!kiosk));
      homeBtn?.addEventListener("click", ()=>location.href = LINK_PUBLIC);

      // Audio gate handlers
      enableAudioBtn?.addEventListener("click", ()=>{
        audioGate.hidden = true;
        tryAutoVoice();
      });
      skipAudioBtn?.addEventListener("click", ()=>{ audioGate.hidden = true; });

      // Apply theme
      setTheme(localStorage.getItem(THEME_KEY) || "dark");

      // Autoplay voice on open (first try)
      tryAutoVoice();

    }catch(e){
      if(pageTitle) pageTitle.textContent = "Errore";
      if(pageDesc) pageDesc.textContent = "Non riesco a leggere " + DATA_URL;
      console.error(e);
    }
  }

  load();
})();
