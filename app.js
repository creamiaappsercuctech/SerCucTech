/* ===================== SERCUCTECH VETRINA APP.JS (v3) ===================== */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const qs = new URLSearchParams(location.search);
  const VETRINA_ID = (qs.get("id") || "").trim() || "renzo11";

  const BASE = location.origin + location.pathname.replace(/\/[^\/]*$/, "/");
  const LINK_PUBLIC = `${BASE}link.html?id=${encodeURIComponent(VETRINA_ID)}`;
  const DATA_URL = `data/${encodeURIComponent(VETRINA_ID)}.json`;

  // UI
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

  const waPhotoRenzo = $("waPhotoRenzo");
  const waPhotoSergio= $("waPhotoSergio");
  const waVetrinaRenzo = $("waVetrinaRenzo");
  const waVetrinaSergio= $("waVetrinaSergio");

  const audioGate = $("audioGate");
  const enableAudioBtn = $("enableAudioBtn");
  const skipAudioBtn = $("skipAudioBtn");

  const shareBtn = $("shareBtn");

  // State
  let data = null;
  let media = [];
  let idx = 0;
  let isFull = false;
  let kiosk = false;
  let contacts = []; // {name, phone}

  // Theme
  const THEME_KEY = "sercuctech_theme";
  function setTheme(mode){
    document.documentElement.dataset.theme = mode;
    localStorage.setItem(THEME_KEY, mode);
  }
  function toggleTheme(){
    const cur = localStorage.getItem(THEME_KEY) || "dark";
    setTheme(cur === "dark" ? "light" : "dark");
  }

  // Fullscreen image (in-page)
  function setFull(on){
    isFull = !!on;
    document.body.classList.toggle("imgFull", isFull);
  }
  function toggleFull(){
    setFull(!isFull);
  }

  // Kiosk
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

  // -------- Speech helpers --------
  function stopSpeak(){
    try{ speechSynthesis.cancel(); }catch(e){}
  }

  // Trasforma numeri telefono in "3 3 3 2 9 2 7 8 4 2"
  function phoneDigitsSpaced(digits){
    const s = String(digits||"").replace(/\D/g,"");
    return s.split("").join(" ");
  }

  function normalizeForSpeech(text){
    const raw = String(text || "");

    // trova sequenze che sembrano telefoni (anche con spazi / +)
    return raw.replace(/(\+?\d[\d\s]{7,}\d)/g, (m) => {
      const digits = m.replace(/\D/g,"");
      if(digits.length < 8 || digits.length > 15) return m;
      // per farlo leggere bene: "numero 3 3 3 ..."
      return ` numero ${phoneDigitsSpaced(digits)} `;
    });
  }

  function speak(text, lang){
    if(!text) return false;
    if(!("speechSynthesis" in window)) return false;

    try{
      stopSpeak();
      const u = new SpeechSynthesisUtterance(normalizeForSpeech(text));
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

  function tryAutoVoice(){
    const t = data?.voice?.text || "";
    const lang = data?.voice?.lang || "it-IT";
    if(!t) return;

    const ok = speak(t, lang);
    if(!ok && audioGate) audioGate.hidden = false;
  }

  // -------- WhatsApp helpers --------
  function waUrl(phone, msg){
    const digits = String(phone||"").replace(/\D/g,"");
    return `https://wa.me/${digits}?text=${encodeURIComponent(msg||"")}`;
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

  // -------- Contacts --------
  function extractPhonesFromText(text){
    const raw = String(text||"");
    // prende sequenze numeriche anche se ci sono punti/virgole vicino
    const matches = raw.match(/(\+?\d[\d\s]{7,}\d)/g) || [];
    const phones = [];
    for(const m of matches){
      const digits = m.replace(/\D/g,"");
      if(digits.length >= 8 && digits.length <= 15) phones.push(digits);
    }
    return [...new Set(phones)];
  }

  function formatPhonePretty(digits){
    const s = String(digits||"").replace(/\D/g,"");
    if(s.length === 10) return s.replace(/(\d{3})(\d{3})(\d{4})/,"$1 $2 $3");
    return s;
  }

  function buildContacts(){
    // 1) se JSON ha contacts -> usa quelli
    if(Array.isArray(data?.contacts) && data.contacts.length){
      return data.contacts
        .filter(c => c && c.phone)
        .map(c => ({ name: c.name || "Contatto", phone: String(c.phone) }));
    }

    // 2) fallback: estrai da voice.text e metti nomi di default
    const phones = extractPhonesFromText(data?.voice?.text || "");
    const out = [];
    if(phones[0]) out.push({name:"Renzo", phone: phones[0]});
    if(phones[1]) out.push({name:"Sergio", phone: phones[1]});

    // 3) fallback estremo (solo per renzo11)
    if(!out.length && VETRINA_ID === "renzo11"){
      out.push({name:"Renzo", phone:"3332927842"});
      out.push({name:"Sergio", phone:"3208852858"});
    }

    return out;
  }

  function renderContacts(){
    if(!contactsRow) return;
    contactsRow.innerHTML = "";

    contacts = buildContacts();
    const c1 = contacts[0] || {name:"Renzo", phone:"3332927842"};
    const c2 = contacts[1] || {name:"Sergio", phone:"3208852858"};

    // contatti cliccabili (WhatsApp + Call)
    [c1,c2].forEach((c)=>{
      const wrap = document.createElement("div");
      wrap.style.display = "flex";
      wrap.style.gap = "10px";
      wrap.style.flexWrap = "wrap";

      const wa = document.createElement("button");
      wa.className = "contactBtn wa";
      wa.textContent = `WhatsApp ${c.name} (${formatPhonePretty(c.phone)})`;
      wa.onclick = (ev) => { ev.stopPropagation(); window.open(waUrl(c.phone, msgForVetrina(c.name)), "_blank"); };

      const call = document.createElement("a");
      call.className = "contactBtn";
      call.href = "tel:" + String(c.phone).replace(/\D/g,"");
      call.textContent = `Chiama ${c.name}`;
      call.onclick = (ev) => ev.stopPropagation();

      wrap.appendChild(wa);
      wrap.appendChild(call);
      contactsRow.appendChild(wrap);
    });

    // 4 bottoni fissi (vetrina + foto)
    function wire(btn, label, phone, msgFn){
      if(!btn) return;
      btn.textContent = label;
      btn.disabled = false;
      btn.classList.remove("gray");
      btn.onclick = () => window.open(waUrl(phone, msgFn()), "_blank");
    }

    wire(waVetrinaRenzo, "🟢 WhatsApp Renzo (Vetrina)", c1.phone, () => msgForVetrina("Renzo"));
    wire(waVetrinaSergio,"🟢 WhatsApp Sergio (Vetrina)", c2.phone, () => msgForVetrina("Sergio"));

    wire(waPhotoRenzo, "🟢 WhatsApp Renzo (Foto)", c1.phone, () => msgForFoto("Renzo"));
    wire(waPhotoSergio,"🟢 WhatsApp Sergio (Foto)", c2.phone, () => msgForFoto("Sergio"));
  }

  // -------- Media slider --------
  function setImage(i){
    if(!media.length) return;
    idx = (i + media.length) % media.length;

    const item = media[idx];
    const url = item.url || item.src || "";
    heroImg.src = url;
    heroImg.alt = item.label || `Foto ${idx+1}`;

    const cur = String(idx+1).padStart(2,"0");
    const tot = String(media.length).padStart(2,"0");
    if(imgCounter) imgCounter.textContent = `${cur}/${tot}`;
    if(imgBadge) imgBadge.textContent = cur;

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

    // swipe
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

    // tap immagine = toggle full
    heroImg?.addEventListener("click", ()=>toggleFull());
  }

  // -------- Load JSON --------
  async function load(){
    if(badgeId) badgeId.textContent = "id: " + VETRINA_ID;

    try{
      const res = await fetch(DATA_URL, {cache:"no-store"});
      if(!res.ok) throw new Error("HTTP " + res.status);
      data = await res.json();

      // titolo/desc (più evidenti via CSS)
      if(pageTitle) pageTitle.textContent = data.title || VETRINA_ID;
      if(pageDesc) pageDesc.textContent  = data.description || "";

      // voice panel: testo sempre visibile e cliccabile
      if(data.voice?.text){
        if(voiceTextEl) voiceTextEl.textContent = data.voice.text;
        if(voicePanel) voicePanel.hidden = false;
      }else{
        if(voicePanel) voicePanel.hidden = true;
      }

      // media
      media = Array.isArray(data.media) ? data.media.filter(m=>m && (m.url||m.src)) : [];
      if(media.length){
        renderThumbs();
        setImage(0);
      }else{
        if(heroImg){ heroImg.removeAttribute("src"); heroImg.alt = "Nessuna immagine"; }
        if(imgCounter) imgCounter.textContent = "00/00";
        if(imgBadge) imgBadge.textContent = "--";
      }

      // contatti + bottoni WA
      renderContacts();

      // nav
      bindNav();

      // bottom bar
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

      // CLICK OVUNQUE sul pannello testo = parte audio (senza bloccare click ai bottoni)
      const playVoiceFromPanel = () => voiceBtn?.click();
      voicePanel?.addEventListener("click", (e)=>{
        // se clicchi su un bottone/link dentro, non far partire l'audio
        const t = e.target;
        if(t && (t.closest("button") || t.closest("a"))) return;
        playVoiceFromPanel();
      });
      voicePanel?.addEventListener("keydown", (e)=>{
        if(e.key === "Enter" || e.key === " "){
          e.preventDefault();
          playVoiceFromPanel();
        }
      });

      // audio gate
      enableAudioBtn?.addEventListener("click", ()=>{
        audioGate.hidden = true;
        tryAutoVoice();
      });
      skipAudioBtn?.addEventListener("click", ()=>{ audioGate.hidden = true; });

      // share WhatsApp (link vetrina)
      shareBtn?.addEventListener("click", ()=>{
        const msg = `Guarda questa vetrina:\n${LINK_PUBLIC}\n\nDimmi il numero dell’oggetto che ti interessa.`;
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
      });

      // theme init
      setTheme(localStorage.getItem(THEME_KEY) || "dark");

      // autoplay voice on open (best effort)
      tryAutoVoice();

    }catch(e){
      if(pageTitle) pageTitle.textContent = "Errore";
      if(pageDesc) pageDesc.textContent = "Non riesco a leggere " + DATA_URL;
      console.error(e);
    }
  }

  load();
})();
